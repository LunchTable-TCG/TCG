import type { DeckCardEntry } from "@lunchtable/shared-types";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  assertFormatPublishedForOperation,
  ensureStarterCollectionEntries,
  listCollectionEntriesForUser,
  loadFormatRuntime,
  toDeckRecord,
  validateDeckForUserCollection,
} from "./lib/library";
import { requireViewerUser } from "./lib/viewer";

const deckCardEntryValidator = v.object({
  cardId: v.string(),
  count: v.number(),
});

function normalizeDeckEntries(entries: DeckCardEntry[]): DeckCardEntry[] {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const nextCount = (counts.get(entry.cardId) ?? 0) + entry.count;
    counts.set(entry.cardId, nextCount);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cardId, count]) => ({
      cardId,
      count,
    }));
}

function normalizeDeckName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Deck name is required");
  }
  return trimmed;
}

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

export const list = query({
  args: {
    formatId: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const status = args.status;
    const collectionEntriesByFormat = new Map<
      string,
      Awaited<ReturnType<typeof listCollectionEntriesForUser>>
    >();
    const formatRuntimeById = new Map<
      string,
      Awaited<ReturnType<typeof loadFormatRuntime>>
    >();
    const baseQuery = status
      ? ctx.db
          .query("decks")
          .withIndex("by_user_status_updated", (query) =>
            query.eq("userId", user._id).eq("status", status),
          )
      : ctx.db
          .query("decks")
          .withIndex("by_user_updated", (query) =>
            query.eq("userId", user._id),
          );

    const decks = await baseQuery.order("desc").collect();
    const filteredDecks = args.formatId
      ? decks.filter((deck) => deck.formatId === args.formatId)
      : decks;

    return Promise.all(
      filteredDecks.map(async (deck) => {
        let collectionEntries = collectionEntriesByFormat.get(deck.formatId);
        if (!collectionEntries) {
          collectionEntries = await listCollectionEntriesForUser(
            ctx.db,
            user._id,
            deck.formatId,
          );
          collectionEntriesByFormat.set(deck.formatId, collectionEntries);
        }
        let runtime = formatRuntimeById.get(deck.formatId);
        if (!runtime) {
          runtime = await loadFormatRuntime(ctx.db, deck.formatId);
          formatRuntimeById.set(deck.formatId, runtime);
        }
        const validation = validateDeckForUserCollection({
          collectionEntries,
          runtime,
          mainboard: deck.mainboard,
          sideboard: deck.sideboard,
        });

        return toDeckRecord(deck, validation);
      }),
    );
  },
});

