import { describe, expect, it } from "vitest";

import {
  createDefaultRendererAdapters,
  createRendererAdapterPlan,
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

  it("plans renderer layers, fallback adapters, and production budgets for scenes", () => {
    const plan = createRendererAdapterPlan(
      {
        camera: {
          mode: "side-scroller",
          target: { x: 320, y: 180, z: 0 },
          zoom: 1,
        },
        cue: null,
        interactions: [
          { affordance: "move", objectId: "runner", seatId: "seat-0" },
        ],
        objects: [
          {
            id: "runner",
            interactive: true,
            label: "Runner",
            position: { x: 320, y: 180, z: 0 },
            size: { height: 64, width: 48 },
          },
        ],
        viewport: { height: 720, width: 1280 },
      },
      createRendererAdapterRegistry(createDefaultRendererAdapters()),
    );

    expect(plan.primaryAdapter.id).toBe("pixi-2d");
    expect(plan.fallbackAdapters.map((adapter) => adapter.id)).toEqual([
      "dom-accessible",
    ]);
    expect(plan.layers).toEqual([
      "world",
      "interactions",
      "hud",
      "accessibility",
    ]);
    expect(plan.budget).toEqual({
      maxInteractiveObjects: 500,
      maxSceneObjects: 2500,
      targetFrameMs: 16,
    });
  });
});
