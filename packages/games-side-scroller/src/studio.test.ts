import { describe, expect, it } from "vitest";

import { createSideScrollerAssetBundle } from "@lunchtable/games-assets";

import { sideScrollerStarterConfig } from "./engine";
import {
  createSideScrollerStudioFrame,
  runSideScrollerSelfPlay,
} from "./studio";

describe("side-scroller studio authoring", () => {
  it("creates an agent-readable studio frame from level, assets, scene, and legal actions", () => {
    const frame = createSideScrollerStudioFrame(sideScrollerStarterConfig, {
      height: 720,
      width: 1280,
    });

    expect(frame).toMatchObject({
      assets: {
        boundObjectCount: 0,
        generatedPlatformCount: 0,
        ready: false,
      },
      level: {
        collectibleCount: 1,
        goalCount: 1,
        hazardCount: 1,
        id: "level-1",
        platformCount: 2,
        runnerCount: 2,
      },
      scene: {
        cameraTarget: { x: 0, y: 0, z: 0 },
        objectCount: 8,
      },
    });
    expect(frame.seats).toEqual([
      {
        agentReady: true,
        health: 3,
        legalIntentKinds: ["moveLeft", "moveRight", "dash", "jump", "wait"],
        score: 0,
        seatId: "seat-0",
        x: 0,
        y: 0,
      },
      {
        agentReady: true,
        health: 3,
        legalIntentKinds: ["moveLeft", "moveRight", "dash", "jump", "wait"],
        score: 0,
        seatId: "seat-1",
        x: 0,
        y: 0,
      },
    ]);
  });

  it("runs deterministic self-play for studio previews and agent evaluation", () => {
    const first = runSideScrollerSelfPlay(sideScrollerStarterConfig, {
      maxTurns: 16,
    });
    const second = runSideScrollerSelfPlay(sideScrollerStarterConfig, {
      maxTurns: 16,
    });

    expect(first).toEqual(second);
    expect(first.steps.length).toBe(16);
    expect(first.steps[0]).toMatchObject({
      action: { kind: "moveRight", seatId: "seat-0" },
      seatId: "seat-0",
      stateVersion: 1,
      tick: 1,
    });
    expect(
      first.steps.some((step) =>
        step.events.some((event) => event.kind === "hazardDefeated"),
      ),
    ).toBe(true);
    expect(first.finalState.shell.version).toBe(first.steps.length);
  });

  it("keeps invalid asset-studio collision metadata inspectable", () => {
    const frame = createSideScrollerStudioFrame(
      {
        ...sideScrollerStarterConfig,
        assets: createSideScrollerAssetBundle({
          bindings: [],
          clips: [],
          collisionTilemapId: "tilemap:missing",
          hitboxes: [],
          id: "assets:side-runner",
          name: "Side Runner Assets",
          sprites: [],
          tilemaps: [],
          timelines: [],
        }),
      },
      {
        height: 720,
        width: 1280,
      },
    );

    expect(frame.assets).toMatchObject({
      generatedPlatformCount: 0,
      ready: false,
    });
  });
});
