import { createSideScrollerAssetBundle } from "@lunchtable/games-assets";
import { describe, expect, it } from "vitest";

import {
  createSideScrollerInitialState,
  createSideScrollerPlatformsFromAssetBundle,
  createSideScrollerRuntimePlatforms,
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

  it("derives side-scroller platforms from asset-studio collision tilemaps", () => {
    const bundle = createSideScrollerAssetBundle({
      bindings: [],
      clips: [],
      collisionTilemapId: "tilemap:level-1",
      hitboxes: [],
      id: "assets:side-runner",
      name: "Side Runner Assets",
      sprites: [],
      tilemaps: [
        {
          cellSize: 32,
          columns: 5,
          id: "tilemap:level-1",
          layers: [
            {
              data: [
                [-1, -1, -1, -1, -1],
                [-1, -1, 2, 2, 2],
                [0, 0, 0, -1, -1],
              ],
              id: "layer:collision",
              kind: "collision",
              name: "Collision",
              visible: false,
            },
          ],
          name: "Level 1",
          rows: 3,
          tilesetAssetId: "sprite:tiles",
        },
      ],
      timelines: [],
    });

    expect(createSideScrollerPlatformsFromAssetBundle(bundle)).toEqual([
      {
        height: 32,
        id: "platform:tilemap:level-1:layer:collision:r1:c2-4",
        width: 96,
        x: 112,
        y: 32,
      },
      {
        height: 32,
        id: "platform:tilemap:level-1:layer:collision:r2:c0-2",
        width: 96,
        x: 48,
        y: 0,
      },
    ]);
  });

  it("loads generated collision platforms into the runtime state", () => {
    const bundle = createSideScrollerAssetBundle({
      bindings: [],
      clips: [],
      collisionTilemapId: "tilemap:level-1",
      hitboxes: [],
      id: "assets:side-runner",
      name: "Side Runner Assets",
      sprites: [],
      tilemaps: [
        {
          cellSize: 32,
          columns: 3,
          id: "tilemap:level-1",
          layers: [
            {
              data: [
                [-1, -1, -1],
                [0, 0, 0],
              ],
              id: "layer:collision",
              kind: "collision",
              name: "Collision",
              visible: false,
            },
          ],
          name: "Level 1",
          rows: 2,
          tilesetAssetId: "sprite:tiles",
        },
      ],
      timelines: [],
    });
    const config = { ...sideScrollerStarterConfig, assets: bundle };

    expect(createSideScrollerRuntimePlatforms(config)).toHaveLength(3);
    expect(createSideScrollerInitialState(config).platforms).toContainEqual({
      height: 32,
      id: "platform:tilemap:level-1:layer:collision:r1:c0-2",
      width: 96,
      x: 48,
      y: 0,
    });
  });
});
