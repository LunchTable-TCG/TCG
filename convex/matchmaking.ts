import type { QueueMutationResult } from "@lunchtable/shared-types";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  type DatabaseReader,
  type DatabaseWriter,
  mutation,
  query,
} from "./_generated/server";
import {
  assertFormatPublishedForOperation,
  listCollectionEntriesForUser,
  loadFormatRuntime,
  validateDeckForUserCollection,
} from "./lib/library";
import { createPersistedMatch, deserializeMatchShell } from "./lib/matches";
import {
  assertUserCanEnterPlaySurface,
  hasBlockingMatchmakingParticipation,
} from "./lib/participation";
import {
  compareQueueOrder,
  pickQueueOpponent,
  toQueueEntryRecord,
} from "./lib/play";
import { requireViewerUser } from "./lib/viewer";

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

async function assertPlayableDeck(
  ctx: {
    db: {
      get: (id: Id<"decks">) => Promise<Doc<"decks"> | null>;
    };
  },
  input: {
    deckId: Id<"decks">;
    userId: Id<"users">;
  },
) {
  const deck = await getDeckOrThrow(ctx, input.deckId);
  if (deck.userId !== input.userId) {
    throw new Error("Deck not found");
  }
  if (deck.status !== "active") {
    throw new Error("Only active decks can enter the queue");
  }
  return deck;
}

async function getLegalDeckValidation(
  ctx: {
    db: DatabaseReader | DatabaseWriter;
  },
  input: {
    deck: Doc<"decks">;
    userId: Id<"users">;
    username: string;
  },
) {
  const runtime = await loadFormatRuntime(ctx.db, input.deck.formatId);
  const collectionEntries = await listCollectionEntriesForUser(
    ctx.db,
    input.userId,
    input.deck.formatId,
  );
  return validateDeckForUserCollection({
    collectionEntries,
    runtime,
    mainboard: input.deck.mainboard,
    sideboard: input.deck.sideboard,
  });
}

async function assertLegalDeckForUser(
  ctx: {
    db: DatabaseReader | DatabaseWriter;
  },
  input: {
    deck: Doc<"decks">;
    userId: Id<"users">;
    username: string;
  },
) {
  const validation = await getLegalDeckValidation(ctx, input);
  if (!validation.isLegal) {
    throw new Error(`${input.username} does not have a legal active deck`);
  }
}

async function getWalletAddress(
  ctx: {
    db: {
      get: (id: Id<"wallets">) => Promise<Doc<"wallets"> | null>;
    };
  },
  walletId: Id<"wallets"> | undefined,
) {
  if (!walletId) {
    return null;
  }
  const wallet = await ctx.db.get(walletId);
  return wallet?.address ?? null;
}

async function getPlayableDeckForUser(
  ctx: {
    db: {
      get: (id: Id<"decks">) => Promise<Doc<"decks"> | null>;
    };
  },
  input: {
    deckId: Id<"decks">;
    userId: Id<"users">;
  },
) {
  const deck = await ctx.db.get(input.deckId);
  if (!deck || deck.userId !== input.userId || deck.status !== "active") {
    return null;
  }

  return deck;
}

function toQueueResult(
  entry: Doc<"queueEntries">,
  match: Doc<"matches"> | null,
): QueueMutationResult {
  return {
    entry: toQueueEntryRecord(entry),
    match: match ? deserializeMatchShell(match.shellJson) : null,
  };
}

export const listMine = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("matched"),
        v.literal("cancelled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const entries = await ctx.db
      .query("queueEntries")
      .withIndex("by_userId_and_updatedAt", (index) =>
        index.eq("userId", user._id),
      )
      .order("desc")
      .take(20);

    return entries
      .filter((entry) => !args.status || entry.status === args.status)
      .map(toQueueEntryRecord);
  },
});

