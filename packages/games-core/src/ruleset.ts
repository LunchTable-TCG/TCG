export type GameTransitionOutcome = "applied" | "noop" | "rejected";

export interface GameTransition<TState, TEvent = { kind: string }> {
  events: TEvent[];
  nextState: TState;
  outcome: GameTransitionOutcome;
  reason?: string;
}

export interface Viewport {
  height: number;
  width: number;
}

export interface GameRuleset<
  TConfig,
  TState,
  TIntent,
  TEvent,
  TSeatView,
  TSpectatorView,
  TScene,
> {
  applyIntent: (
    state: TState,
    intent: TIntent,
  ) => GameTransition<TState, TEvent>;
  createInitialState: (config: TConfig) => TState;
  deriveRenderScene: (state: TState, viewport: Viewport) => TScene;
  deriveSeatView: (state: TState, seatId: string) => TSeatView;
  deriveSpectatorView: (state: TState) => TSpectatorView;
  listLegalIntents: (state: TState, seatId: string) => TIntent[];
}
