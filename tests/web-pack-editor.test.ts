import { describe, expect, it } from "vitest";

import { createPackEditorPanelModel } from "../apps/web/src/components/pack/PackEditorPanel";

describe("browser pack editor panel model", () => {
  it("summarizes draft files and validation for the browser surface", () => {
    expect(createPackEditorPanelModel()).toEqual({
      files: ["game.json", "objects.json", "ruleset.json"],
      issueCount: 0,
      legalIntentCount: 2,
      objectCount: 2,
      status: "valid",
      title: "Generated Dice Duel",
    });
  });
});
