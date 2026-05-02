import type { GameRuleset, GameTransition } from "./ruleset";

export interface ReplayResult<TState, TEvent, TTransition> {
  events: TEvent[];
  finalState: TState;
  transitions: TTransition[];
}

export function replayGameIntents<
  TConfig,
  TState,
  TIntent,
  TEvent,
  TSeatView,
  TSpectatorView,
  TScene,
>(
  ruleset: GameRuleset<
    TConfig,
    TState,
    TIntent,
    TEvent,
    TSeatView,
    TSpectatorView,
    TScene
  >,
  config: TConfig,
  intents: readonly NoInfer<TIntent>[],
): ReplayResult<TState, TEvent, GameTransition<TState, TEvent>> {
  const transitions: Array<GameTransition<TState, TEvent>> = [];
  const events: TEvent[] = [];
  let state = ruleset.createInitialState(config);

  for (const intent of intents) {
    const transition = ruleset.applyIntent(state, intent);

    transitions.push(transition);
    events.push(...transition.events);
    state = transition.nextState;
  }

  return {
    events,
    finalState: state,
    transitions,
  };
}
