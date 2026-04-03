import type { GameplayIntent, MatchEvent } from "@lunchtable/shared-types";

import { type MatchTransition, reduceGameplayIntent } from "./reducer";
import {
  type CreateMatchStateOptions,
  type MatchState,
  createMatchState,
} from "./state";

export interface ReplayResult {
  events: MatchEvent[];
  state: MatchState;
  transitions: MatchTransition[];
}

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
  return intents.reduce<ReplayResult>(
    (result, intent) => {
      const transition = applyGameplayIntent(result.state, intent);
      return {
        events: [...result.events, ...transition.events],
        state: transition.nextState,
        transitions: [...result.transitions, transition],
      };
    },
    {
      events: [],
      state: initialState,
      transitions: [],
    },
  );
}
