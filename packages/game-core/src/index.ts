import type { MatchSkeleton } from "@lunchtable/shared-types";
import { createGameState } from "./engine";

export type {
  ActivatedAbility,
  CardAbility,
  CardDefinition,
  MatchCardCatalogEntry,
  CardKind,
  CardRarity,
  CompiledCardDefinition,
  ConditionNode,
  ContinuousEffectNode,
  ContinuousLayer,
  CostSpec,
  CreateMatchStateOptions,
  EffectNode,
  EventPattern,
  FormatDefinition,
  FormatDeckRules,
  FormatUiHints,
  GameplayIntent,
  GameplayIntentKind,
  KeywordDefinition,
  KeywordRegistry,
  MatchEvent,
  MatchEventKind,
  MatchEventSummary,
  MatchId,
  MatchPhase,
  MatchState,
  MatchTransition,
  MatchTransitionReason,
  MatchSeatView,
  MatchShell,
  MatchView,
  ReplacementAbility,
  ReplacementNode,
  ReplayResult,
  SeatId,
  StaticAbility,
  TargetSpec,
  TriggerSpec,
  TriggeredAbility,
  ValidationFailure,
  ValidationResult,
  ValidationSuccess,
} from "./types";
export {
  applyGameplayIntent,
  replayGameplayIntents,
} from "./engine";
export { createGameState } from "./engine";
export {
  createRecentEventSummaries,
  createSeatView,
  createSpectatorView,
} from "./views";
export {
  compileCardDefinition,
  validateCardDefinition,
  validateFormatDefinition,
} from "./dsl";
export { deriveDeterministicNumber } from "./state";
export { createMatchShellFromState } from "./state";

export function createMatchSkeleton(): MatchSkeleton {
  return createGameState().shell;
}
