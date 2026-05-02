import { describe, expect, it } from "vitest";

import {
  addObjectToPortablePackDraft,
  createPortablePackEditorDraft,
  exportPortablePackDraft,
} from "./editor";

describe("portable pack editor model", () => {
  it("creates a browser-editable draft with validation and summaries", () => {
    const draft = createPortablePackEditorDraft({
      game: {
        description: "Dice duel",
        id: "dice-duel",
        name: "Dice Duel",
        runtime: "lunchtable",
        version: "0.1.0",
      },
      objects: {
        objects: [],
        seats: [
          {
            actorType: "human",
            id: "seat-0",
            name: "Seat 0",
            permissions: ["submitIntent"],
            status: "ready",
          },
        ],
        zones: [
          {
            id: "table",
            kind: "board",
            name: "Table",
            ordering: "unordered",
            ownerSeat: null,
            visibility: "public",
          },
        ],
      },
      ruleset: {
        legalIntents: [{ kind: "roll" }],
        phases: ["roll"],
        victory: { kind: "score-limit" },
      },
    });

    expect(draft.validation.ok).toBe(true);
    expect(draft.summary).toEqual({
      legalIntentCount: 1,
      objectCount: 0,
      phaseCount: 1,
      seatCount: 1,
      zoneCount: 1,
    });
  });

  it("updates validation when objects are edited", () => {
    const draft = createPortablePackEditorDraft({
      game: {
        description: "Arena",
        id: "arena",
        name: "Arena",
        runtime: "lunchtable",
        version: "0.1.0",
      },
      objects: {
        objects: [],
        seats: [],
        zones: [],
      },
      ruleset: {
        legalIntents: [{ kind: "fire" }],
        phases: ["combat"],
        victory: { kind: "score-limit" },
      },
    });

    const edited = addObjectToPortablePackDraft(draft, {
      id: "piece:player",
      kind: "piece",
      name: "Player",
      ownerSeat: null,
      state: "ready",
      visibility: "public",
      zoneId: "missing-zone",
    });

    expect(edited.validation.ok).toBe(false);
    expect(edited.validation.issues).toEqual([
      expect.objectContaining({ code: "unknownObjectZone" }),
    ]);
  });

  it("exports stable portable pack files", () => {
    const draft = createPortablePackEditorDraft({
      game: {
        description: "Runner",
        id: "runner",
        name: "Runner",
        runtime: "lunchtable",
        version: "0.1.0",
      },
      objects: {
        objects: [],
        seats: [],
        zones: [],
      },
      ruleset: {
        legalIntents: [{ kind: "move" }],
        phases: ["run"],
        victory: { kind: "reach-goal" },
      },
    });

    expect(exportPortablePackDraft(draft)).toEqual({
      "game.json": `${JSON.stringify(draft.game, null, 2)}\n`,
      "objects.json": `${JSON.stringify(draft.objects, null, 2)}\n`,
      "ruleset.json": `${JSON.stringify(draft.ruleset, null, 2)}\n`,
    });
  });
});
