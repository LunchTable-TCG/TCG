import { describe, expect, it } from "vitest";

import type { LegalActionDescriptor } from "./actions";
import { resolveExternalActionId } from "./external";

type TestIntent =
  | { kind: "concede"; reason: "manual" }
  | { kind: "passPriority"; priorityWindowId: string };

const actions = [
  {
    actionId: "pass-priority",
    humanLabel: "Pass priority",
    intent: { kind: "passPriority" },
    kind: "passPriority",
    machineLabel: "pass_priority",
    priority: 50,
  },
  {
    actionId: "concede",
    humanLabel: "Concede",
    intent: { kind: "concede" },
    kind: "concede",
    machineLabel: "concede",
    priority: 0,
  },
] satisfies LegalActionDescriptor[];

const typedActions = [
  {
    actionId: "pass-priority",
    humanLabel: "Pass priority",
    intent: { kind: "passPriority", priorityWindowId: "window-1" },
    kind: "passPriority",
    machineLabel: "pass_priority",
    priority: 50,
  },
] satisfies LegalActionDescriptor<TestIntent>[];

void typedActions;

function acceptLegalAction(action: LegalActionDescriptor<TestIntent>) {
  return action;
}

const mismatchedKindAction = {
  actionId: "concede",
  humanLabel: "Concede",
  intent: { kind: "concede", reason: "manual" },
  kind: "passPriority",
  machineLabel: "concede",
  priority: 0,
} as const;

// @ts-expect-error no descriptor variant can pair concede intent with passPriority kind.
acceptLegalAction(mismatchedKindAction);

void mismatchedKindAction;

describe("resolveExternalActionId", () => {
  it("returns the matching legal action", () => {
    expect(resolveExternalActionId(actions, "pass-priority")).toBe(actions[0]);
  });

  it("returns null for null action selections", () => {
    expect(resolveExternalActionId(actions, null)).toBeNull();
  });

  it("rejects action ids that are not legal", () => {
    expect(() => resolveExternalActionId(actions, "draw-card")).toThrow(
      "External agent returned an unrecognized actionId",
    );
  });
});
