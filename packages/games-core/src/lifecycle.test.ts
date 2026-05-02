import { describe, expect, it } from "vitest";

import {
  createIntentEnvelope,
  createReplayLog,
  recordReplayIntent,
} from "./lifecycle";

describe("game lifecycle primitives", () => {
  it("wraps submitted intents with authority metadata", () => {
    const envelope = createIntentEnvelope(
      { kind: "rollDie", sides: 6 },
      {
        gameId: "game_123",
        requestId: "request_456",
        seatId: "seat-0",
        stateVersion: 12,
        submittedAt: 1777739000000,
      },
    );

    expect(envelope).toEqual({
      gameId: "game_123",
      intent: { kind: "rollDie", sides: 6 },
      requestId: "request_456",
      seatId: "seat-0",
      stateVersion: 12,
      submittedAt: 1777739000000,
    });
  });

  it("records replay intents without mutating the existing replay log", () => {
    const initial = createReplayLog({
      createdAt: 1777739000000,
      gameId: "game_123",
      initialSeed: "seed:test",
      rulesetId: "dice-duel",
    });
    const next = recordReplayIntent(initial, {
      gameId: "game_123",
      intent: { kind: "rollDie", sides: 6 },
      requestId: "request_456",
      seatId: "seat-0",
      stateVersion: 12,
      submittedAt: 1777739001000,
    });

    expect(initial.intentLog).toEqual([]);
    expect(next.intentLog).toHaveLength(1);
    expect(next.intentLog[0]?.intent).toEqual({ kind: "rollDie", sides: 6 });
    expect(next.metadata.updatedAt).toBe(1777739001000);
  });
});
