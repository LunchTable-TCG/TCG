import type { UserId } from "./auth";
import type { MatchId, SeatId } from "./match";

export const MATCH_TELEMETRY_EVENT_NAMES = [
  "auth.signup.completed",
  "auth.login.completed",
  "match.intent.received",
  "match.intent.accepted",
  "match.intent.rejected",
  "match.state.persisted",
  "match.view.published",
  "match.sync.staleVersion",
  "match.recovery.completed",
  "bot.seat.decisionStarted",
  "bot.seat.decisionCompleted",
  "bot.seat.intentSubmitted",
  "replay.chunkPersisted",
  "ops.format.updated",
] as const;

export type MatchTelemetryEventName =
  (typeof MATCH_TELEMETRY_EVENT_NAMES)[number];

export interface MatchTelemetryEvent<
  TName extends MatchTelemetryEventName = MatchTelemetryEventName,
> {
  at: number;
  matchId?: MatchId;
  metrics?: Record<string, number>;
  name: TName;
  seat?: SeatId;
  tags?: Record<string, string>;
  userId?: UserId | null;
}
