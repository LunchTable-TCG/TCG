import {
  createThread,
  listUIMessages,
  saveMessage,
  updateThreadMetadata,
} from "@convex-dev/agent";
import type {
  AgentLabTurnResult,
  BotRunnerSession,
} from "@lunchtable/shared-types";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  createAgentReply,
  getAgentSessionTitle,
  nextSessionPreview,
  toAgentLabSessionRecord,
} from "./lib/agentLab";
import {
  DEFAULT_BOT_DISPLAY_NAME,
  DEFAULT_BOT_POLICY_KEY,
  DEFAULT_BOT_SLUG,
  ensureBotIdentity,
  listBotAssignmentSnapshots,
  normalizeBotSlug,
  toBotIdentityRecord,
} from "./lib/agents";
import { issueActorAuthToken } from "./lib/jwt";
import { deserializeSeatView, deserializeSpectatorView } from "./lib/matches";
import { requireViewerUser } from "./lib/viewer";

function requireRunnerSecret(secret: string) {
  const expectedSecret = process.env.BOT_RUNNER_SECRET;
  if (!expectedSecret) {
    throw new Error("Missing required environment variable: BOT_RUNNER_SECRET");
  }
  if (secret !== expectedSecret) {
    throw new Error("Invalid bot runner secret");
  }
}

type AgentLabCtx = MutationCtx | QueryCtx;

async function getAgentSessionDoc(ctx: AgentLabCtx, sessionId: string) {
  const normalizedId = ctx.db.normalizeId("agentSessions", sessionId);
  if (!normalizedId) {
    return null;
  }
  return ctx.db.get(normalizedId);
}

async function requireOwnedAgentSession(
  ctx: AgentLabCtx,
  ownerUserId: Id<"users">,
  sessionId: string,
) {
  const session = await getAgentSessionDoc(ctx, sessionId);
  if (!session || session.ownerUserId !== ownerUserId) {
    throw new Error("Agent session not found for the current user");
  }
  return session;
}

async function getOwnedSeatView(
  ctx: AgentLabCtx,
  matchId: Id<"matches">,
  viewerUserId: Id<"users">,
) {
  return ctx.db
    .query("matchViews")
    .withIndex("by_matchId_and_viewerUserId_and_kind", (index) =>
      index
        .eq("matchId", matchId)
        .eq("viewerUserId", viewerUserId)
        .eq("kind", "seat"),
    )
    .unique();
}

async function getSpectatorView(ctx: AgentLabCtx, matchId: Id<"matches">) {
  return ctx.db
    .query("matchViews")
    .withIndex("by_matchId_and_kind", (index) =>
      index.eq("matchId", matchId).eq("kind", "spectator"),
    )
    .unique();
}

async function getReplayDoc(ctx: AgentLabCtx, matchId: Id<"matches">) {
  return ctx.db
    .query("replays")
    .withIndex("by_matchId", (index) => index.eq("matchId", matchId))
    .unique();
}

export const ensureBotIdentityInternal = internalMutation({
  args: {
    displayName: v.optional(v.string()),
    policyKey: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const identity = await ensureBotIdentity(ctx.db, {
      displayName: args.displayName,
      now,
      policyKey: args.policyKey,
      slug: args.slug,
    });

    return {
      displayName: identity.botIdentity.displayName,
      email: identity.user.email,
      policyKey: identity.botIdentity.policyKey,
      slug: identity.botIdentity.slug,
      status: identity.botIdentity.status,
      updatedAt: identity.botIdentity.updatedAt,
      userId: identity.user._id,
      username: identity.user.username,
      botIdentityId: identity.botIdentity._id,
      createdAt: identity.botIdentity.createdAt,
    };
  },
});

export const getBotIdentityBySlugInternal = internalQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const slug = normalizeBotSlug(args.slug);
    const botIdentity = await ctx.db
      .query("botIdentities")
      .withIndex("by_slug", (query) => query.eq("slugNormalized", slug))
      .unique();

    if (!botIdentity) {
      return null;
    }

    const user = await ctx.db.get(botIdentity.userId);
    if (!user) {
      throw new Error("Bot identity is missing its backing user");
    }

    return {
      botIdentity,
      user,
    };
  },
});

