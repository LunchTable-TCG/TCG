import { describe, expect, it } from "vitest";

import { createCameraHint, createInteractionHint } from "./camera";

describe("render camera and interaction hints", () => {
  it("creates renderer-neutral camera hints", () => {
    expect(
      createCameraHint({
        mode: "perspective-3d",
        target: { x: 0, y: 1, z: 0 },
        zoom: 1.2,
      }),
    ).toEqual({
      mode: "perspective-3d",
      target: { x: 0, y: 1, z: 0 },
      zoom: 1.2,
    });
  });

  it("creates renderer-neutral interaction hints", () => {
    expect(
      createInteractionHint({
        affordance: "drag",
        objectId: "piece:hero",
        seatId: "seat-0",
      }),
    ).toEqual({
      affordance: "drag",
      objectId: "piece:hero",
      seatId: "seat-0",
    });
  });
});
