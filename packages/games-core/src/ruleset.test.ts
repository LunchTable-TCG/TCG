import { describe, expect, it } from "vitest";
import type { GameRuleset } from "./index";
import { replayGameIntents } from "./index";

interface CounterConfig {
  initialCount: number;
}

interface CounterState {
  count: number;
}

type CounterIntent =
  | {
      kind: "increment";
    }
  | {
      kind: "reject";
    };

interface CounterSeatView {
  count: number;
  legalIntentCount: number;
}

interface CounterSpectatorView {
  count: number;
}

interface CounterScene {
  label: string;
  viewport: {
    height: number;
    width: number;
  };
}

const counterRuleset: GameRuleset<
  CounterConfig,
  CounterState,
  CounterIntent,
  CounterSeatView,
  CounterSpectatorView,
  CounterScene
> = {
  applyIntent: (state, intent) => {
    if (intent.kind === "reject") {
      return {
        events: [{ kind: "counterRejected" }],
        nextState: state,
        outcome: "rejected",
        reason: "intent rejected",
      };
    }

    return {
      events: [{ kind: "counterIncremented" }],
      nextState: {
        count: state.count + 1,
      },
      outcome: "applied",
    };
  },
  createInitialState: (config) => ({
    count: config.initialCount,
  }),
  deriveRenderScene: (state, viewport) => ({
    label: `count:${state.count}`,
    viewport,
  }),
  deriveSeatView: (state) => ({
    count: state.count,
    legalIntentCount: 1,
  }),
  deriveSpectatorView: (state) => ({
    count: state.count,
  }),
  listLegalIntents: () => [{ kind: "increment" }],
};

describe("GameRuleset", () => {
  it("defines the generic ruleset contract", () => {
    const initialState = counterRuleset.createInitialState({
      initialCount: 3,
    });
    const transition = counterRuleset.applyIntent(initialState, {
      kind: "increment",
    });
    const seatView = counterRuleset.deriveSeatView(transition.nextState, "seat-0");
    const spectatorView = counterRuleset.deriveSpectatorView(transition.nextState);
    const scene = counterRuleset.deriveRenderScene(transition.nextState, {
      height: 720,
      width: 1280,
    });

    expect(transition).toEqual({
      events: [{ kind: "counterIncremented" }],
      nextState: {
        count: 4,
      },
      outcome: "applied",
    });
    expect(counterRuleset.listLegalIntents(transition.nextState, "seat-0")).toEqual([
      { kind: "increment" },
    ]);
    expect(seatView).toEqual({
      count: 4,
      legalIntentCount: 1,
    });
    expect(spectatorView).toEqual({
      count: 4,
    });
    expect(scene).toEqual({
      label: "count:4",
      viewport: {
        height: 720,
        width: 1280,
      },
    });
  });

  it("replays intents through the ruleset in order", () => {
    const replay = replayGameIntents(
      counterRuleset,
      {
        initialCount: 0,
      },
      [{ kind: "increment" }, { kind: "increment" }, { kind: "reject" }],
    );

    expect(replay.finalState).toEqual({
      count: 2,
    });
    expect(replay.transitions).toEqual([
      {
        events: [{ kind: "counterIncremented" }],
        nextState: {
          count: 1,
        },
        outcome: "applied",
      },
      {
        events: [{ kind: "counterIncremented" }],
        nextState: {
          count: 2,
        },
        outcome: "applied",
      },
      {
        events: [{ kind: "counterRejected" }],
        nextState: {
          count: 2,
        },
        outcome: "rejected",
        reason: "intent rejected",
      },
    ]);
    expect(replay.events).toEqual([
      { kind: "counterIncremented" },
      { kind: "counterIncremented" },
      { kind: "counterRejected" },
    ]);
  });
});
