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

  it("rejects objects assigned to unknown zones", () => {
    const pack = createGeneratedCardTabletopPack();
    const object = pack.objects[0];

    pack.objects[0] = {
      ...object,
      zoneId: "missing-zone",
    };

    expect(validateGeneratedCardTabletopPack(pack)).toMatchObject({
      issues: [
        {
          code: "unknownObjectZone",
        },
      ],
      ok: false,
    });
  });

  it("rejects objects assigned to unknown owner seats", () => {
    const pack = createGeneratedCardTabletopPack();
    const object = pack.objects[0];

    pack.objects[0] = {
      ...object,
      ownerSeat: "missing-seat",
    };

    expect(validateGeneratedCardTabletopPack(pack)).toMatchObject({
      issues: [
        {
          code: "unknownObjectOwnerSeat",
        },
      ],
      ok: false,
    });
  });

  it("rejects zones assigned to unknown owner seats", () => {
    const pack = createGeneratedCardTabletopPack();

    pack.zones[0] = {
      ...pack.zones[0],
      ownerSeat: "missing-seat",
    };

    expect(validateGeneratedCardTabletopPack(pack)).toMatchObject({
      issues: [
        {
          code: "unknownZoneOwnerSeat",
        },
      ],
      ok: false,
    });
  });

  it("rejects duplicate object ids", () => {
    const pack = createGeneratedCardTabletopPack();
    const object = pack.objects[0];

    pack.objects.push({
      ...object,
      name: `${object.name} Copy`,
    });

    expect(validateGeneratedCardTabletopPack(pack)).toMatchObject({
      issues: [
        {
          code: "duplicateObjectId",
        },
      ],
      ok: false,
    });
  });

  it("rejects duplicate seat ids", () => {
    const pack = createGeneratedCardTabletopPack();
    const seat = pack.seats[0];

    pack.seats.push({
      ...seat,
      name: `${seat.name} Copy`,
    });

    expect(validateGeneratedCardTabletopPack(pack)).toMatchObject({
      issues: [
        {
          code: "duplicateSeatId",
        },
      ],
      ok: false,
    });
  });

  it("rejects duplicate zone ids", () => {
    const pack = createGeneratedCardTabletopPack();
    const zone = pack.zones[0];

    pack.zones.push({
      ...zone,
      name: `${zone.name} Copy`,
    });

    expect(validateGeneratedCardTabletopPack(pack)).toMatchObject({
      issues: [
        {
          code: "duplicateZoneId",
        },
      ],
      ok: false,
    });
  });
});
