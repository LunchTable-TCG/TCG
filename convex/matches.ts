import {
  createMatchShellFromState,
  createSeatView,
  createSpectatorView,
} from "@lunchtable/game-core";
import type { MatchSeatId } from "@lunchtable/shared-types";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  DEFAULT_BOT_DISPLAY_NAME,
  DEFAULT_BOT_POLICY_KEY,
  DEFAULT_BOT_SLUG,
  deriveBotAssignmentStatus,
  ensureBotIdentity,
  syncBotAssignmentsForMatch,
} from "./lib/agents";
import {
  assertFormatPublishedForOperation,
  listCollectionEntriesForUser,
  loadFormatRuntime,
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
import {
  REPLAY_FRAME_SLICE_SIZE,
  appendReplayFrame,
  buildReplaySummary,
  createReplayFrame,
  createReplayFrameSlice,
  deserializeReplayFrames,
  selectReplayAnchorEvent,
} from "./lib/replays";
import { recordTelemetryEvent } from "./lib/telemetry";
import { requireOperatorUser, requireViewerUser } from "./lib/viewer";

const gameplaySeatValidator = v.union(v.literal("seat-0"), v.literal("seat-1"));
const staleRecoveryActionValidator = v.union(
  v.literal("cancel"),
  v.literal("forceConcede"),
);
const MINIMUM_STALE_RECOVERY_MS = 60 * 1000;
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
    kind: v.literal("activateAbility"),
    matchId: v.string(),
    payload: v.object({
      abilityId: v.string(),
      sourceInstanceId: v.string(),
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

async function getReplayDoc(
  ctx: Pick<MutationCtx, "db">,
  matchId: Id<"matches">,
) {
  return ctx.db
    .query("replays")
    .withIndex("by_matchId", (query) => query.eq("matchId", matchId))
    .unique();
}

async function getLastReplayFrameSliceDoc(
  ctx: Pick<MutationCtx, "db">,
  replayId: Id<"replays">,
) {
  const sliceDocs = await ctx.db
    .query("replayFrameSlices")
    .withIndex("by_replayId_and_sliceIndex", (query) =>
      query.eq("replayId", replayId),
    )
    .order("desc")
    .take(1);

  return sliceDocs[0] ?? null;
}

async function appendReplayFrameToSlices(
  ctx: Pick<MutationCtx, "db">,
  input: {
    matchId: Id<"matches">;
    now: number;
    replayDoc: Doc<"replays">;
    replayFrame: ReturnType<typeof createReplayFrame>;
  },
) {
  const lastSliceDoc = await getLastReplayFrameSliceDoc(
    ctx,
    input.replayDoc._id,
  );
  const currentFrames = lastSliceDoc
    ? deserializeReplayFrames(lastSliceDoc.framesJson)
    : deserializeReplayFrames(input.replayDoc.framesJson);
  const nextFrames = appendReplayFrame(currentFrames, input.replayFrame);

  if (nextFrames.length === currentFrames.length) {
    return {
      lastEventSequence: input.replayDoc.lastEventSequence,
      totalFrames: input.replayDoc.totalFrames,
    };
  }

  const appendedFrame = nextFrames[nextFrames.length - 1];
  if (!appendedFrame) {
    throw new Error("Replay frame append must produce a frame.");
  }

  if (lastSliceDoc && currentFrames.length < REPLAY_FRAME_SLICE_SIZE) {
    const updatedSlice = createReplayFrameSlice({
      frames: nextFrames,
      sliceIndex: lastSliceDoc.sliceIndex,
    });
    await ctx.db.patch(lastSliceDoc._id, {
      endFrameIndex: updatedSlice.endFrameIndex,
      frameCount: updatedSlice.frameCount,
      framesJson: updatedSlice.framesJson,
      startFrameIndex: updatedSlice.startFrameIndex,
      updatedAt: input.now,
    });
  } else {
    const createdSlice = createReplayFrameSlice({
      frames: [appendedFrame],
      sliceIndex: (lastSliceDoc?.sliceIndex ?? -1) + 1,
    });
    await ctx.db.insert("replayFrameSlices", {
      createdAt: input.now,
      endFrameIndex: createdSlice.endFrameIndex,
      frameCount: createdSlice.frameCount,
      framesJson: createdSlice.framesJson,
      matchId: input.matchId,
      replayId: input.replayDoc._id,
      sliceIndex: createdSlice.sliceIndex,
      startFrameIndex: createdSlice.startFrameIndex,
      updatedAt: input.now,
    });
  }

  return {
    lastEventSequence: appendedFrame.eventSequence,
    totalFrames: input.replayDoc.totalFrames + 1,
  };
}

async function deletePendingPromptsForSeat(
  ctx: Pick<MutationCtx, "db">,
  input: {
    matchId: Id<"matches">;
    seat: MatchSeatId;
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

function createAdministrativeEventFactory(
  state: ReturnType<typeof deserializeMatchState>,
  nextVersion: number,
) {
  let offset = 0;

  return function createEvent<
    TKind extends ReturnType<typeof deserializeMatchEvent>["kind"],
  >(
    kind: TKind,
    payload: Extract<
      ReturnType<typeof deserializeMatchEvent>,
      { kind: TKind }
    >["payload"],
  ): Extract<ReturnType<typeof deserializeMatchEvent>, { kind: TKind }> {
    offset += 1;
    const sequence = state.eventSequence + offset;

    return {
      at: (state.shell.startedAt ?? state.shell.createdAt) + sequence,
      eventId: `event_${sequence}`,
      kind,
      matchId: state.shell.id,
      payload,
      sequence,
      stateVersion: nextVersion,
    } as Extract<ReturnType<typeof deserializeMatchEvent>, { kind: TKind }>;
  };
}

async function persistMatchProjectionUpdate(
  ctx: Pick<MutationCtx, "db">,
  input: {
    appendedEvents: ReturnType<typeof deserializeMatchEvent>[];
    match: Doc<"matches">;
    matchId: Id<"matches">;
    now: number;
    replayOwnerUserId: Id<"users"> | null;
    shell: ReturnType<typeof deserializeMatchShell>;
    snapshot: Doc<"matchStates">;
    spectatorView: ReturnType<typeof deserializeSpectatorView>;
    state: ReturnType<typeof deserializeMatchState>;
    viewOwnerBotIntentAt?: number | null;
    views: Array<{
      viewerSeat: string;
      viewerUserId: Id<"users"> | null;
      view: ReturnType<typeof deserializeSeatView>;
    }>;
  },
) {
  await ctx.db.patch(input.matchId, {
    activeSeat: input.shell.activeSeat ?? undefined,
    completedAt: input.shell.completedAt ?? undefined,
    createdAt: input.shell.createdAt,
    formatId: input.match.formatId,
    phase: input.shell.phase,
    shellJson: serializeMatchShell(input.shell),
    startedAt: input.shell.startedAt ?? undefined,
    status: input.shell.status,
    turnNumber: input.shell.turnNumber,
    updatedAt: input.now,
    version: input.shell.version,
    winnerSeat: input.shell.winnerSeat ?? undefined,
  });
  await ctx.db.patch(input.snapshot._id, {
    snapshotJson: serializeMatchState(input.state),
    updatedAt: input.now,
    version: input.shell.version,
  });

  for (const event of input.appendedEvents) {
    await ctx.db.insert("matchEvents", {
      at: event.at,
      eventJson: serializeMatchEvent(event),
      kind: event.kind,
      matchId: input.matchId,
      seat: seatFromEvent(event),
      sequence: event.sequence,
      stateVersion: event.stateVersion,
    });
  }

  const seatViewDocs = await listSeatViewDocs(ctx, input.matchId);
  const seatViewDocsBySeat = new Map(
    seatViewDocs
      .filter((viewDoc) => viewDoc.kind === "seat" && !!viewDoc.viewerSeat)
      .map((viewDoc) => [viewDoc.viewerSeat, viewDoc]),
  );

  for (const view of input.views) {
    const existingView = seatViewDocsBySeat.get(view.viewerSeat);
    if (existingView) {
      await ctx.db.patch(existingView._id, {
        updatedAt: input.now,
        viewJson: serializeMatchView(view.view),
        viewerSeat: view.viewerSeat,
        viewerUserId: view.viewerUserId ?? undefined,
      });
      continue;
    }

    await ctx.db.insert("matchViews", {
      kind: "seat",
      matchId: input.matchId,
      updatedAt: input.now,
      viewJson: serializeMatchView(view.view),
      viewerSeat: view.viewerSeat,
      viewerUserId: view.viewerUserId ?? undefined,
    });
  }

  const spectatorViewDoc = await getSpectatorViewDoc(ctx, input.matchId);
  if (spectatorViewDoc) {
    await ctx.db.patch(spectatorViewDoc._id, {
      updatedAt: input.now,
      viewJson: serializeMatchView(input.spectatorView),
    });
  } else {
    await ctx.db.insert("matchViews", {
      kind: "spectator",
      matchId: input.matchId,
      updatedAt: input.now,
      viewJson: serializeMatchView(input.spectatorView),
    });
  }

  const replayDoc = await getReplayDoc(ctx, input.matchId);
  const replayFrame = createReplayFrame({
    event: selectReplayAnchorEvent(input.appendedEvents),
    frameIndex: replayDoc?.totalFrames ?? 0,
    view: input.spectatorView,
  });

  let replayFramePersisted = false;
  if (replayDoc) {
    const replayMeta = await appendReplayFrameToSlices(ctx, {
      matchId: input.matchId,
      now: input.now,
      replayDoc,
      replayFrame,
    });

    const replaySummary = buildReplaySummary({
      completedAt: input.shell.completedAt ?? null,
      createdAt: replayDoc.createdAt,
      formatId: replayDoc.formatId,
      lastEventSequence: replayMeta.lastEventSequence,
      matchId: input.shell.id,
      ownerUserId: replayDoc.ownerUserId ?? null,
      status: input.shell.status,
      totalFrames: replayMeta.totalFrames,
      updatedAt: input.now,
      winnerSeat: input.shell.winnerSeat ?? null,
    });

    await ctx.db.patch(replayDoc._id, {
      completedAt: replaySummary.completedAt ?? undefined,
      lastEventSequence: replaySummary.lastEventSequence,
      status: replaySummary.status,
      totalFrames: replaySummary.totalFrames,
      updatedAt: replaySummary.updatedAt,
      winnerSeat: replaySummary.winnerSeat ?? undefined,
    });
    replayFramePersisted = true;
  } else {
    const replaySummary = buildReplaySummary({
      completedAt: input.shell.completedAt ?? null,
      createdAt: input.now,
      formatId: input.match.formatId,
      lastEventSequence: replayFrame.eventSequence,
      matchId: input.shell.id,
      ownerUserId: input.replayOwnerUserId,
      status: input.shell.status,
      totalFrames: 1,
      updatedAt: input.now,
      winnerSeat: input.shell.winnerSeat ?? null,
    });

    const replayId = await ctx.db.insert("replays", {
      completedAt: replaySummary.completedAt ?? undefined,
      createdAt: replaySummary.createdAt,
      formatId: replaySummary.formatId,
      framesJson: "[]",
      lastEventSequence: replaySummary.lastEventSequence,
      matchId: input.matchId,
      ownerUserId: replaySummary.ownerUserId ?? undefined,
      status: replaySummary.status,
      totalFrames: replaySummary.totalFrames,
      updatedAt: replaySummary.updatedAt,
      winnerSeat: replaySummary.winnerSeat ?? undefined,
    });

    const replaySlice = createReplayFrameSlice({
      frames: [replayFrame],
      sliceIndex: 0,
    });
    await ctx.db.insert("replayFrameSlices", {
      createdAt: input.now,
      endFrameIndex: replaySlice.endFrameIndex,
      frameCount: replaySlice.frameCount,
      framesJson: replaySlice.framesJson,
      matchId: input.matchId,
      replayId,
      sliceIndex: replaySlice.sliceIndex,
      startFrameIndex: replaySlice.startFrameIndex,
      updatedAt: input.now,
    });
    replayFramePersisted = true;
  }

  for (const seat of Object.keys(input.state.seats) as MatchSeatId[]) {
    await deletePendingPromptsForSeat(ctx, {
      matchId: input.matchId,
      seat,
    });
  }

  for (const prompt of input.state.prompts.filter(
    (matchPrompt) => matchPrompt.status === "pending",
  )) {
    await ctx.db.insert("matchPrompts", {
      kind: prompt.kind,
      matchId: input.matchId,
      ownerSeat: prompt.ownerSeat,
      promptId: prompt.promptId,
      promptJson: serializeMatchPrompt(prompt),
      status: "pending",
      updatedAt: input.now,
    });
  }

  await syncBotAssignmentsForMatch(ctx.db, {
    completedAt: input.shell.completedAt,
    lastIntentAt: input.viewOwnerBotIntentAt ?? null,
    lastObservedVersion: input.shell.version,
    matchId: input.matchId,
    matchStatus: input.shell.status,
    updatedAt: input.now,
  });

  return {
    replayFramePersisted,
  };
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
    const deckRuntime = await loadFormatRuntime(ctx.db, deck.formatId);
    const validation = validateDeckForUserCollection({
      collectionEntries,
      runtime: deckRuntime,
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
    const botIdentity = await ensureBotIdentity(ctx.db, {
      displayName: DEFAULT_BOT_DISPLAY_NAME,
      now,
      policyKey: DEFAULT_BOT_POLICY_KEY,
      slug: DEFAULT_BOT_SLUG,
    });
    const runtime = await assertFormatPublishedForOperation(
      ctx.db,
      deck.formatId,
      "creating a practice match",
    );
    const bundle = await createPersistedMatch(ctx, {
      activeSeat: "seat-0",
      createdAt: now,
      format: runtime.format,
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
          userId: botIdentity.user._id,
          username: botIdentity.botIdentity.displayName,
        },
      ],
      startedAt: now,
      status: "active",
      turnNumber: 1,
    });
    const normalizedMatchId = ctx.db.normalizeId("matches", bundle.shell.id);
    if (!normalizedMatchId) {
      throw new Error("Failed to resolve created match");
    }

    await ctx.db.insert("botAssignments", {
      botIdentityId: botIdentity.botIdentity._id,
      botUserId: botIdentity.user._id,
      createdAt: now,
      lastObservedVersion: bundle.shell.version,
      matchId: normalizedMatchId,
      seat: "seat-1",
      status: deriveBotAssignmentStatus(bundle.shell.status),
      updatedAt: now,
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
    const telemetryBase = {
      matchId: args.intent.matchId,
      metrics: {
        requestedStateVersion: args.intent.stateVersion,
      },
      seat: args.intent.seat,
      tags: {
        intentKind: args.intent.kind,
      },
      userId: user._id,
    } as const;
    const matchId = ctx.db.normalizeId("matches", args.intent.matchId);

    if (!matchId) {
      await recordTelemetryEvent(ctx.db, {
        ...telemetryBase,
        at: Date.now(),
        name: "match.intent.rejected",
        tags: {
          ...telemetryBase.tags,
          reason: "invalidMatch",
        },
      });
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
      await recordTelemetryEvent(ctx.db, {
        ...telemetryBase,
        at: Date.now(),
        name: "match.intent.rejected",
        tags: {
          ...telemetryBase.tags,
          reason: "invalidMatch",
        },
      });
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
      await recordTelemetryEvent(ctx.db, {
        ...telemetryBase,
        at: Date.now(),
        name: "match.intent.rejected",
        tags: {
          ...telemetryBase.tags,
          reason: "invalidSeat",
        },
      });
      return {
        accepted: false,
        outcome: "rejected" as const,
        reason: "invalidSeat" as const,
        seatView: null,
        shell: deserializeMatchShell(match.shellJson),
      };
    }

    await recordTelemetryEvent(ctx.db, {
      ...telemetryBase,
      at: Date.now(),
      matchId: match._id,
      name: "match.intent.received",
      metrics: {
        currentStateVersion: currentState.shell.version,
        requestedStateVersion: args.intent.stateVersion,
      },
    });
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
      const rejectedAt = Date.now();
      await recordTelemetryEvent(ctx.db, {
        ...telemetryBase,
        at: rejectedAt,
        matchId: match._id,
        name: "match.intent.rejected",
        metrics: {
          currentStateVersion: currentState.shell.version,
          requestedStateVersion: args.intent.stateVersion,
        },
        tags: {
          ...telemetryBase.tags,
          reason: result.transition.reason ?? "unknown",
        },
      });
      if (result.transition.reason === "staleStateVersion") {
        await recordTelemetryEvent(ctx.db, {
          at: rejectedAt,
          matchId: match._id,
          metrics: {
            currentStateVersion: currentState.shell.version,
            requestedStateVersion: args.intent.stateVersion,
          },
          name: "match.sync.staleVersion",
          seat: args.intent.seat,
          tags: {
            intentKind: args.intent.kind,
          },
          userId: user._id,
        });
      }
      return {
        accepted: false,
        outcome: result.transition.outcome,
        reason: result.transition.reason ?? null,
        seatView,
        shell: result.shell,
      };
    }

    const now = Date.now();
    const persistence = await persistMatchProjectionUpdate(ctx, {
      appendedEvents: result.appendedEvents,
      match,
      matchId,
      now,
      replayOwnerUserId: user._id,
      shell: result.shell,
      snapshot,
      spectatorView: result.spectatorView,
      state: result.state,
      viewOwnerBotIntentAt: actingSeat.actorType === "bot" ? now : null,
      views: result.views,
    });
    await recordTelemetryEvent(ctx.db, {
      ...telemetryBase,
      at: now,
      matchId: match._id,
      metrics: {
        appendedEventCount: result.appendedEvents.length,
        nextStateVersion: result.shell.version,
      },
      name: "match.intent.accepted",
    });
    await recordTelemetryEvent(ctx.db, {
      at: now,
      matchId: match._id,
      metrics: {
        eventCount: result.appendedEvents.length,
        nextStateVersion: result.shell.version,
      },
      name: "match.state.persisted",
      seat: args.intent.seat,
      tags: {
        intentKind: args.intent.kind,
      },
      userId: user._id,
    });
    await recordTelemetryEvent(ctx.db, {
      at: now,
      matchId: match._id,
      metrics: {
        seatViewCount: result.views.length,
      },
      name: "match.view.published",
      seat: args.intent.seat,
      tags: {
        intentKind: args.intent.kind,
      },
      userId: user._id,
    });
    if (persistence.replayFramePersisted) {
      await recordTelemetryEvent(ctx.db, {
        at: now,
        matchId: match._id,
        metrics: {
          appendedEventCount: result.appendedEvents.length,
        },
        name: "replay.chunkPersisted",
        seat: args.intent.seat,
        tags: {
          intentKind: args.intent.kind,
        },
        userId: user._id,
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

export const recoverStaleMatch = mutation({
  args: {
    action: staleRecoveryActionValidator,
    matchId: v.string(),
    seat: v.optional(gameplaySeatValidator),
    staleAfterMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const operator = await requireOperatorUser(ctx);
    const matchId = ctx.db.normalizeId("matches", args.matchId);
    if (!matchId) {
      throw new Error("Match not found");
    }

    const match = await ctx.db.get(matchId);
    if (!match) {
      throw new Error("Match not found");
    }
    if (match.status !== "active") {
      throw new Error("Only active matches can be recovered");
    }

    const staleAfterMs = Math.max(
      args.staleAfterMs ?? 5 * 60 * 1000,
      MINIMUM_STALE_RECOVERY_MS,
    );
    const now = Date.now();
    if (now - match.updatedAt < staleAfterMs) {
      throw new Error("Match is not stale enough to recover");
    }

    const snapshot = await getMatchStateOrThrow(ctx, matchId);
    const currentState = deserializeMatchState(snapshot.snapshotJson);
    const nextState = deserializeMatchState(serializeMatchState(currentState));
    const nextVersion = currentState.shell.version + 1;
    const createEvent = createAdministrativeEventFactory(
      currentState,
      nextVersion,
    );
    const recoveredSeat =
      args.action === "forceConcede"
        ? (args.seat ?? currentState.shell.activeSeat ?? null)
        : null;

    nextState.eventSequence = currentState.eventSequence;
    nextState.shell.version = nextVersion;
    nextState.shell.completedAt = now;
    nextState.shell.activeSeat = null;
    nextState.shell.prioritySeat = null;
    nextState.shell.timers.activeDeadlineAt = null;
    nextState.shell.timers.ropeDeadlineAt = null;
    nextState.shell.timers.seatTimeRemainingMs = {};
    nextState.lastPriorityPassSeat = null;
    nextState.prompts = [];
    nextState.stack = [];

    let appendedEvents: ReturnType<typeof deserializeMatchEvent>[] = [];
    let outcome: "cancelled" | "forcedConcession" = "cancelled";

    if (args.action === "cancel") {
      nextState.shell.status = "cancelled";
      nextState.shell.winnerSeat = null;
      appendedEvents = [
        createEvent("matchCompleted", {
          reason: "administrative",
          winnerSeat: null,
        }),
      ];
    } else {
      if (!recoveredSeat || !(recoveredSeat in nextState.seats)) {
        throw new Error("A valid seat is required for forced concession");
      }

      const losingSeat = nextState.seats[recoveredSeat];
      const winnerSeat = recoveredSeat === "seat-0" ? "seat-1" : "seat-0";
      losingSeat.status = "conceded";
      nextState.shell.status = "complete";
      nextState.shell.winnerSeat = winnerSeat;
      outcome = "forcedConcession";
      appendedEvents = [
        createEvent("playerConceded", {
          reason: "timeout",
          seat: recoveredSeat,
        }),
        createEvent("matchCompleted", {
          reason: "administrative",
          winnerSeat,
        }),
      ];
    }

    const lastEvent = appendedEvents.at(-1);
    nextState.eventSequence = lastEvent?.sequence ?? nextState.eventSequence;
    const shell = createMatchShellFromState(nextState);
    const spectatorView = createSpectatorView(nextState, appendedEvents);
    const views = (["seat-0", "seat-1"] as const).map((seat) => {
      const seatState = nextState.seats[seat];
      return {
        viewerSeat: seat,
        viewerUserId: seatState.userId,
        view: createSeatView(nextState, seat, appendedEvents),
      };
    });

    const persistence = await persistMatchProjectionUpdate(ctx, {
      appendedEvents,
      match,
      matchId,
      now,
      replayOwnerUserId: operator._id,
      shell,
      snapshot,
      spectatorView,
      state: nextState,
      views,
    });
    await recordTelemetryEvent(ctx.db, {
      at: now,
      matchId: match._id,
      metrics: {
        appendedEventCount: appendedEvents.length,
        idleMs: now - match.updatedAt,
      },
      name: "match.recovery.completed",
      seat: recoveredSeat ?? undefined,
      tags: {
        action: args.action,
        outcome,
      },
      userId: operator._id,
    });
    if (persistence.replayFramePersisted) {
      await recordTelemetryEvent(ctx.db, {
        at: now,
        matchId: match._id,
        metrics: {
          appendedEventCount: appendedEvents.length,
        },
        name: "replay.chunkPersisted",
        seat: recoveredSeat ?? undefined,
        tags: {
          intentKind: "recovery",
        },
        userId: operator._id,
      });
    }

    return {
      appendedEventKinds: appendedEvents.map((event) => event.kind),
      match: shell,
      outcome,
      recoveredSeat,
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
