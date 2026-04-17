import type { MatchEventKind } from "./kinds";
import type { MatchShell, SeatId } from "./match";

export const MATCH_RECOVERY_ACTIONS = ["cancel", "forceConcede"] as const;

export type MatchRecoveryAction = (typeof MATCH_RECOVERY_ACTIONS)[number];

export interface RecoverableMatchRecord {
  idleMs: number;
  latestEventAt: number | null;
  latestEventKind: MatchEventKind | null;
  match: MatchShell;
  pendingPromptCount: number;
  staleThresholdMs: number;
}

export interface RecoverMatchResult {
  appendedEventKinds: MatchEventKind[];
  match: MatchShell;
  outcome: "cancelled" | "forcedConcession";
  recoveredSeat: SeatId | null;
}
