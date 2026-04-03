import type { BotRunnerSession } from "@lunchtable/shared-types";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
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
