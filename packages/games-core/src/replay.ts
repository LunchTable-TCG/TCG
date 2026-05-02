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
  TSeatView,
  TSpectatorView,
  TScene,
>(
  ruleset: GameRuleset<
    TConfig,
    TState,
    TIntent,
    TSeatView,
    TSpectatorView,
    TScene
  >,
  config: TConfig,
  intents: TIntent[],
): ReplayResult<TState, { kind: string }, GameTransition<TState>> {
  const transitions: GameTransition<TState>[] = [];
  const events: Array<{ kind: string }> = [];
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
