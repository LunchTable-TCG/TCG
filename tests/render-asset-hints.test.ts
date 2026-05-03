import type { RenderObjectModel } from "@lunchtable/games-render";
import { describe, expect, it } from "vitest";

describe("renderer asset hints", () => {
  it("allows render objects to reference authored assets without renderer coupling", () => {
    const object: RenderObjectModel = {
      asset: {
        assetId: "sprite:runner",
        clip: "clip:runner:run",
        variant: "blue-team",
      },
      id: "piece:runner-seat-0",
      interactive: true,
      label: "Runner",
      position: { x: 0, y: 0, z: 2 },
      size: { height: 72, width: 36 },
    };

    expect(object.asset).toEqual({
      assetId: "sprite:runner",
      clip: "clip:runner:run",
      variant: "blue-team",
    });
  });
});
