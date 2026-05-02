import {
  type GameRuleset,
  type GameTransition,
  replayGameIntents,
} from "@lunchtable/games-core";
import type { GameplayIntent, MatchEvent } from "@lunchtable/shared-types";

import {
  type MatchTransition,
  type MatchTransitionReason,
  reduceGameplayIntent,
} from "./reducer";
import {
  type CreateMatchStateOptions,
  type MatchState,
  createMatchState,
} from "./state";

const MATCH_TRANSITION_REASONS: ReadonlySet<string> =
  new Set<MatchTransitionReason>([
    "abilityNotFound",
    "cardNotFound",
    "cardNotInZone",
    "insufficientResources",
    "invalidMatch",
    "invalidPhase",
    "invalidPrompt",
    "invalidSeat",
    "invalidZone",
    "matchComplete",
    "notPriorityOwner",
    "staleStateVersion",
    "unsupportedCost",
    "unsupportedTargeting",
    "unsupportedIntent",
  ]);

export interface ReplayResult {
  events: MatchEvent[];
  state: MatchState;
  transitions: MatchTransition[];
}

const replayRuleset: GameRuleset<
  MatchState,
  MatchState,
  GameplayIntent,
  MatchEvent,
  never,
  never,
  never
> = {
  applyIntent: applyGameplayIntent,
  createInitialState: (state) => state,
  deriveRenderScene: () => {
    throw new Error("Replay ruleset does not derive render scenes.");
  },
  deriveSeatView: () => {
    throw new Error("Replay ruleset does not derive seat views.");
  },
  deriveSpectatorView: () => {
    throw new Error("Replay ruleset does not derive spectator views.");
  },
  listLegalIntents: () => {
    throw new Error("Replay ruleset does not list legal intents.");
  },
};

export function createGameState(
  options: CreateMatchStateOptions = {},
): MatchState {
  return createMatchState(options);
}

export function applyGameplayIntent(
  state: MatchState,
  intent: GameplayIntent,
): MatchTransition {
  return reduceGameplayIntent(state, intent);
}

export function replayGameplayIntents(
  initialState: MatchState,
  intents: GameplayIntent[],
): ReplayResult {
  const replay = replayGameIntents(replayRuleset, initialState, intents);

  return {
    events: replay.events,
    state: replay.finalState,
    transitions: replay.transitions.map(toMatchTransition),
  };
}

function toMatchTransition(
  transition: GameTransition<MatchState, MatchEvent>,
): MatchTransition {
  if (transition.reason === undefined) {
    return {
      events: transition.events,
      nextState: transition.nextState,
      outcome: transition.outcome,
    };
  }

  if (!isMatchTransitionReason(transition.reason)) {
    throw new Error(`Unexpected match transition reason: ${transition.reason}`);
  }

  return {
    ...transition,
    reason: transition.reason,
  };
}

function isMatchTransitionReason(
  reason: string,
): reason is MatchTransitionReason {
  return MATCH_TRANSITION_REASONS.has(reason);
}
