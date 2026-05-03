import { describe, expect, it } from "vitest";

import { sideScrollerAuthoringExample } from "../examples/generated-game-authoring";

describe("generated game authoring example", () => {
  it("ties authoring, rendering, and hosted agent orchestration together", () => {
    expect(sideScrollerAuthoringExample.workflow.packId).toBe(
      "example-side-runner",
    );
    expect(sideScrollerAuthoringExample.readiness.status).toBe("publishable");
    expect(sideScrollerAuthoringExample.rendererPlan.primaryAdapter.id).toBe(
      "pixi-2d",
    );
    expect(sideScrollerAuthoringExample.eliza.transport).toBe(
      "eliza-cloud-chat-completions",
    );
  });
});
