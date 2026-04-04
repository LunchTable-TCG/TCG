import type { LobbyMutationResult } from "@lunchtable/shared-types";
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
import { assertUserCanEnterPlaySurface } from "./lib/participation";
import {
  deriveLobbyCode,
  deriveLobbyStatus,
  normalizeLobbyCode,
  toLobbyRecord,
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
    throw new Error("Only active decks can enter a lobby");
  }
  return deck;
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
  const runtime = await loadFormatRuntime(ctx.db, input.deck.formatId);
  const collectionEntries = await listCollectionEntriesForUser(
    ctx.db,
    input.userId,
    input.deck.formatId,
  );
  const validation = validateDeckForUserCollection({
    collectionEntries,
    runtime,
    mainboard: input.deck.mainboard,
    sideboard: input.deck.sideboard,
  });

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

async function getLobbyOrThrow(
  ctx: {
    db: {
      get: (id: Id<"lobbies">) => Promise<Doc<"lobbies"> | null>;
    };
  },
  lobbyId: Id<"lobbies">,
) {
  const lobby = await ctx.db.get(lobbyId);
  if (!lobby) {
    throw new Error("Lobby not found");
  }
  return lobby;
}

function toLobbyResult(
  lobby: Doc<"lobbies">,
  match: Doc<"matches"> | null,
): LobbyMutationResult {
  return {
    lobby: toLobbyRecord(lobby),
    match: match ? deserializeMatchShell(match.shellJson) : null,
  };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireViewerUser(ctx);
    const [hosted, joined] = await Promise.all([
      ctx.db
        .query("lobbies")
        .withIndex("by_hostUserId_and_updatedAt", (index) =>
          index.eq("hostUserId", user._id),
        )
        .order("desc")
        .take(20),
      ctx.db
        .query("lobbies")
        .withIndex("by_guestUserId_and_updatedAt", (index) =>
          index.eq("guestUserId", user._id),
        )
        .order("desc")
        .take(20),
    ]);

    const merged = new Map<string, Doc<"lobbies">>();
    for (const lobby of [...hosted, ...joined]) {
      merged.set(lobby._id, lobby);
    }

    return [...merged.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map(toLobbyRecord);
  },
});

export const getByCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    await requireViewerUser(ctx);
    const lobby = await ctx.db
      .query("lobbies")
      .withIndex("by_code", (index) =>
        index.eq("codeNormalized", normalizeLobbyCode(args.code)),
      )
      .unique();

    return lobby ? toLobbyRecord(lobby) : null;
  },
});

export const createPrivate = mutation({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    await assertUserCanEnterPlaySurface(ctx.db, {
      actionLabel: "creating a private lobby",
      userId: user._id,
    });

    const deck = await assertPlayableDeck(ctx, {
      deckId: args.deckId,
      userId: user._id,
    });
    await assertFormatPublishedForOperation(
      ctx.db,
      deck.formatId,
      "creating a private lobby",
    );
    await assertLegalDeckForUser(ctx, {
      deck,
      userId: user._id,
      username: user.username,
    });

    const now = Date.now();
    const walletAddress = await getWalletAddress(ctx, user.primaryWalletId);
    const lobbyId = await ctx.db.insert("lobbies", {
      code: "PENDING",
      codeNormalized: "PENDING",
      createdAt: now,
      formatId: deck.formatId,
      hostDeckId: deck._id,
      hostReady: false,
      hostUserId: user._id,
      hostUsername: user.username,
      hostWalletAddress: walletAddress ?? undefined,
      status: "open",
      updatedAt: now,
    });

    const code = deriveLobbyCode(lobbyId);
    await ctx.db.patch(lobbyId, {
      code,
      codeNormalized: normalizeLobbyCode(code),
    });

    const lobby = await getLobbyOrThrow(ctx, lobbyId);
    return toLobbyResult(lobby, null);
  },
});

export const join = mutation({
  args: {
    code: v.string(),
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    await assertUserCanEnterPlaySurface(ctx.db, {
      actionLabel: "joining another lobby",
      userId: user._id,
    });

    const lobby = await ctx.db
      .query("lobbies")
      .withIndex("by_code", (index) =>
        index.eq("codeNormalized", normalizeLobbyCode(args.code)),
      )
      .unique();
    if (!lobby) {
      throw new Error("Lobby not found");
    }
    if (lobby.status === "matched" || lobby.status === "cancelled") {
      throw new Error("Lobby is no longer joinable");
    }
    if (lobby.hostUserId === user._id) {
      throw new Error("Host cannot join their own lobby");
    }
    if (lobby.guestUserId && lobby.guestUserId !== user._id) {
      throw new Error("Lobby already has an opponent");
    }

    const deck = await assertPlayableDeck(ctx, {
      deckId: args.deckId,
      userId: user._id,
    });
    if (deck.formatId !== lobby.formatId) {
      throw new Error("Deck format does not match the lobby");
    }
    await assertFormatPublishedForOperation(
      ctx.db,
      lobby.formatId,
      "joining a private lobby",
    );
    await assertLegalDeckForUser(ctx, {
      deck,
      userId: user._id,
      username: user.username,
    });

    const nextUpdatedAt = Date.now();
    const walletAddress = await getWalletAddress(ctx, user.primaryWalletId);
    const nextStatus = deriveLobbyStatus({
      cancelled: false,
      guestReady: false,
      guestUserId: user._id,
      hostReady: lobby.hostReady,
      matchId: lobby.matchId,
    });
    await ctx.db.patch(lobby._id, {
      guestDeckId: deck._id,
      guestJoinedAt: nextUpdatedAt,
      guestReady: false,
      guestUserId: user._id,
      hostReady: false,
      guestUsername: user.username,
      guestWalletAddress: walletAddress ?? undefined,
      status: nextStatus,
      updatedAt: nextUpdatedAt,
    });

    const nextLobby = await getLobbyOrThrow(ctx, lobby._id);
    return toLobbyResult(nextLobby, null);
  },
});

