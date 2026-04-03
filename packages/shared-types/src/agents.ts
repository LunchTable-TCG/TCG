import type { GenericId } from "convex/values";

import type { UserId } from "./auth";
import type { MatchId, MatchShell, SeatId } from "./match";

export type BotIdentityId = GenericId<"botIdentities">;
export type BotAssignmentId = GenericId<"botAssignments">;

export const BOT_IDENTITY_STATUSES = ["active", "disabled"] as const;
export type BotIdentityStatus = (typeof BOT_IDENTITY_STATUSES)[number];

export const BOT_ASSIGNMENT_STATUSES = [
  "pending",
  "active",
  "complete",
  "cancelled",
] as const;
export type BotAssignmentStatus = (typeof BOT_ASSIGNMENT_STATUSES)[number];

export interface BotIdentityRecord {
  createdAt: number;
  displayName: string;
  id: BotIdentityId;
  policyKey: string;
  slug: string;
  status: BotIdentityStatus;
  updatedAt: number;
  userId: UserId;
}

export interface BotAssignmentRecord {
  botIdentityId: BotIdentityId;
  completedAt: number | null;
  createdAt: number;
  id: BotAssignmentId;
  lastIntentAt: number | null;
  lastObservedVersion: number | null;
  matchId: MatchId;
  seat: SeatId;
  status: BotAssignmentStatus;
  updatedAt: number;
  userId: UserId;
}

export interface BotAssignmentSnapshot {
  assignment: BotAssignmentRecord;
  match: MatchShell | null;
}

export interface BotRunnerSession {
  botIdentity: BotIdentityRecord;
  token: string;
  userId: UserId;
  username: string;
}
