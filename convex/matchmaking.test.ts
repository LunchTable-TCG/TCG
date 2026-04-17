/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { starterFormat } from "@lunchtable/card-content";
import { type TestConvex, convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
      walletId,
    };
  });
}

async function seedQueuedEntry(
  t: TestConvex<typeof schema>,
  input: {
    createdAt: number;
    deckId: Id<"decks">;
    userId: Id<"users">;
    username: string;
    walletAddress: `0x${string}`;
  },
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("queueEntries", {
      createdAt: input.createdAt,
      deckId: input.deckId,
      formatId: starterFormat.formatId,
      kind: "casual",
      status: "queued",
      updatedAt: input.createdAt,
      userId: input.userId,
      username: input.username,
      walletAddress: input.walletAddress,
    });
  });
}

describe("matchmaking backend", () => {
  it.each([
    {
      mutateOpponentDeck: async (
        t: TestConvex<typeof schema>,
        deckId: Id<"decks">,
      ) => {
        await t.run(async (ctx) => {
          await ctx.db.patch(deckId, {
            status: "archived",
            updatedAt: Date.UTC(2026, 3, 3, 13, 5, 0),
          });
        });
      },
      scenario: "the queued opponent deck is archived",
    },
    {
      mutateOpponentDeck: async (
        t: TestConvex<typeof schema>,
        deckId: Id<"decks">,
      ) => {
        await t.run(async (ctx) => {
          await ctx.db.patch(deckId, {
            mainboard: [],
            updatedAt: Date.UTC(2026, 3, 3, 13, 5, 0),
          });
        });
      },
      scenario: "the queued opponent deck is no longer legal",
    },
  ])("keeps enqueue working when $scenario", async ({ mutateOpponentDeck }) => {
    const t = convexTest({
      modules,
      schema,
    });
    const player = await seedHumanSeat(t, {
      address: "0x1111111111111111111111111111111111111111",
      email: "player@example.com",
      username: "queue_player",
    });
    const opponent = await seedHumanSeat(t, {
      address: "0x2222222222222222222222222222222222222222",
      email: "opponent@example.com",
      username: "queue_opponent",
    });
    const playerViewer = t.withIdentity({
      subject: `user:${player.userId}`,
    });
    const opponentViewer = t.withIdentity({
      subject: `user:${opponent.userId}`,
    });

    const playerDeck = await playerViewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Player Queue Deck",
      sideboard: [],
    });
    const opponentDeck = await opponentViewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Opponent Queue Deck",
      sideboard: [],
    });

    await mutateOpponentDeck(t, opponentDeck.id);
    await seedQueuedEntry(t, {
      createdAt: Date.UTC(2026, 3, 3, 13, 10, 0),
      deckId: opponentDeck.id,
      userId: opponent.userId,
      username: "queue_opponent",
      walletAddress: "0x2222222222222222222222222222222222222222",
    });

    const enqueueResult = await playerViewer.mutation(api.matchmaking.enqueue, {
      deckId: playerDeck.id,
    });
    const playerEntries = await playerViewer.query(
      api.matchmaking.listMine,
      {},
    );
    const opponentEntries = await opponentViewer.query(
      api.matchmaking.listMine,
      {},
    );

    expect(enqueueResult.match).toBeNull();
    expect(enqueueResult.entry.status).toBe("queued");
    expect(playerEntries).toEqual([
      expect.objectContaining({
        deckId: playerDeck.id,
        status: "queued",
      }),
    ]);
    expect(opponentEntries).toEqual([
      expect.objectContaining({
        deckId: opponentDeck.id,
        status: "cancelled",
      }),
    ]);
  });

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
