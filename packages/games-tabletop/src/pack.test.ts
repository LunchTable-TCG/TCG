import { describe, expect, it } from "vitest";

import {
  type GamePackManifest,
  type PortableGamePack,
  validatePortableGamePack,
} from "./pack";

describe("portable game pack contracts", () => {
  it("describes generated starter metadata", () => {
    const manifest = {
      description: "Dice starter",
      extensionLevel: 1,
      genre: "dice-tabletop",
      id: "dice-starter",
      name: "Dice Starter",
      runtimeVersion: "0.1.0",
      version: "0.1.0",
    } satisfies GamePackManifest;

    expect(manifest.genre).toBe("dice-tabletop");
    expect(manifest.extensionLevel).toBe(1);
  });

  it("groups portable pack assets, scenarios, seats, zones, and objects", () => {
    const pack = {
      assets: [],
      manifest: {
        description: "Arena starter",
        extensionLevel: 3,
        genre: "arena-shooter-3d",
        id: "arena-starter",
        name: "Arena Starter",
        runtimeVersion: "0.1.0",
        version: "0.1.0",
      },
      objects: [],
      scenarios: [
        {
          id: "default",
          name: "Default Arena",
          setupId: "default-setup",
        },
      ],
      seats: [],
      zones: [],
    } satisfies PortableGamePack;

    expect(pack.scenarios[0]?.setupId).toBe("default-setup");
  });

  it("validates portable pack object, seat, and zone references", () => {
    expect(
      validatePortableGamePack({
        objects: [
          {
            id: "piece:hero",
            kind: "piece",
            name: "Hero",
            ownerSeat: "seat-0",
            state: "ready",
            visibility: "private-owner",
            zoneId: "board",
          },
        ],
        seats: [
          {
            actorType: "ai",
            id: "seat-0",
            name: "Seat 0",
            permissions: ["submitIntent"],
            status: "ready",
          },
        ],
        zones: [
          {
            id: "board",
            kind: "board",
            name: "Board",
            ordering: "unordered",
            ownerSeat: null,
            visibility: "public",
          },
        ],
      }),
    ).toEqual({
      issues: [],
      ok: true,
      summary: {
        objectCount: 1,
        seatCount: 1,
        zoneCount: 1,
      },
      valid: true,
    });
  });

  it("rejects invalid portable pack references", () => {
    expect(
      validatePortableGamePack({
        objects: [
          {
            id: "piece:hero",
            kind: "piece",
            name: "Hero",
            ownerSeat: "missing-seat",
            state: "ready",
            visibility: "public",
            zoneId: "missing-zone",
          },
        ],
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
            id: "board",
            kind: "board",
            name: "Board",
            ordering: "unordered",
            ownerSeat: "missing-seat",
            visibility: "public",
          },
        ],
      }),
    ).toMatchObject({
      issues: [
        { code: "unknownObjectZone" },
        { code: "unknownObjectOwnerSeat" },
        { code: "unknownZoneOwnerSeat" },
      ],
      ok: false,
      valid: false,
    });
  });
});
