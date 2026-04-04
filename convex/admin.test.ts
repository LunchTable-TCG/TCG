/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { starterFormat } from "@lunchtable/card-content";
import { type TestConvex, convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const operatorAllowlistEnv = "OPERATOR_EMAIL_ALLOWLIST";

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
  const now = Date.UTC(2026, 3, 3, 12, 30, 0);

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
    };
  });
}

async function markMatchStale(
  t: TestConvex<typeof schema>,
  input: {
    matchId: string;
    updatedAt: number;
  },
) {
  await t.run(async (ctx) => {
    const normalizedMatchId = ctx.db.normalizeId("matches", input.matchId);
    if (!normalizedMatchId) {
      throw new Error("Match id failed to normalize");
    }

    await ctx.db.patch(normalizedMatchId, {
      updatedAt: input.updatedAt,
    });
  });
}

afterEach(() => {
  delete process.env[operatorAllowlistEnv];
});

describe("admin backend", () => {
  it("rejects non-operator viewers from format controls", async () => {
    const t = convexTest({
      modules,
      schema,
    });
    const { userId } = await seedHumanSeat(t, {
      address: "0x3333333333333333333333333333333333333333",
      email: "player@example.com",
      username: "player_one",
    });
    const viewer = t.withIdentity({
      subject: `user:${userId}`,
    });

    process.env[operatorAllowlistEnv] = "operator@example.com";

    await expect(
      viewer.query(api.admin.listFormatSettings, {}),
    ).rejects.toThrow("Operator access required");
  }, 15_000);

  it("normalizes runtime format overrides and blocks unpublished play", async () => {
    const t = convexTest({
      modules,
      schema,
    });
    const { userId } = await seedHumanSeat(t, {
      address: "0x4444444444444444444444444444444444444444",
      email: "operator@example.com",
      username: "table_operator",
    });
    const viewer = t.withIdentity({
      subject: `user:${userId}`,
    });

    process.env[operatorAllowlistEnv] = "operator@example.com";

    const deck = await viewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Operator Starter",
      sideboard: [],
    });
    const updated = await viewer.mutation(api.admin.updateFormatSettings, {
      bannedCardIds: ["mirror-warden", "unknown-card", "mirror-warden"],
      formatId: starterFormat.formatId,
      isPublished: true,
    });
    const bannedCatalog = await viewer.query(api.cards.listCatalog, {
      formatId: starterFormat.formatId,
    });
    const unpublished = await viewer.mutation(api.admin.updateFormatSettings, {
      bannedCardIds: [],
      formatId: starterFormat.formatId,
      isPublished: false,
    });
    const settings = await viewer.query(api.admin.listFormatSettings, {});
    const catalog = await viewer.query(api.cards.listCatalog, {
      formatId: starterFormat.formatId,
    });
    const viewerIdentity = await viewer.query(api.viewer.get, {});

    expect(updated.bannedCardIds).toEqual(["mirror-warden"]);
    expect(updated.isPublished).toBe(true);
    expect(unpublished.bannedCardIds).toEqual([]);
    expect(unpublished.isPublished).toBe(false);
    expect(settings).toEqual([unpublished]);
    expect(
      bannedCatalog.find((card) => card.cardId === "mirror-warden")?.isBanned,
    ).toBe(true);
    expect(
      catalog.find((card) => card.cardId === "mirror-warden")?.isBanned,
    ).toBe(false);
    expect(viewerIdentity?.isOperator).toBe(true);
    await expect(viewer.query(api.admin.listTelemetry, {})).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ops.format.updated",
        }),
      ]),
    );
    await expect(
      viewer.mutation(api.matches.createPractice, {
        deckId: deck.id,
      }),
    ).rejects.toThrow("not currently published");
  }, 15_000);

  it("lists stale matches and lets an operator force concession or cancel them", async () => {
    const t = convexTest({
      modules,
      schema,
    });
    const { userId } = await seedHumanSeat(t, {
      address: "0x5555555555555555555555555555555555555555",
      email: "operator@example.com",
      username: "table_recovery_operator",
    });
    const viewer = t.withIdentity({
      subject: `user:${userId}`,
    });

    process.env[operatorAllowlistEnv] = "operator@example.com";

    const deck = await viewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Recovery Starter",
      sideboard: [],
    });
    const shell = await viewer.mutation(api.matches.createPractice, {
      deckId: deck.id,
    });
    await markMatchStale(t, {
      matchId: shell.id,
      updatedAt: Date.UTC(2026, 3, 3, 8, 0, 0),
    });

    const staleMatches = await viewer.query(api.admin.listRecoverableMatches, {
      staleAfterMs: 60_000,
    });

    expect(staleMatches).toEqual([
      expect.objectContaining({
        latestEventKind: "promptOpened",
        match: expect.objectContaining({
          id: shell.id,
          status: "active",
        }),
        pendingPromptCount: 2,
      }),
    ]);

    const forced = await viewer.mutation(api.matches.recoverStaleMatch, {
      action: "forceConcede",
      matchId: shell.id,
      seat: "seat-0",
      staleAfterMs: 60_000,
    });
    const recoveredShell = await viewer.query(api.matches.getShell, {
      matchId: shell.id,
    });
    const telemetry = await viewer.query(api.admin.listTelemetry, {
      matchId: shell.id,
    });

    expect(forced.outcome).toBe("forcedConcession");
    expect(forced.appendedEventKinds).toEqual([
      "playerConceded",
      "matchCompleted",
    ]);
    expect(recoveredShell?.status).toBe("complete");
    expect(recoveredShell?.winnerSeat).toBe("seat-1");
    expect(
      telemetry.some((event) => event.name === "match.recovery.completed"),
    ).toBe(true);
    expect(
      telemetry.some((event) => event.name === "replay.chunkPersisted"),
    ).toBe(true);

    const cancelDeck = await viewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Recovery Cancel Starter",
      sideboard: [],
    });
    const cancelShell = await viewer.mutation(api.matches.createPractice, {
      deckId: cancelDeck.id,
    });
    await markMatchStale(t, {
      matchId: cancelShell.id,
      updatedAt: Date.UTC(2026, 3, 3, 7, 0, 0),
    });

    const cancelled = await viewer.mutation(api.matches.recoverStaleMatch, {
      action: "cancel",
      matchId: cancelShell.id,
      staleAfterMs: 60_000,
    });
    const cancelledShell = await viewer.query(api.matches.getShell, {
      matchId: cancelShell.id,
    });

    expect(cancelled.outcome).toBe("cancelled");
    expect(cancelled.recoveredSeat).toBeNull();
    expect(cancelledShell?.status).toBe("cancelled");
    await expect(
      viewer.query(api.admin.listRecoverableMatches, {
        staleAfterMs: 60_000,
      }),
    ).resolves.toEqual([]);
  }, 15_000);
});
