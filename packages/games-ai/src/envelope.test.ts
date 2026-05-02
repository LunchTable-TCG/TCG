import { describe, expect, it } from "vitest";

import type { DecisionFrame, LegalActionDescriptor } from "./actions";
import { createExternalDecisionEnvelope } from "./envelope";

type TestIntent =
  | {
      kind: "roll";
      sides: number;
    }
  | {
      kind: "pass";
    };

const actions: LegalActionDescriptor<TestIntent>[] = [
  {
    actionId: "roll-d6",
    humanLabel: "Roll D6",
    intent: { kind: "roll", sides: 6 },
    kind: "roll",
    machineLabel: "roll_d6",
    priority: 10,
  },
];

const frame: DecisionFrame<
  { visibleObjects: string[] },
  LegalActionDescriptor<TestIntent>
> = {
  deadlineAt: null,
  legalActions: actions,
  receivedAt: 1777739000000,
  seat: "seat-0",
  view: {
    visibleObjects: ["die:attack"],
  },
};

describe("external decision envelopes", () => {
  it("serializes scoped views and legal actions for external agents", () => {
    expect(
      createExternalDecisionEnvelope(frame, {
        gameId: "game_123",
        requestId: "request_456",
        rulesetId: "dice-duel",
      }),
    ).toEqual({
      deadlineAt: null,
      gameId: "game_123",
      legalActions: actions,
      receivedAt: 1777739000000,
      requestId: "request_456",
      rulesetId: "dice-duel",
      seat: "seat-0",
      view: {
        visibleObjects: ["die:attack"],
      },
    });
  });
});
