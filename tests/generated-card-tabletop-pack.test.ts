import {
  createGeneratedCardTabletopPack,
  validateGeneratedCardTabletopPack,
} from "@lunchtable/card-content";
import { describe, expect, it } from "vitest";

describe("generated card tabletop pack admission", () => {
  it("creates a valid tabletop pack for the starter card duel", () => {
    const pack = createGeneratedCardTabletopPack();

    expect(validateGeneratedCardTabletopPack(pack)).toEqual({
      issues: [],
      ok: true,
    });
    expect(pack.manifest.id).toBe("standard-alpha-card-duel");
    expect(pack.objects.some((object) => object.kind === "card")).toBe(true);
    expect(pack.zones.some((zone) => zone.kind === "deck")).toBe(true);
  });
});
