import type { GenericId } from "convex/values";

import type { UserId } from "./auth";
import type { DeckId } from "./library";
import type { MatchActorType, MatchId, MatchShell } from "./match";

export type LobbyId = GenericId<"lobbies">;
export type QueueEntryId = GenericId<"queueEntries">;

export const LOBBY_SLOTS = ["host", "guest"] as const;
export type LobbySlot = (typeof LOBBY_SLOTS)[number];

export const LOBBY_STATUSES = [
  "open",
  "readyCheck",
  "matched",
  "cancelled",
] as const;
export type LobbyStatus = (typeof LOBBY_STATUSES)[number];

export const QUEUE_KINDS = ["casual"] as const;
export type QueueKind = (typeof QUEUE_KINDS)[number];

export const QUEUE_ENTRY_STATUSES = ["queued", "matched", "cancelled"] as const;
export type QueueEntryStatus = (typeof QUEUE_ENTRY_STATUSES)[number];

export interface LobbyParticipant {
  actorType: MatchActorType;
  deckId: DeckId;
  joinedAt: number;
  ready: boolean;
  slot: LobbySlot;
  userId: UserId;
  username: string;
  walletAddress: string | null;
}

export interface LobbyRecord {
  code: string;
  createdAt: number;
  formatId: string;
  id: LobbyId;
  matchId: MatchId | null;
  participants: LobbyParticipant[];
  status: LobbyStatus;
  updatedAt: number;
}

export interface LobbyMutationResult {
  lobby: LobbyRecord;
  match: MatchShell | null;
}

export interface QueueEntryRecord {
  createdAt: number;
  deckId: DeckId;
  formatId: string;
  id: QueueEntryId;
  kind: QueueKind;
  matchId: MatchId | null;
  status: QueueEntryStatus;
  updatedAt: number;
  userId: UserId;
  username: string;
}

export interface QueueMutationResult {
  entry: QueueEntryRecord;
  match: MatchShell | null;
}
