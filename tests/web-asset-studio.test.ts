import { describe, expect, it } from "vitest";

import {
  createAssetStudioPanelModel,
  createInvalidAssetStudioPanelModel,
} from "../apps/web/src/components/assets/AssetStudioPanel";

describe("browser asset studio panel model", () => {
  it("summarizes generated side-scroller asset readiness", () => {
    expect(createAssetStudioPanelModel()).toEqual({
      bundleId: "assets:side-runner",
      clipCount: 1,
      generatedPlatformCount: 1,
      hitboxCount: 1,
      issueCount: 0,
      previewActionCount: 5,
      previewEventCount: 12,
      primaryAsset: "sprite:runner",
      ready: true,
      readinessBlockedGateCount: 0,
      readinessGateCount: 8,
      readinessRequiredGateCount: 7,
      sceneObjectCount: 9,
      sideScrollerReady: true,
      spriteCount: 2,
      tilemapCount: 1,
      timelineScenes: ["Intro", "Run"],
      title: "Side Runner Assets",
    });
  });

  it("surfaces invalid asset bundle readiness", () => {
    expect(createInvalidAssetStudioPanelModel()).toMatchObject({
      issueCount: 2,
      ready: false,
      readinessBlockedGateCount: 5,
      title: "Broken Side Runner Assets",
    });
  });
});
