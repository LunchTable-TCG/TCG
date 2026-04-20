import type {
  LobbyRecord,
  LobbyStatus,
  MatchStatus,
  QueueEntryRecord,
} from "@lunchtable/shared-types";

import type { Doc } from "../_generated/dataModel";

export function normalizeLobbyCode(code: string): string {
  return code.trim().toUpperCase();
}

export function deriveLobbyCode(lobbyId: string): string {
  return normalizeLobbyCode(lobbyId).slice(0, 6);
}

export function isActiveLobbyStatus(status: LobbyStatus): boolean {
  return status === "open" || status === "readyCheck";
}

export function isActiveMatchStatus(status: MatchStatus): boolean {
  return status === "pending" || status === "active";
}

export function deriveLobbyStatus(input: {
  guestUserId: string | undefined;
  hostReady: boolean;
  guestReady: boolean | undefined;
  matchId: string | undefined;
  cancelled: boolean;
}): LobbyStatus {
  if (input.cancelled) {
    return "cancelled";
  }
  if (input.matchId) {
    return "matched";
  }
  if (!input.guestUserId) {
    return "open";
  }
  return "readyCheck";
}

export function toLobbyRecord(lobby: Doc<"lobbies">): LobbyRecord {
  const participants: LobbyRecord["participants"] = [
    {
      actorType: "human",
      deckId: lobby.hostDeckId,
      joinedAt: lobby.createdAt,
      ready: lobby.hostReady,
      slot: "host",
      userId: lobby.hostUserId,
      username: lobby.hostUsername,
      walletAddress: lobby.hostWalletAddress ?? null,
    },
  ];

  if (lobby.guestUserId && lobby.guestDeckId) {
    participants.push({
      actorType: lobby.guestActorType ?? "human",
      deckId: lobby.guestDeckId,
      joinedAt: lobby.guestJoinedAt ?? lobby.updatedAt,
      ready: lobby.guestReady ?? false,
      slot: "guest",
      userId: lobby.guestUserId,
      username: lobby.guestUsername ?? "Guest",
      walletAddress: lobby.guestWalletAddress ?? null,
    });
  }

  return {
    code: lobby.code,
    createdAt: lobby.createdAt,
    formatId: lobby.formatId,
    id: lobby._id,
    matchId: lobby.matchId ?? null,
    participants,
    status: lobby.status,
    updatedAt: lobby.updatedAt,
  };
}

export function toQueueEntryRecord(
  entry: Doc<"queueEntries">,
): QueueEntryRecord {
  return {
    createdAt: entry.createdAt,
    deckId: entry.deckId,
    formatId: entry.formatId,
    id: entry._id,
    kind: entry.kind,
    matchId: entry.matchId ?? null,
    status: entry.status,
    updatedAt: entry.updatedAt,
    userId: entry.userId,
    username: entry.username,
  };
}

export function compareQueueOrder(
  left: Pick<Doc<"queueEntries">, "_id" | "createdAt">,
  right: Pick<Doc<"queueEntries">, "_id" | "createdAt">,
) {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  return String(left._id).localeCompare(String(right._id));
}

export function pickQueueOpponent(
  entries: Doc<"queueEntries">[],
  currentUserId: string,
) {
  return (
    entries
      .filter(
        (entry) => entry.status === "queued" && entry.userId !== currentUserId,
      )
      .sort(compareQueueOrder)[0] ?? null
  );
}
