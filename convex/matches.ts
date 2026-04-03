import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  getFormatDefinition,
  listCollectionEntriesForUser,
  validateDeckForUserCollection,
} from "./lib/library";
import {
  buildPersistedIntentResult,
  createPersistedMatch,
  deserializeMatchEvent,
  deserializeMatchShell,
  deserializeMatchState,
  deserializeSeatView,
  deserializeSpectatorView,
  seatFromEvent,
  serializeMatchEvent,
  serializeMatchPrompt,
  serializeMatchShell,
  serializeMatchState,
  serializeMatchView,
} from "./lib/matches";
import { assertUserCanEnterPlaySurface } from "./lib/participation";
import { requireViewerUser } from "./lib/viewer";

const gameplaySeatValidator = v.union(v.literal("seat-0"), v.literal("seat-1"));
const gameplayIntentValidator = v.union(
  v.object({
    intentId: v.string(),
    kind: v.literal("keepOpeningHand"),
    matchId: v.string(),
    payload: v.object({}),
    seat: gameplaySeatValidator,
    stateVersion: v.number(),
  }),
  v.object({
    intentId: v.string(),
    kind: v.literal("takeMulligan"),
    matchId: v.string(),
    payload: v.object({
      targetHandSize: v.union(v.number(), v.null()),
    }),
    seat: gameplaySeatValidator,
    stateVersion: v.number(),
  }),
  v.object({
    intentId: v.string(),
    kind: v.literal("playCard"),
    matchId: v.string(),
    payload: v.object({
      alternativeCostId: v.union(v.string(), v.null()),
      cardInstanceId: v.string(),
      sourceZone: v.union(
        v.literal("battlefield"),
        v.literal("command"),
        v.literal("deck"),
        v.literal("graveyard"),
        v.literal("hand"),
        v.literal("laneReserve"),
        v.literal("objective"),
        v.literal("sideboard"),
        v.literal("exile"),
      ),
      targetSlotId: v.union(v.string(), v.null()),
    }),
    seat: gameplaySeatValidator,
    stateVersion: v.number(),
  }),
  v.object({
    intentId: v.string(),
    kind: v.literal("passPriority"),
    matchId: v.string(),
    payload: v.object({}),
    seat: gameplaySeatValidator,
    stateVersion: v.number(),
  }),
  v.object({
    intentId: v.string(),
    kind: v.literal("toggleAutoPass"),
    matchId: v.string(),
    payload: v.object({
      enabled: v.boolean(),
    }),
    seat: gameplaySeatValidator,
    stateVersion: v.number(),
  }),
  v.object({
    intentId: v.string(),
    kind: v.literal("concede"),
    matchId: v.string(),
    payload: v.object({
      reason: v.union(
        v.literal("disconnect"),
        v.literal("manual"),
        v.literal("timeout"),
      ),
    }),
    seat: gameplaySeatValidator,
    stateVersion: v.number(),
  }),
);

async function getDeckOrThrow(
  ctx: { db: { get: (id: Id<"decks">) => Promise<Doc<"decks"> | null> } },
  deckId: Id<"decks">,
) {
  const deck = await ctx.db.get(deckId);
  if (!deck) {
    throw new Error("Deck not found");
  }
  return deck;
}

function assertDeckOwner(deck: Doc<"decks">, userId: Id<"users">) {
  if (deck.userId !== userId) {
    throw new Error("Deck not found");
  }
}

async function getMatchByStringId(
  ctx: {
    db: {
      get: (id: Id<"matches">) => Promise<Doc<"matches"> | null>;
      normalizeId: (tableName: "matches", id: string) => Id<"matches"> | null;
    };
  },
  matchId: string,
) {
  const normalized = ctx.db.normalizeId("matches", matchId);
  if (!normalized) {
    return null;
  }
  return ctx.db.get(normalized);
}

async function getMatchStateOrThrow(
  ctx: Pick<MutationCtx, "db">,
  matchId: Id<"matches">,
) {
  const snapshot = await ctx.db
    .query("matchStates")
    .withIndex("by_matchId", (query) => query.eq("matchId", matchId))
    .unique();

  if (!snapshot) {
    throw new Error("Match snapshot not found");
  }

  return snapshot;
}

async function listMatchEvents(
  ctx: Pick<MutationCtx, "db">,
  matchId: Id<"matches">,
) {
  const eventDocs = await ctx.db
    .query("matchEvents")
    .withIndex("by_matchId_and_sequence", (query) =>
      query.eq("matchId", matchId),
    )
    .order("asc")
    .collect();

  return eventDocs.map((eventDoc) => deserializeMatchEvent(eventDoc.eventJson));
}

async function listSeatViewDocs(
  ctx: Pick<MutationCtx, "db">,
  matchId: Id<"matches">,
) {
  return ctx.db
    .query("matchViews")
    .withIndex("by_matchId_and_kind", (query) =>
      query.eq("matchId", matchId).eq("kind", "seat"),
    )
    .collect();
}

