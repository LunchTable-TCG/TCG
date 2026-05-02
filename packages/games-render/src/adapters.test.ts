import { describe, expect, it } from "vitest";

import {
  createDefaultRendererAdapters,
  createRendererAdapterRegistry,
} from "./adapters";

describe("renderer adapter descriptors", () => {
  it("advertises browser renderer capabilities by camera family", () => {
    expect(createDefaultRendererAdapters()).toEqual([
      expect.objectContaining({
        id: "dom-accessible",
        supportedCameraModes: ["orthographic-2d", "side-scroller"],
      }),
      expect.objectContaining({
        id: "pixi-2d",
        supportedCameraModes: [
          "orthographic-2d",
          "isometric-2.5d",
          "side-scroller",
        ],
      }),
      expect.objectContaining({
        id: "three-3d",
        supportedCameraModes: ["perspective-3d", "first-person"],
      }),
    ]);
  });

  it("selects the best adapter without importing renderer runtimes", () => {
    const registry = createRendererAdapterRegistry(
      createDefaultRendererAdapters(),
    );

    expect(registry.findByCameraMode("first-person")?.id).toBe("three-3d");
    expect(registry.findByCameraMode("isometric-2.5d")?.id).toBe("pixi-2d");
    expect(registry.findByCameraMode("orthographic-2d")?.id).toBe(
      "dom-accessible",
    );
  });
});
