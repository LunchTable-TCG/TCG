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
      hitboxCount: 1,
      issueCount: 0,
      primaryAsset: "sprite:runner",
      ready: true,
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
      title: "Broken Side Runner Assets",
    });
  });
});