async function getSpectatorViewDoc(
  ctx: Pick<MutationCtx, "db">,
  matchId: Id<"matches">,
) {
  return ctx.db
    .query("matchViews")
    .withIndex("by_matchId_and_kind", (query) =>
      query.eq("matchId", matchId).eq("kind", "spectator"),
    )
    .unique();
}

async function deletePendingPromptsForSeat(
  ctx: Pick<MutationCtx, "db">,
  input: {
    matchId: Id<"matches">;
    seat: "seat-0" | "seat-1";
  },
) {
  const promptDocs = await ctx.db
    .query("matchPrompts")
    .withIndex("by_matchId_and_ownerSeat_and_status", (query) =>
      query
        .eq("matchId", input.matchId)
        .eq("ownerSeat", input.seat)
        .eq("status", "pending"),
    )
    .collect();

  await Promise.all(
    promptDocs.map((promptDoc) => ctx.db.delete(promptDoc._id)),
  );
}

export const createPractice = mutation({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    await assertUserCanEnterPlaySurface(ctx.db, {
      actionLabel: "creating a practice match",
      userId: user._id,
    });
    const deck = await getDeckOrThrow(ctx, args.deckId);
    assertDeckOwner(deck, user._id);

    if (deck.status !== "active") {
      throw new Error("Only active decks can create matches");
    }

    const collectionEntries = await listCollectionEntriesForUser(
      ctx.db,
      user._id,
      deck.formatId,
    );
    const validation = validateDeckForUserCollection({
      collectionEntries,
      formatId: deck.formatId,
      mainboard: deck.mainboard,
      sideboard: deck.sideboard,
    });

    if (!validation.isLegal) {
      throw new Error(
        validation.issues.map((issue) => issue.message).join(" "),
      );
    }

    const now = Date.now();
    const wallet = user.primaryWalletId
      ? await ctx.db.get(user.primaryWalletId)
      : null;
    const bundle = await createPersistedMatch(ctx, {
      createdAt: now,
      format: getFormatDefinition(deck.formatId),
      participants: [
        {
          actorType: "human",
          deck: {
            mainboard: deck.mainboard,
            sideboard: deck.sideboard,
          },
          seat: "seat-0",
          userId: user._id,
          username: user.username,
          walletAddress: wallet?.address ?? null,
        },
        {
          actorType: "bot",
          deck: {
            mainboard: deck.mainboard,
            sideboard: deck.sideboard,
          },
          seat: "seat-1",
          username: "Table Bot",
        },
      ],
      status: "pending",
    });

    return bundle.shell;
  },
});

