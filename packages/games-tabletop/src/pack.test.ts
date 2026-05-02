import { describe, expect, it } from "vitest";

import type { GamePackManifest, PortableGamePack } from "./pack";

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
});
