/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { starterFormat } from "@lunchtable/card-content";
import { type TestConvex, convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";

import { api } from "./_generated/api";
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
});