export const submitIntent = mutation({
  args: {
    intent: gameplayIntentValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const matchId = ctx.db.normalizeId("matches", args.intent.matchId);

    if (!matchId) {
      return {
        accepted: false,
        outcome: "rejected" as const,
        reason: "invalidMatch" as const,
        seatView: null,
        shell: null,
      };
    }

    const match = await ctx.db.get(matchId);
    if (!match) {
      return {
        accepted: false,
        outcome: "rejected" as const,
        reason: "invalidMatch" as const,
        seatView: null,
        shell: null,
      };
    }

    const snapshot = await getMatchStateOrThrow(ctx, matchId);
    const currentState = deserializeMatchState(snapshot.snapshotJson);
    const actingSeat = currentState.seats[args.intent.seat];

    if (!actingSeat || actingSeat.userId !== user._id) {
      return {
        accepted: false,
        outcome: "rejected" as const,
        reason: "invalidSeat" as const,
        seatView: null,
        shell: deserializeMatchShell(match.shellJson),
      };
    }

    const existingEvents = await listMatchEvents(ctx, matchId);
    const result = buildPersistedIntentResult({
      events: existingEvents,
      intent: args.intent,
      state: currentState,
    });

    const seatView =
      result.views.find((view) => view.viewerSeat === args.intent.seat)?.view ??
      null;

    if (result.transition.outcome !== "applied") {
      return {
        accepted: false,
        outcome: result.transition.outcome,
        reason: result.transition.reason ?? null,
        seatView,
        shell: result.shell,
      };
    }

    const now = Date.now();
    await ctx.db.patch(matchId, {
      activeSeat: result.shell.activeSeat ?? undefined,
      completedAt: result.shell.completedAt ?? undefined,
      createdAt: result.shell.createdAt,
      formatId: match.formatId,
      phase: result.shell.phase,
      shellJson: serializeMatchShell(result.shell),
      startedAt: result.shell.startedAt ?? undefined,
      status: result.shell.status,
      turnNumber: result.shell.turnNumber,
      updatedAt: now,
      version: result.shell.version,
      winnerSeat: result.shell.winnerSeat ?? undefined,
    });
    await ctx.db.patch(snapshot._id, {
      snapshotJson: serializeMatchState(result.state),
      updatedAt: now,
      version: result.shell.version,
    });

    for (const event of result.appendedEvents) {
      await ctx.db.insert("matchEvents", {
        at: event.at,
        eventJson: serializeMatchEvent(event),
        kind: event.kind,
        matchId,
        seat: seatFromEvent(event),
        sequence: event.sequence,
        stateVersion: event.stateVersion,
      });
    }

    const seatViewDocs = await listSeatViewDocs(ctx, matchId);
    const seatViewDocsBySeat = new Map(
      seatViewDocs
        .filter((viewDoc) => viewDoc.kind === "seat" && !!viewDoc.viewerSeat)
        .map((viewDoc) => [viewDoc.viewerSeat, viewDoc]),
    );

    for (const view of result.views) {
      const existingView = seatViewDocsBySeat.get(view.viewerSeat);
      if (existingView) {
        await ctx.db.patch(existingView._id, {
          updatedAt: now,
          viewJson: serializeMatchView(view.view),
          viewerSeat: view.viewerSeat,
          viewerUserId: view.viewerUserId ?? undefined,
        });
        continue;
      }

      await ctx.db.insert("matchViews", {
        kind: "seat",
        matchId,
        updatedAt: now,
        viewJson: serializeMatchView(view.view),
        viewerSeat: view.viewerSeat,
        viewerUserId: view.viewerUserId ?? undefined,
      });
    }

    const spectatorViewDoc = await getSpectatorViewDoc(ctx, matchId);
    if (spectatorViewDoc) {
      await ctx.db.patch(spectatorViewDoc._id, {
        updatedAt: now,
        viewJson: serializeMatchView(result.spectatorView),
      });
    } else {
      await ctx.db.insert("matchViews", {
        kind: "spectator",
        matchId,
        updatedAt: now,
        viewJson: serializeMatchView(result.spectatorView),
      });
    }

    for (const seat of ["seat-0", "seat-1"] as const) {
      await deletePendingPromptsForSeat(ctx, {
        matchId,
        seat,
      });
    }

    for (const prompt of result.state.prompts.filter(
      (matchPrompt) => matchPrompt.status === "pending",
    )) {
      await ctx.db.insert("matchPrompts", {
        kind: prompt.kind,
        matchId,
        ownerSeat: prompt.ownerSeat,
        promptId: prompt.promptId,
        promptJson: serializeMatchPrompt(prompt),
        status: "pending",
        updatedAt: now,
      });
    }

    return {
      accepted: true,
      appendedEventKinds: result.appendedEvents.map((event) => event.kind),
      outcome: result.transition.outcome,
      reason: null,
      seatView,
      shell: result.shell,
    };
  },
});

export const listMyMatches = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("complete"),
        v.literal("cancelled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const seatViews = await ctx.db
      .query("matchViews")
      .withIndex("by_viewerUserId_and_updatedAt", (query) =>
        query.eq("viewerUserId", user._id),
      )
      .order("desc")
      .take(20);

    const shellsById = new Map<
      string,
      ReturnType<typeof deserializeMatchShell>
    >();
    for (const seatView of seatViews) {
      if (seatView.kind !== "seat") {
        continue;
      }
      const shell = deserializeSeatView(seatView.viewJson).match;
      if (args.status && shell.status !== args.status) {
        continue;
      }
      shellsById.set(shell.id, shell);
    }

    return [...shellsById.values()];
  },
});

export const getShell = query({
  args: {
    matchId: v.string(),
  },
  handler: async (ctx, args) => {
    const match = await getMatchByStringId(ctx, args.matchId);
    if (!match) {
      return null;
    }

    return deserializeMatchShell(match.shellJson);
  },
});

export const getSeatView = query({
  args: {
    matchId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const normalizedMatchId = ctx.db.normalizeId("matches", args.matchId);
    if (!normalizedMatchId) {
      return null;
    }

    const seatView = await ctx.db
      .query("matchViews")
      .withIndex("by_matchId_and_viewerUserId_and_kind", (query) =>
        query
          .eq("matchId", normalizedMatchId)
          .eq("viewerUserId", user._id)
          .eq("kind", "seat"),
      )
      .unique();

    if (!seatView) {
      return null;
    }

    return deserializeSeatView(seatView.viewJson);
  },
});

export const getSpectatorView = query({
  args: {
    matchId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedMatchId = ctx.db.normalizeId("matches", args.matchId);
    if (!normalizedMatchId) {
      return null;
    }

    const spectatorView = await ctx.db
      .query("matchViews")
      .withIndex("by_matchId_and_kind", (query) =>
        query.eq("matchId", normalizedMatchId).eq("kind", "spectator"),
      )
      .unique();

    if (!spectatorView) {
      return null;
    }

    return deserializeSpectatorView(spectatorView.viewJson);
  },
});