export const issueBotSession = action({
  args: {
    displayName: v.optional(v.string()),
    policyKey: v.optional(v.string()),
    runnerSecret: v.string(),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<BotRunnerSession> => {
    requireRunnerSecret(args.runnerSecret);

    const slug = normalizeBotSlug(args.slug ?? DEFAULT_BOT_SLUG);
    const displayName = args.displayName?.trim() || DEFAULT_BOT_DISPLAY_NAME;
    const policyKey = args.policyKey?.trim() || DEFAULT_BOT_POLICY_KEY;

    const identity = await ctx.runMutation(
      internal.agents.ensureBotIdentityInternal,
      {
        displayName,
        policyKey,
        slug,
      },
    );

    const token = await issueActorAuthToken({
      actorType: "bot",
      email: identity.email,
      userId: identity.userId,
      username: identity.username,
    });

    return {
      botIdentity: {
        createdAt: identity.createdAt,
        displayName: identity.displayName,
        id: identity.botIdentityId,
        policyKey: identity.policyKey,
        slug: identity.slug,
        status: identity.status,
        updatedAt: identity.updatedAt,
        userId: identity.userId,
      },
      token,
      userId: identity.userId,
      username: identity.username,
    };
  },
});

export const getMyBotIdentity = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireViewerUser(ctx);
    if ((user.actorType ?? "human") !== "bot") {
      throw new Error("Bot authentication required");
    }

    const botIdentity = await ctx.db
      .query("botIdentities")
      .withIndex("by_userId", (query) => query.eq("userId", user._id))
      .unique();

    return botIdentity ? toBotIdentityRecord(botIdentity) : null;
  },
});

export const listMyAssignments = query({
  args: {
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    if ((user.actorType ?? "human") !== "bot") {
      throw new Error("Bot authentication required");
    }

    return listBotAssignmentSnapshots(
      ctx.db,
      user._id,
      args.includeCompleted
        ? ["pending", "active", "complete", "cancelled"]
        : ["pending", "active"],
    );
  },
});

export const listLabSessions = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    matchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    const matchId = args.matchId
      ? ctx.db.normalizeId("matches", args.matchId)
      : null;

    const sessions = await ctx.db
      .query("agentSessions")
      .withIndex("by_ownerUserId_and_updatedAt", (index) =>
        index.eq("ownerUserId", user._id),
      )
      .order("desc")
      .collect();

    return sessions
      .filter((session) => {
        if (!args.includeArchived && session.status !== "active") {
          return false;
        }
        if (matchId && session.matchId !== matchId) {
          return false;
        }
        return true;
      })
      .map(toAgentLabSessionRecord);
  },
});

export const listLabMessages = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedAgentSession(
      ctx,
      user._id,
      args.sessionId,
    );

    const paginated = await listUIMessages(ctx, components.agent, {
      paginationOpts: {
        cursor: null,
        numItems: 48,
      },
      threadId: session.threadId,
    });

    return [...paginated.page].reverse().map((message) => ({
      agentName: message.agentName ?? null,
      createdAt: message._creationTime,
      id: message.id,
      key: message.key,
      order: message.order,
      role: message.role,
      status: message.status,
      text: message.text,
    }));
  },
});