export const enqueue = mutation({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    await assertUserCanEnterPlaySurface(ctx.db, {
      actionLabel: "entering the casual queue",
      userId: user._id,
    });

    const deck = await assertPlayableDeck(ctx, {
      deckId: args.deckId,
      userId: user._id,
    });
    const runtime = await assertFormatPublishedForOperation(
      ctx.db,
      deck.formatId,
      "entering the casual queue",
    );
    await assertLegalDeckForUser(ctx, {
      deck,
      userId: user._id,
      username: user.username,
    });

    const now = Date.now();
    const walletAddress = await getWalletAddress(ctx, user.primaryWalletId);
    const entryId = await ctx.db.insert("queueEntries", {
      createdAt: now,
      deckId: deck._id,
      formatId: deck.formatId,
      kind: "casual",
      status: "queued",
      updatedAt: now,
      userId: user._id,
      username: user.username,
      walletAddress: walletAddress ?? undefined,
    });

    const queuedEntries = await ctx.db
      .query("queueEntries")
      .withIndex("by_status_format_createdAt", (index) =>
        index.eq("status", "queued").eq("formatId", deck.formatId),
      )
      .collect();

    const opponentEntry = pickQueueOpponent(queuedEntries, user._id);
    const currentEntry = await ctx.db.get(entryId);
    if (!currentEntry) {
      throw new Error("Queue entry missing after enqueue");
    }
    if (!opponentEntry) {
      return toQueueResult(currentEntry, null);
    }

    const opponentDeck = await getPlayableDeckForUser(ctx, {
      deckId: opponentEntry.deckId,
      userId: opponentEntry.userId,
    });
    if (!opponentDeck) {
      await ctx.db.patch(opponentEntry._id, {
        status: "cancelled",
        updatedAt: Date.now(),
      });
      return toQueueResult(currentEntry, null);
    }
    if (
      await hasBlockingMatchmakingParticipation(ctx.db, opponentEntry.userId)
    ) {
      await ctx.db.patch(opponentEntry._id, {
        status: "cancelled",
        updatedAt: Date.now(),
      });
      return toQueueResult(currentEntry, null);
    }

    const opponentValidation = await getLegalDeckValidation(ctx, {
      deck: opponentDeck,
      userId: opponentEntry.userId,
      username: opponentEntry.username,
    });
    if (!opponentValidation.isLegal) {
      await ctx.db.patch(opponentEntry._id, {
        status: "cancelled",
        updatedAt: Date.now(),
      });
      return toQueueResult(currentEntry, null);
    }

    const orderedEntries = [currentEntry, opponentEntry].sort(
      compareQueueOrder,
    );
    const createdAt = Date.now();
    const bundle = await createPersistedMatch(ctx, {
      activeSeat: "seat-0",
      createdAt,
      format: runtime.format,
      participants: [
        {
          actorType: "human",
          deck: {
            mainboard:
              orderedEntries[0]._id === currentEntry._id
                ? deck.mainboard
                : opponentDeck.mainboard,
            sideboard:
              orderedEntries[0]._id === currentEntry._id
                ? deck.sideboard
                : opponentDeck.sideboard,
          },
          seat: "seat-0",
          userId: orderedEntries[0].userId,
          username: orderedEntries[0].username,
          walletAddress: orderedEntries[0].walletAddress ?? null,
        },
        {
          actorType: "human",
          deck: {
            mainboard:
              orderedEntries[1]._id === currentEntry._id
                ? deck.mainboard
                : opponentDeck.mainboard,
            sideboard:
              orderedEntries[1]._id === currentEntry._id
                ? deck.sideboard
                : opponentDeck.sideboard,
          },
          seat: "seat-1",
          userId: orderedEntries[1].userId,
          username: orderedEntries[1].username,
          walletAddress: orderedEntries[1].walletAddress ?? null,
        },
      ],
      startedAt: createdAt,
      status: "active",
      turnNumber: 1,
    });

    const matchId = ctx.db.normalizeId("matches", bundle.shell.id);
    await Promise.all([
      ctx.db.patch(currentEntry._id, {
        matchId: matchId ?? undefined,
        status: "matched",
        updatedAt: createdAt,
      }),
      ctx.db.patch(opponentEntry._id, {
        matchId: matchId ?? undefined,
        status: "matched",
        updatedAt: createdAt,
      }),
    ]);

    const nextEntry = await ctx.db.get(entryId);
    const match = matchId ? await ctx.db.get(matchId) : null;
    if (!nextEntry) {
      throw new Error("Queue entry missing after pairing");
    }
    return toQueueResult(nextEntry, match);
  },
});

export const dequeue = mutation({
  args: {
    entryId: v.id("queueEntries"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.userId !== user._id) {
      throw new Error("Queue entry not found");
    }

    if (entry.status === "queued") {
      await ctx.db.patch(entry._id, {
        status: "cancelled",
        updatedAt: Date.now(),
      });
    }

    const nextEntry = await ctx.db.get(entry._id);
    if (!nextEntry) {
      throw new Error("Queue entry missing after dequeue");
    }
    const match = nextEntry.matchId
      ? await ctx.db.get(nextEntry.matchId)
      : null;
    return toQueueResult(nextEntry, match);
  },
});
