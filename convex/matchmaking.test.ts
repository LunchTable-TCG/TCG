/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { starterFormat } from "@lunchtable/card-content";
import { type TestConvex, convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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
    };
  });
}

describe("matchmaking backend", () => {
  it("cancels a stale queued opponent deck without swallowing unrelated errors", async () => {
    const t = convexTest({
      modules,
      schema,
    });
    const challenger = await seedHumanSeat(t, {
      address: "0x6666666666666666666666666666666666666666",
      email: "challenger@example.com",
      username: "queue_challenger",
    });
    const opponent = await seedHumanSeat(t, {
      address: "0x7777777777777777777777777777777777777777",
      email: "opponent@example.com",
      username: "queue_opponent",
    });
    const challengerViewer = t.withIdentity({
      subject: `user:${challenger.userId}`,
    });
    const opponentViewer = t.withIdentity({
      subject: `user:${opponent.userId}`,
    });

    const challengerDeck = await challengerViewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Challenger Starter",
      sideboard: [],
    });
    const opponentDeck = await opponentViewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Opponent Starter",
      sideboard: [],
    });

    const opponentQueue = await opponentViewer.mutation(
      api.matchmaking.enqueue,
      {
        deckId: opponentDeck.id,
      },
    );
    expect(opponentQueue.match).toBeNull();
    expect(opponentQueue.entry.status).toBe("queued");

    await opponentViewer.mutation(api.decks.archive, {
      deckId: opponentDeck.id,
    });

    const challengerQueue = await challengerViewer.mutation(
      api.matchmaking.enqueue,
      {
        deckId: challengerDeck.id,
      },
    );
    expect(challengerQueue.match).toBeNull();
    expect(challengerQueue.entry.status).toBe("queued");

    const opponentEntries = await opponentViewer.query(
      api.matchmaking.listMine,
      {
        status: "cancelled",
      },
    );
    expect(opponentEntries).toEqual([
      expect.objectContaining({
        id: opponentQueue.entry.id,
        status: "cancelled",
      }),
    ]);
  }, 15_000);
});
