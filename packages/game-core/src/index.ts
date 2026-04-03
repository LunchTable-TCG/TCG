import type { MatchSkeleton } from "@lunchtable/shared-types";
import { createGameState } from "./engine";

export type {
  CreateMatchStateOptions,
  GameplayIntent,
  GameplayIntentKind,
  MatchEvent,
  MatchEventKind,
  MatchId,
  MatchPhase,
  MatchState,
  MatchTransition,
  MatchSeatView,
  MatchShell,
  MatchView,
  ReplayResult,
  SeatId,
} from "./types";
export {
  applyGameplayIntent,
  replayGameplayIntents,
} from "./engine";
export { createGameState } from "./engine";
export { deriveDeterministicNumber } from "./state";

export function createMatchSkeleton(): MatchSkeleton {
  return createGameState().shell;
}
