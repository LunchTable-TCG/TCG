import { describe, expect, test } from "vitest";

import { createSceneCue } from "./scene";

describe("createSceneCue", () => {
  test("returns a copied cue object", () => {
    const cue = {
      accentSeat: "seat-a",
      eventSequence: 7,
      kind: "combat" as const,
      label: "Attackers declared",
    };

    const sceneCue = createSceneCue(cue);

    expect(sceneCue).toEqual(cue);
    expect(sceneCue).not.toBe(cue);
  });
});
