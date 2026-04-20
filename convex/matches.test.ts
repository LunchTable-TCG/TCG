/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { createGameState } from "@lunchtable/game-core";
import { starterFormat } from "@lunchtable/card-content";
import { type TestConvex, convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { deserializeMatchState, serializeMatchState } from "./lib/matches";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const operatorAllowlistEnv = "OPERATOR_EMAIL_ALLOWLIST";

afterEach(() => {
  delete process.env[operatorAllowlistEnv];
});

function createStarterDeckEntries() {
  return starterFormat.cardPool.map((card) => ({
    cardId: card.id,
    count: starterFormat.deckRules.maxCopies,
  }));
}

async function seedHumanSeat(
  t: TestConvex<typeof schema>,
  input: {
    address: `0x${string}`;
    email: string;
    username: string;
  },
) {
  const now = Date.UTC(2026, 3, 3, 12, 0, 0);

  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      actorType: "human",
      email: input.email,
      emailNormalized: input.email.toLowerCase(),
      status: "active",
      updatedAt: now,
      username: input.username,
      usernameNormalized: input.username.toLowerCase(),
    });
    const walletId = await ctx.db.insert("wallets", {
      address: input.address,
      addressNormalized: input.address.toLowerCase(),
      chainId: 56,
      custodyModel: "self-custodied",
      userId,
      walletType: "evm-local",
    });

    await ctx.db.patch(userId, {
      primaryWalletId: walletId,
    });

    return {
      userId,
      walletId,
    };
  });
}