export const validate = query({
  args: {
    formatId: v.string(),
    mainboard: v.array(deckCardEntryValidator),
    sideboard: v.array(deckCardEntryValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const [collectionEntries, runtime] = await Promise.all([
      listCollectionEntriesForUser(ctx.db, user._id, args.formatId),
      loadFormatRuntime(ctx.db, args.formatId),
    ]);

    return validateDeckForUserCollection({
      collectionEntries,
      runtime,
      mainboard: args.mainboard,
      sideboard: args.sideboard,
    });
  },
});

export const create = mutation({
  args: {
    formatId: v.string(),
    mainboard: v.array(deckCardEntryValidator),
    name: v.string(),
    sideboard: v.array(deckCardEntryValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const now = Date.now();
    const name = normalizeDeckName(args.name);
    const runtime = await assertFormatPublishedForOperation(
      ctx.db,
      args.formatId,
      "saving decks",
    );
    await ensureStarterCollectionEntries(ctx.db, user._id, now);
    const collectionEntries = await listCollectionEntriesForUser(
      ctx.db,
      user._id,
      args.formatId,
    );
    const validation = validateDeckForUserCollection({
      collectionEntries,
      runtime,
      mainboard: args.mainboard,
      sideboard: args.sideboard,
    });

    if (!validation.isLegal) {
      throw new Error(
        validation.issues.map((issue) => issue.message).join(" "),
      );
    }

    const deckId = await ctx.db.insert("decks", {
      createdAt: now,
      formatId: args.formatId,
      mainboard: normalizeDeckEntries(args.mainboard),
      name,
      sideboard: normalizeDeckEntries(args.sideboard),
      status: "active",
      updatedAt: now,
      userId: user._id,
    });
    const deck = await getDeckOrThrow(ctx, deckId);

    return toDeckRecord(deck, validation);
  },
});

export const update = mutation({
  args: {
    deckId: v.id("decks"),
    mainboard: v.array(deckCardEntryValidator),
    name: v.string(),
    sideboard: v.array(deckCardEntryValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const deck = await getDeckOrThrow(ctx, args.deckId);
    assertDeckOwner(deck, user._id);
    const name = normalizeDeckName(args.name);
    const runtime = await assertFormatPublishedForOperation(
      ctx.db,
      deck.formatId,
      "updating decks",
    );

    const collectionEntries = await listCollectionEntriesForUser(
      ctx.db,
      user._id,
      deck.formatId,
    );
    const validation = validateDeckForUserCollection({
      collectionEntries,
      runtime,
      mainboard: args.mainboard,
      sideboard: args.sideboard,
    });

    if (!validation.isLegal) {
      throw new Error(
        validation.issues.map((issue) => issue.message).join(" "),
      );
    }

    const updatedAt = Date.now();
    const mainboard = normalizeDeckEntries(args.mainboard);
    const sideboard = normalizeDeckEntries(args.sideboard);
    await ctx.db.patch(deck._id, {
      mainboard,
      name,
      sideboard,
      updatedAt,
    });

    return toDeckRecord(
      {
        ...deck,
        mainboard,
        name,
        sideboard,
        updatedAt,
      },
      validation,
    );
  },
});

export const clone = mutation({
  args: {
    deckId: v.id("decks"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const sourceDeck = await getDeckOrThrow(ctx, args.deckId);
    assertDeckOwner(sourceDeck, user._id);
    const runtime = await assertFormatPublishedForOperation(
      ctx.db,
      sourceDeck.formatId,
      "cloning decks",
    );

    const collectionEntries = await listCollectionEntriesForUser(
      ctx.db,
      user._id,
      sourceDeck.formatId,
    );
    const validation = validateDeckForUserCollection({
      collectionEntries,
      runtime,
      mainboard: sourceDeck.mainboard,
      sideboard: sourceDeck.sideboard,
    });

    if (!validation.isLegal) {
      throw new Error(
        "Cannot clone an illegal deck until its collection requirements are restored",
      );
    }

    const now = Date.now();
    const name = args.name
      ? normalizeDeckName(args.name)
      : `${sourceDeck.name} Copy`;
    const deckId = await ctx.db.insert("decks", {
      createdAt: now,
      formatId: sourceDeck.formatId,
      mainboard: sourceDeck.mainboard,
      name,
      sideboard: sourceDeck.sideboard,
      status: "active",
      updatedAt: now,
      userId: user._id,
    });
    const clonedDeck = await getDeckOrThrow(ctx, deckId);

    return toDeckRecord(clonedDeck, validation);
  },
});

export const archive = mutation({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const deck = await getDeckOrThrow(ctx, args.deckId);
    assertDeckOwner(deck, user._id);
    const runtime = await loadFormatRuntime(ctx.db, deck.formatId);

    const updatedAt = Date.now();
    await ctx.db.patch(deck._id, {
      status: "archived",
      updatedAt,
    });

    const collectionEntries = await listCollectionEntriesForUser(
      ctx.db,
      user._id,
      deck.formatId,
    );
    const validation = validateDeckForUserCollection({
      collectionEntries,
      runtime,
      mainboard: deck.mainboard,
      sideboard: deck.sideboard,
    });

    return toDeckRecord(
      {
        ...deck,
        status: "archived",
        updatedAt,
      },
      validation,
    );
  },
});
