import { createSideScrollerAssetBundle } from "@lunchtable/games-assets";
import { describe, expect, it } from "vitest";

import {
  createSideScrollerInitialState,
  deriveSideScrollerRenderScene,
  sideScrollerStarterConfig,
} from "./engine";

describe("side-scroller asset bundle integration", () => {
  it("adds renderer asset hints without changing rules state", () => {
    const config = {
      ...sideScrollerStarterConfig,
      assets: createSideScrollerAssetBundle({
        bindings: [
          {
            assetId: "sprite:runner",
            clip: "clip:runner:run",
            objectId: "piece:runner-seat-0",
          },
          {
            assetId: "sprite:hazard",
            frame: 0,
            objectId: "token:hazard-1",
          },
        ],
        clips: [],
        hitboxes: [],
        id: "assets:side-runner",
        name: "Side Runner Assets",
        sprites: [],
        tilemaps: [],
        timelines: [],
      }),
    };
    const state = createSideScrollerInitialState(config);
    const scene = deriveSideScrollerRenderScene(config, state, {
      height: 720,
      width: 1280,
    });

    expect(
      scene.objects.find((object) => object.id === "piece:runner-seat-0")
        ?.asset,
    ).toEqual({
      assetId: "sprite:runner",
      clip: "clip:runner:run",
    });
    expect(
      scene.objects.find((object) => object.id === "token:hazard-1")?.asset,
    ).toEqual({
      assetId: "sprite:hazard",
      frame: 0,
    });
    expect(state.runners["seat-0"].x).toBe(0);
  });
});