export const leave = mutation({
  args: {
    lobbyId: v.id("lobbies"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const lobby = await getLobbyOrThrow(ctx, args.lobbyId);
    if (lobby.status === "matched") {
      throw new Error("Lobby already started");
    }
    if (lobby.hostUserId !== user._id && lobby.guestUserId !== user._id) {
      throw new Error("Lobby not found");
    }

    const now = Date.now();
    if (lobby.hostUserId === user._id) {
      await ctx.db.patch(lobby._id, {
        status: "cancelled",
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(lobby._id, {
        guestDeckId: undefined,
        guestJoinedAt: undefined,
        guestReady: undefined,
        guestUserId: undefined,
        guestUsername: undefined,
        guestWalletAddress: undefined,
        hostReady: false,
        status: "open",
        updatedAt: now,
      });
    }

    const nextLobby = await getLobbyOrThrow(ctx, lobby._id);
    return toLobbyResult(nextLobby, null);
  },
});

export const setReady = mutation({
  args: {
    lobbyId: v.id("lobbies"),
    ready: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const lobby = await getLobbyOrThrow(ctx, args.lobbyId);
    if (lobby.hostUserId !== user._id && lobby.guestUserId !== user._id) {
      throw new Error("Lobby not found");
    }

    if (lobby.matchId) {
      const match = await ctx.db.get(lobby.matchId);
      const nextLobby = await getLobbyOrThrow(ctx, lobby._id);
      return toLobbyResult(nextLobby, match);
    }

    const isHost = lobby.hostUserId === user._id;
    const nextHostReady = isHost ? args.ready : lobby.hostReady;
    const nextGuestReady = isHost ? lobby.guestReady : args.ready;
    const nextStatus = deriveLobbyStatus({
      cancelled: false,
      guestReady: nextGuestReady,
      guestUserId: lobby.guestUserId,
      hostReady: nextHostReady,
      matchId: undefined,
    });

    await ctx.db.patch(lobby._id, {
      guestReady: nextGuestReady,
      hostReady: nextHostReady,
      status: nextStatus,
      updatedAt: Date.now(),
    });

    const readyLobby = await getLobbyOrThrow(ctx, lobby._id);
    if (!readyLobby.guestUserId || !readyLobby.guestDeckId) {
      return toLobbyResult(readyLobby, null);
    }
    if (!readyLobby.hostReady || !readyLobby.guestReady) {
      return toLobbyResult(readyLobby, null);
    }

    const [hostDeck, guestDeck] = await Promise.all([
      assertPlayableDeck(ctx, {
        deckId: readyLobby.hostDeckId,
        userId: readyLobby.hostUserId,
      }),
      assertPlayableDeck(ctx, {
        deckId: readyLobby.guestDeckId,
        userId: readyLobby.guestUserId,
      }),
    ]);
    const runtime = await assertFormatPublishedForOperation(
      ctx.db,
      readyLobby.formatId,
      "starting a private lobby match",
    );
    await Promise.all([
      assertLegalDeckForUser(ctx, {
        deck: hostDeck,
        userId: readyLobby.hostUserId,
        username: readyLobby.hostUsername,
      }),
      assertLegalDeckForUser(ctx, {
        deck: guestDeck,
        userId: readyLobby.guestUserId,
        username: readyLobby.guestUsername ?? "Guest",
      }),
    ]);

    const startedAt = Date.now();
    const bundle = await createPersistedMatch(ctx, {
      activeSeat: "seat-0",
      createdAt: startedAt,
      format: runtime.format,
      participants: [
        {
          actorType: "human",
          deck: {
            mainboard: hostDeck.mainboard,
            sideboard: hostDeck.sideboard,
          },
          seat: "seat-0",
          userId: readyLobby.hostUserId,
          username: readyLobby.hostUsername,
          walletAddress: readyLobby.hostWalletAddress ?? null,
        },
        {
          actorType: "human",
          deck: {
            mainboard: guestDeck.mainboard,
            sideboard: guestDeck.sideboard,
          },
          seat: "seat-1",
          userId: readyLobby.guestUserId,
          username: readyLobby.guestUsername ?? "Guest",
          walletAddress: readyLobby.guestWalletAddress ?? null,
        },
      ],
      startedAt,
      status: "active",
      turnNumber: 1,
    });

    await ctx.db.patch(readyLobby._id, {
      matchId: ctx.db.normalizeId("matches", bundle.shell.id) ?? undefined,
      status: "matched",
      updatedAt: startedAt,
    });

    const nextLobby = await getLobbyOrThrow(ctx, readyLobby._id);
    const matchId = ctx.db.normalizeId("matches", bundle.shell.id);
    const match = matchId ? await ctx.db.get(matchId) : null;
    return toLobbyResult(nextLobby, match);
  },
});
