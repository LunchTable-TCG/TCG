import { describe, expect, it } from "vitest";

import { createPackEditorPanelModel } from "../apps/web/src/components/pack/PackEditorPanel";

describe("browser pack editor panel model", () => {
  it("summarizes draft files and validation for the browser surface", () => {
    expect(createPackEditorPanelModel()).toEqual({
      blockingGateCount: 0,
      files: ["game.json", "objects.json", "ruleset.json"],
      gates: [
        "schema-validation",
        "deterministic-simulation",
        "agent-parity",
        "renderer-scene",
        "mcp-connectivity",
        "docs-context",
      ],
      issueCount: 0,
      legalIntentCount: 2,
      objectCount: 2,
      primaryRenderer: "pixi-2d",
      publishStatus: "publishable",
      status: "valid",
      title: "Generated Dice Duel",
    });
  });
});