describe("matches backend", () => {
  it("normalizes legacy snapshots that predate runtime array fields", () => {
    const state = createGameState({
      matchId: "match_legacy_snapshot",
      seed: "seed:legacy-snapshot",
      status: "active",
    });

    state.prompts = [
      {
        choiceIds: ["keep"],
        expiresAt: null,
        kind: "choice",
        message: "Choose a legacy option.",
        ownerSeat: "seat-0",
        promptId: "prompt:legacy",
        resolvedChoiceIds: [],
        status: "pending",
      },
    ];
    state.stack = [
      {
        abilityId: null,
        cardId: "legacy-spell",
        controllerSeat: "seat-0",
        destinationZone: "graveyard",
        effects: [],
        kind: "castCard",
        label: "Legacy stack object",
        originZone: "hand",
        sourceInstanceId: "seat-0:legacy-spell:hand:1",
        stackId: "stack:legacy:1",
        status: "pending",
        targetIds: ["seat-1"],
      },
    ];
    const legacySnapshot = JSON.parse(serializeMatchState(state)) as Record<
      string,
      unknown
    >;
    delete legacySnapshot.continuousEffects;
    delete (legacySnapshot.prompts as Array<Record<string, unknown>>)[0]
      .choiceIds;
    delete (legacySnapshot.prompts as Array<Record<string, unknown>>)[0]
      .resolvedChoiceIds;
    delete (legacySnapshot.stack as Array<Record<string, unknown>>)[0]
      .targetIds;

    const normalized = deserializeMatchState(JSON.stringify(legacySnapshot));
    const reparsed = JSON.parse(serializeMatchState(normalized)) as Record<
      string,
      unknown
    >;

    expect(normalized.continuousEffects).toEqual([]);
    expect(normalized.prompts[0]?.choiceIds).toEqual([]);
    expect(normalized.prompts[0]?.resolvedChoiceIds).toEqual([]);
    expect(normalized.stack[0]?.targetIds).toEqual([]);
    expect(reparsed.continuousEffects).toEqual([]);
    expect(
      (reparsed.prompts as Array<Record<string, unknown>>)[0]?.choiceIds,
    ).toEqual([]);
    expect(
      (reparsed.stack as Array<Record<string, unknown>>)[0]?.targetIds,
    ).toEqual([]);
  });

  it("creates a practice match and preserves hidden information between seat and spectator views", async () => {
    const t = convexTest({
      modules,
      schema,
    });
    const { userId } = await seedHumanSeat(t, {
      address: "0x1111111111111111111111111111111111111111",
      email: "phase17@example.com",
      username: "phase17_mage",
    });
    const viewer = t.withIdentity({
      subject: `user:${userId}`,
    });

    const deck = await viewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Phase 17 Starter",
      sideboard: [],
    });
    const shell = await viewer.mutation(api.matches.createPractice, {
      deckId: deck.id,
    });
    const seatView = await viewer.query(api.matches.getSeatView, {
      matchId: shell.id,
    });
    const spectatorView = await t.query(api.matches.getSpectatorView, {
      matchId: shell.id,
    });
    const replaySummary = await t.query(api.replays.getSummary, {
      matchId: shell.id,
    });

    expect(shell.status).toBe("active");
    expect(shell.phase).toBe("mulligan");
    expect(seatView?.prompt?.kind).toBe("mulligan");
    expect(seatView?.availableIntents).toEqual([
      "keepOpeningHand",
      "takeMulligan",
      "toggleAutoPass",
      "concede",
    ]);
    expect(
      seatView?.zones.find(
        (zone) => zone.ownerSeat === "seat-0" && zone.zone === "deck",
      )?.cards,
    ).toHaveLength(41);
    expect(
      spectatorView?.zones.find(
        (zone) => zone.ownerSeat === "seat-0" && zone.zone === "deck",
      )?.cards,
    ).toHaveLength(0);
    expect(
      spectatorView?.zones.find(
        (zone) => zone.ownerSeat === "seat-0" && zone.zone === "deck",
      )?.cardCount,
    ).toBe(41);
    expect(replaySummary?.totalFrames).toBe(1);
  }, 15_000);

  it("persists an accepted gameplay intent into seat views and replay checkpoints", async () => {
    const t = convexTest({
      modules,
      schema,
    });
    const { userId } = await seedHumanSeat(t, {
      address: "0x2222222222222222222222222222222222222222",
      email: "operator@example.com",
      username: "phase17_submit",
    });
    const viewer = t.withIdentity({
      subject: `user:${userId}`,
    });
    process.env[operatorAllowlistEnv] = "operator@example.com";
    const deck = await viewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Phase 17 Submit Starter",
      sideboard: [],
    });
    const shell = await viewer.mutation(api.matches.createPractice, {
      deckId: deck.id,
    });
    const initialSeatView = await viewer.query(api.matches.getSeatView, {
      matchId: shell.id,
    });
    if (!initialSeatView) {
      throw new Error("Expected seat view after creating practice match");
    }

    const submitResult = await viewer.mutation(api.matches.submitIntent, {
      intent: {
        intentId: "phase17_keep_opening_hand",
        kind: "keepOpeningHand",
        matchId: shell.id,
        payload: {},
        seat: "seat-0",
        stateVersion: initialSeatView.match.version,
      },
    });
    const nextSeatView = await viewer.query(api.matches.getSeatView, {
      matchId: shell.id,
    });
    const staleResult = await viewer.mutation(api.matches.submitIntent, {
      intent: {
        intentId: "phase17_keep_opening_hand_stale",
        kind: "keepOpeningHand",
        matchId: shell.id,
        payload: {},
        seat: "seat-0",
        stateVersion: initialSeatView.match.version,
      },
    });
    const replaySummary = await t.query(api.replays.getSummary, {
      matchId: shell.id,
    });
    const telemetry = await viewer.query(api.admin.listTelemetry, {
      matchId: shell.id,
      limit: 12,
    });

    expect(submitResult.accepted).toBe(true);
    expect(submitResult.appendedEventKinds).toEqual([
      "openingHandKept",
      "promptResolved",
    ]);
    expect(staleResult.accepted).toBe(false);
    expect(staleResult.reason).toBe("staleStateVersion");
    expect(nextSeatView?.match.version).toBe(initialSeatView.match.version + 1);
    expect(nextSeatView?.prompt).toBeNull();
    expect(replaySummary?.totalFrames).toBe(2);
    expect(telemetry.map((event) => event.name)).toEqual(
      expect.arrayContaining([
        "match.intent.received",
        "match.intent.accepted",
        "match.intent.rejected",
        "match.state.persisted",
        "match.view.published",
        "match.sync.staleVersion",
        "replay.chunkPersisted",
      ]),
    );
  }, 15_000);

  it("persists concession completion into the live shell and replay summary", async () => {
    const t = convexTest({
      modules,
      schema,
    });
    const { userId } = await seedHumanSeat(t, {
      address: "0x3333333333333333333333333333333333333333",
      email: "phase17-concede@example.com",
      username: "phase17_concede",
    });
    const viewer = t.withIdentity({
      subject: `user:${userId}`,
    });

    const deck = await viewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Phase 17 Concede Starter",
      sideboard: [],
    });
    const shell = await viewer.mutation(api.matches.createPractice, {
      deckId: deck.id,
    });

    const concedeResult = await viewer.mutation(api.matches.submitIntent, {
      intent: {
        intentId: "phase17_concede_match",
        kind: "concede",
        matchId: shell.id,
        payload: {
          reason: "manual",
        },
        seat: "seat-0",
        stateVersion: shell.version,
      },
    });
    const nextShell = await viewer.query(api.matches.getShell, {
      matchId: shell.id,
    });
    const replaySummary = await t.query(api.replays.getSummary, {
      matchId: shell.id,
    });

    expect(concedeResult.accepted).toBe(true);
    expect(concedeResult.appendedEventKinds).toEqual([
      "playerConceded",
      "matchCompleted",
    ]);
    expect(concedeResult.shell?.status).toBe("complete");
    expect(concedeResult.shell?.winnerSeat).toBe("seat-1");
    expect(nextShell?.status).toBe("complete");
    expect(nextShell?.winnerSeat).toBe("seat-1");
    expect(replaySummary?.status).toBe("complete");
    expect(replaySummary?.winnerSeat).toBe("seat-1");
    expect(replaySummary?.totalFrames).toBe(2);
  }, 15_000);

  it("creates a private lobby match against a bot guest and records a live bot assignment", async () => {
    const t = convexTest({
      modules,
      schema,
    });
    const { userId } = await seedHumanSeat(t, {
      address: "0x4444444444444444444444444444444444444444",
      email: "phase17-lobby-bot@example.com",
      username: "phase17_lobby_bot",
    });
    const viewer = t.withIdentity({
      subject: `user:${userId}`,
    });

    const deck = await viewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Phase 17 Lobby Bot Starter",
      sideboard: [],
    });
    const createdLobby = await viewer.mutation(api.lobbies.createPrivate, {
      deckId: deck.id,
    });
    const botLobby = await viewer.mutation(api.lobbies.addBotGuest, {
      lobbyId: createdLobby.lobby.id,
    });
    const readyResult = await viewer.mutation(api.lobbies.setReady, {
      lobbyId: createdLobby.lobby.id,
      ready: true,
    });

    if (!readyResult.match) {
      throw new Error("Expected a match after readying the bot lobby");
    }
    const createdMatch = readyResult.match;

    const hostSeatView = await viewer.query(api.matches.getSeatView, {
      matchId: createdMatch.id,
    });
    const assignmentDocs = await t.run(async (ctx) => {
      const matchId = ctx.db.normalizeId("matches", createdMatch.id);
      if (!matchId) {
        throw new Error("Expected normalized match id for bot lobby test");
      }

      return ctx.db
        .query("botAssignments")
        .withIndex("by_matchId", (query) => query.eq("matchId", matchId))
        .collect();
    });

    expect(botLobby.lobby.participants).toHaveLength(2);
    expect(botLobby.lobby.participants[1]?.actorType).toBe("bot");
    expect(botLobby.lobby.participants[1]?.ready).toBe(true);
    expect(botLobby.lobby.participants[1]?.username).toBe("Table Bot");
    expect(createdMatch.status).toBe("active");
    expect(readyResult.lobby.matchId).toBe(createdMatch.id);
    expect(
      hostSeatView?.match.seats.find((seat) => seat.seat === "seat-1")
        ?.actorType,
    ).toBe("bot");
    expect(assignmentDocs).toHaveLength(1);
    expect(assignmentDocs[0]?.seat).toBe("seat-1");
    expect(assignmentDocs[0]?.status).toBe("active");
  }, 15_000);
});
