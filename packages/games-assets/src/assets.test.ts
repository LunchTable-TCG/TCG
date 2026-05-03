import { describe, expect, it } from "vitest";

import {
  createAnimationClip,
  createElizaImageGenerationRequest,
  createHitboxSet,
  createSceneTimeline,
  createSideScrollerAssetBundle,
  createSpriteSheetAsset,
  createTilemapAsset,
  exportSpriteAtlasJson,
  parseElizaImageGenerationResponse,
  validateAssetBundle,
} from "./index";

describe("Lunch Table Games asset primitives", () => {
  it("creates and validates a side-scroller sprite asset bundle", () => {
    const runner = createSpriteSheetAsset({
      frame: { columns: 4, height: 32, rows: 2, totalFrames: 8, width: 32 },
      id: "sprite:runner",
      image: {
        height: 64,
        mediaType: "image/png",
        storageId: "storage-runner",
        width: 128,
      },
      name: "Runner",
      pivot: { x: 0.5, y: 1 },
    });
    const run = createAnimationClip({
      assetId: runner.id,
      fps: 12,
      fromFrame: 0,
      id: "clip:runner:run",
      loop: true,
      name: "Run",
      playback: "forward",
      toFrame: 7,
    });
    const hitboxes = createHitboxSet({
      assetId: runner.id,
      boxes: [
        {
          frame: 1,
          height: 18.7,
          kind: "hurt",
          width: 10.2,
          x: 11.8,
          y: 13.1,
        },
      ],
      id: "hitbox:runner",
    });
    const tilemap = createTilemapAsset({
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
      tilesetAssetId: runner.id,
    });
    const timeline = createSceneTimeline({
      id: "timeline:runner",
      name: "Runner clips",
      scenes: [
        {
          clipId: run.id,
          id: "scene:run",
          loopCount: "infinite",
          name: "Run",
          order: 2,
        },
        {
          clipId: run.id,
          id: "scene:intro",
          loopCount: 1,
          name: "Intro",
          order: 1,
        },
      ],
    });

    const bundle = createSideScrollerAssetBundle({
      bindings: [
        {
          assetId: runner.id,
          clip: run.id,
          objectId: "piece:runner-seat-0",
        },
      ],
      clips: [run],
      hitboxes: [hitboxes],
      id: "assets:side-runner",
      name: "Side Runner Assets",
      sprites: [runner],
      tilemaps: [tilemap],
      timelines: [timeline],
    });

    expect(hitboxes.boxes[0]).toEqual({
      frame: 1,
      height: 19,
      kind: "hurt",
      width: 10,
      x: 12,
      y: 13,
    });
    expect(bundle.sideScroller.bindings[0]).toEqual({
      assetId: "sprite:runner",
      clip: "clip:runner:run",
      objectId: "piece:runner-seat-0",
    });
    expect(timeline.scenes.map((scene) => scene.id)).toEqual([
      "scene:intro",
      "scene:run",
    ]);
    expect(validateAssetBundle(bundle)).toEqual({
      issues: [],
      ok: true,
      summary: {
        animationClipCount: 1,
        hitboxSetCount: 1,
        spriteCount: 1,
        tilemapCount: 1,
        timelineCount: 1,
      },
    });
  });

  it("exports sprite atlas JSON with clips and normalized pivot metadata", () => {
    const sprite = createSpriteSheetAsset({
      frame: { columns: 2, height: 16, rows: 2, totalFrames: 4, width: 16 },
      id: "sprite:coin",
      image: {
        height: 32,
        mediaType: "image/png",
        url: "https://assets.example/coin.png",
        width: 32,
      },
      name: "Coin",
      pivot: { x: 0.5, y: 0.5 },
    });
    const spin = createAnimationClip({
      assetId: sprite.id,
      fps: 8,
      fromFrame: 0,
      id: "clip:coin:spin",
      loop: true,
      name: "Spin",
      playback: "forward",
      toFrame: 3,
    });

    expect(JSON.parse(exportSpriteAtlasJson(sprite, [spin]))).toEqual({
      animations: [
        {
          fps: 8,
          fromFrame: 0,
          id: "clip:coin:spin",
          loop: true,
          name: "Spin",
          playback: "forward",
          toFrame: 3,
        },
      ],
      frames: [
        { height: 16, index: 0, width: 16, x: 0, y: 0 },
        { height: 16, index: 1, width: 16, x: 16, y: 0 },
        { height: 16, index: 2, width: 16, x: 0, y: 16 },
        { height: 16, index: 3, width: 16, x: 16, y: 16 },
      ],
      meta: {
        assetId: "sprite:coin",
        image: "https://assets.example/coin.png",
        name: "Coin",
        pivot: { x: 0.5, y: 0.5 },
        size: { height: 32, width: 32 },
      },
    });
  });

  it("builds elizaOS Cloud image generation requests and parses responses", () => {
    const request = createElizaImageGenerationRequest({
      apiKey: "cloud-key",
      aspectRatio: "1:1",
      model: "google/gemini-2.5-flash-image",
      numImages: 1,
      prompt: "pixel art runner sprite sheet",
      stylePreset: "digital-art",
    });

    expect(request).toEqual({
      body: {
        aspectRatio: "1:1",
        model: "google/gemini-2.5-flash-image",
        numImages: 1,
        prompt: "pixel art runner sprite sheet",
        stylePreset: "digital-art",
      },
      headers: {
        Authorization: "Bearer cloud-key",
        "Content-Type": "application/json",
      },
      method: "POST",
      url: "https://elizacloud.ai/api/v1/generate-image",
    });
    expect(
      parseElizaImageGenerationResponse({
        images: [{ image: "aW1hZ2U=", url: "https://assets.example/out.png" }],
      }),
    ).toEqual({
      images: [
        {
          base64: "aW1hZ2U=",
          url: "https://assets.example/out.png",
        },
      ],
    });
  });
});