export const ensureLabSession = mutation({
  args: {
    matchId: v.string(),
    purpose: v.union(v.literal("coach"), v.literal("commentator")),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const matchId = ctx.db.normalizeId("matches", args.matchId);
    if (!matchId) {
      throw new Error("Match not found");
    }

    const existing = await ctx.db
      .query("agentSessions")
      .withIndex("by_ownerUserId_and_matchId_and_purpose_and_status", (index) =>
        index
          .eq("ownerUserId", user._id)
          .eq("matchId", matchId)
          .eq("purpose", args.purpose)
          .eq("status", "active"),
      )
      .unique();

    if (existing) {
      return toAgentLabSessionRecord(existing);
    }

    if (args.purpose === "coach") {
      const seatView = await getOwnedSeatView(ctx, matchId, user._id);
      if (!seatView) {
        throw new Error(
          "Coach sessions require you to be seated in the selected match.",
        );
      }
    } else {
      const spectatorView = await getSpectatorView(ctx, matchId);
      if (!spectatorView) {
        throw new Error("Commentator sessions require a public match view.");
      }
    }

    const now = Date.now();
    const threadId = await createThread(ctx, components.agent, {
      summary: `${args.purpose} helper thread for ${args.matchId}`,
      title: getAgentSessionTitle({
        matchId: args.matchId,
        purpose: args.purpose,
      }),
      userId: user._id,
    });
    const sessionId = await ctx.db.insert("agentSessions", {
      createdAt: now,
      matchId,
      ownerUserId: user._id,
      purpose: args.purpose,
      status: "active",
      threadId,
      title: getAgentSessionTitle({
        matchId: args.matchId,
        purpose: args.purpose,
      }),
      updatedAt: now,
    });

    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Failed to create agent session");
    }
    return toAgentLabSessionRecord(session);
  },
});

export const archiveLabSession = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedAgentSession(
      ctx,
      user._id,
      args.sessionId,
    );
    const updatedAt = Date.now();

    await ctx.db.patch(session._id, {
      status: "archived",
      updatedAt,
    });

    const updated = await ctx.db.get(session._id);
    if (!updated) {
      throw new Error("Agent session disappeared during archive");
    }

    return toAgentLabSessionRecord(updated);
  },
});

export const sendLabPrompt = mutation({
  args: {
    prompt: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args): Promise<AgentLabTurnResult> => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedAgentSession(
      ctx,
      user._id,
      args.sessionId,
    );
    if (session.status !== "active") {
      throw new Error("Archived agent sessions are read-only");
    }

    const userPrompt =
      args.prompt.trim() ||
      (session.purpose === "coach"
        ? "Walk me through the best public-parity action from my seat."
        : "Give me a short public-state commentary update.");

    const promptSave = await saveMessage(ctx, components.agent, {
      prompt: userPrompt,
      threadId: session.threadId,
      userId: user._id,
    });

    const seatViewDoc = await getOwnedSeatView(ctx, session.matchId, user._id);
    const spectatorViewDoc = await getSpectatorView(ctx, session.matchId);
    const replayDoc = await getReplayDoc(ctx, session.matchId);
    const replyResult = createAgentReply({
      prompt: userPrompt,
      purpose: session.purpose,
      replaySummary: replayDoc
        ? {
            totalFrames: replayDoc.totalFrames,
          }
        : null,
      seatView: seatViewDoc ? deserializeSeatView(seatViewDoc.viewJson) : null,
      spectatorView: spectatorViewDoc
        ? deserializeSpectatorView(spectatorViewDoc.viewJson)
        : null,
    });

    await saveMessage(ctx, components.agent, {
      agentName: replyResult.agentName,
      message: {
        content: replyResult.reply,
        role: "assistant",
      },
      promptMessageId: promptSave.messageId,
      threadId: session.threadId,
      userId: user._id,
    });

    const updatedAt = Date.now();
    const latestReplyPreview = nextSessionPreview(replyResult.reply);
    await ctx.db.patch(session._id, {
      latestReplyPreview,
      updatedAt,
    });
    await updateThreadMetadata(ctx, components.agent, {
      patch: {
        summary: latestReplyPreview,
        title: session.title,
      },
      threadId: session.threadId,
    });

    const updated = await ctx.db.get(session._id);
    if (!updated) {
      throw new Error("Agent session disappeared after reply generation");
    }

    return {
      reply: replyResult.reply,
      session: toAgentLabSessionRecord(updated),
    };
  },
});
