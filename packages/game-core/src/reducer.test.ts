import { describe, expect, it } from "vitest";

import {
  applyGameplayIntent,
  createGameState,
  replayGameplayIntents,
} from "./index";

describe("applyGameplayIntent", () => {
  it("keeps passPriority as a deterministic no-op transition", () => {
    const state = createGameState({
      matchId: "match_noop",
    });

    const transition = applyGameplayIntent(state, {
      intentId: "intent_pass_001",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: state.shell.version,
    });

    expect(transition).toEqual({
      events: [],
      nextState: state,
      outcome: "noop",
    });
  });

  it("replays the same seed and intents into the same final state", () => {
    const initialState = createGameState({
      matchId: "match_replay",
      seed: "seed:replay-stable",
      status: "active",
    });

    const intents = [
      {
        intentId: "intent_toggle_001",
        kind: "toggleAutoPass",
        matchId: initialState.shell.id,
        payload: {
          enabled: true,
        },
        seat: "seat-0",
        stateVersion: 0,
      },
      {
        intentId: "intent_concede_002",
        kind: "concede",
        matchId: initialState.shell.id,
        payload: {
          reason: "manual",
        },
        seat: "seat-1",
        stateVersion: 1,
      },
    ] as const;

    const firstReplay = replayGameplayIntents(initialState, [...intents]);
    const secondReplay = replayGameplayIntents(
      createGameState({
        matchId: "match_replay",
        seed: "seed:replay-stable",
        status: "active",
      }),
      [...intents],
    );

    expect(firstReplay.events).toHaveLength(2);
    expect(firstReplay.state.seats["seat-0"]?.autoPassEnabled).toBe(true);
    expect(firstReplay.state.shell.status).toBe("complete");
    expect(firstReplay.state.shell.winnerSeat).toBe("seat-0");
    expect(firstReplay).toEqual(secondReplay);
  });
});
