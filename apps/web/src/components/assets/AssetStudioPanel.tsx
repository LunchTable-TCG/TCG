import {
  type AssetBundleValidationResult,
  createAnimationClip,
  createHitboxSet,
  createSceneTimeline,
  createSideScrollerAssetBundle,
  createSideScrollerAssetReadinessReport,
  createSpriteSheetAsset,
  createTilemapAsset,
  validateAssetBundle,
} from "@lunchtable/games-assets";
import {
  createSideScrollerStudioFrame,
  runSideScrollerSelfPlay,
  sideScrollerStarterConfig,
} from "@lunchtable/games-side-scroller";

export interface AssetStudioPanelModel {
  bundleId: string;
  clipCount: number;
  generatedPlatformCount: number;
  hitboxCount: number;
  issueCount: number;
  previewActionCount: number;
  previewEventCount: number;
  primaryAsset: string;
  ready: boolean;
  readinessBlockedGateCount: number;
  readinessGateCount: number;
  readinessRequiredGateCount: number;
  sceneObjectCount: number;
  sideScrollerReady: boolean;
  spriteCount: number;
  tilemapCount: number;
  timelineScenes: string[];
  title: string;
}

export function createAssetStudioPanelModel(): AssetStudioPanelModel {
  return createModelFromValidation(createSampleAssetBundle());
}

export function createInvalidAssetStudioPanelModel(): AssetStudioPanelModel {
  return createModelFromValidation(createInvalidAssetBundle());
}

export function AssetStudioPanel() {
  const model = createAssetStudioPanelModel();

  return (
    <section
      className="asset-studio-panel"
      aria-labelledby="asset-studio-title"
    >
      <div className="pack-editor-header">
        <div>
          <p className="eyebrow">Asset Studio</p>
          <h2 id="asset-studio-title">{model.title}</h2>
        </div>
        <span
          className={`pack-editor-status pack-editor-status-${
            model.ready ? "valid" : "invalid"
          }`}
        >
          {model.ready ? "ready" : "blocked"}
        </span>
      </div>
      <div className="pack-editor-grid">
        <div>
          <span className="metric-label">Sprites</span>
          <strong>{model.spriteCount}</strong>
        </div>
        <div>
          <span className="metric-label">Clips</span>
          <strong>{model.clipCount}</strong>
        </div>
        <div>
          <span className="metric-label">Issues</span>
          <strong>{model.issueCount}</strong>
        </div>
        <div>
          <span className="metric-label">Blocked</span>
          <strong>{model.readinessBlockedGateCount}</strong>
        </div>
        <div>
          <span className="metric-label">Actions</span>
          <strong>{model.previewActionCount}</strong>
        </div>
      </div>
      <div className="pack-editor-files">
        <span>{model.primaryAsset}</span>
        <span>{model.hitboxCount} hitbox set</span>
        <span>{model.tilemapCount} tilemap</span>
        <span>{model.sceneObjectCount} scene objects</span>
        <span>{model.generatedPlatformCount} generated platform</span>
        <span>
          {model.readinessRequiredGateCount}/{model.readinessGateCount} gates
        </span>
      </div>
      <div className="pack-editor-gates">
        {model.timelineScenes.map((scene) => (
          <span key={scene}>{scene}</span>
        ))}
      </div>
    </section>
  );
}

function createModelFromValidation(
  input: ReturnType<typeof createSampleAssetBundle>,
): AssetStudioPanelModel {
  const validation: AssetBundleValidationResult = validateAssetBundle(input);
  const readiness = createSideScrollerAssetReadinessReport(input);
  const timeline = input.timelines[0];
  const sideScrollerConfig = {
    ...sideScrollerStarterConfig,
    assets: input,
  };
  const studioFrame = createSideScrollerStudioFrame(sideScrollerConfig, {
    height: 720,
    width: 1280,
  });
  const preview = runSideScrollerSelfPlay(sideScrollerConfig, {
    maxTurns: 11,
  });

  return {
    bundleId: input.id,
    clipCount: input.clips.length,
    generatedPlatformCount: studioFrame.assets.generatedPlatformCount,
    hitboxCount: input.hitboxes.length,
    issueCount: validation.issues.length,
    previewActionCount: studioFrame.seats[0]?.legalIntentKinds.length ?? 0,
    previewEventCount: preview.steps.reduce(
      (total, step) => total + step.events.length,
      0,
    ),
    primaryAsset: input.sprites[0]?.id ?? "none",
    readinessBlockedGateCount: readiness.blockedGateCount,
    readinessGateCount: readiness.gates.length,
    readinessRequiredGateCount: readiness.requiredGateCount,
    ready: readiness.ready,
    sceneObjectCount: studioFrame.scene.objectCount,
    sideScrollerReady: studioFrame.seats.every((seat) => seat.agentReady),
    spriteCount: input.sprites.length,
    tilemapCount: input.tilemaps.length,
    timelineScenes: timeline?.scenes.map((scene) => scene.name) ?? [],
    title: input.name,
  };
}

function createSampleAssetBundle() {
  const runner = createSpriteSheetAsset({
    frame: { columns: 4, height: 32, rows: 2, totalFrames: 8, width: 32 },
    id: "sprite:runner",
    image: {
      height: 64,
      mediaType: "image/png",
      storageId: "storage:runner",
      width: 128,
    },
    name: "Runner",
    pivot: { x: 0.5, y: 1 },
  });
  const hazard = createSpriteSheetAsset({
    frame: { columns: 1, height: 32, rows: 1, totalFrames: 1, width: 32 },
    id: "sprite:hazard",
    image: {
      height: 32,
      mediaType: "image/png",
      storageId: "storage:hazard",
      width: 32,
    },
    name: "Hazard",
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

  return createSideScrollerAssetBundle({
    bindings: [
      {
        assetId: runner.id,
        clip: run.id,
        objectId: "piece:runner-seat-0",
      },
      {
        assetId: hazard.id,
        frame: 0,
        objectId: "token:hazard-1",
      },
    ],
    clips: [run],
    collisionTilemapId: "tilemap:level-1",
    hitboxes: [
      createHitboxSet({
        assetId: runner.id,
        boxes: [
          {
            frame: 0,
            height: 26,
            kind: "hurt",
            width: 14,
            x: 9,
            y: 6,
          },
        ],
        id: "hitbox:runner",
      }),
    ],
    id: "assets:side-runner",
    name: "Side Runner Assets",
    sprites: [runner, hazard],
    tilemaps: [
      createTilemapAsset({
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
      }),
    ],
    timelines: [
      createSceneTimeline({
        id: "timeline:runner",
        name: "Runner timeline",
        scenes: [
          {
            clipId: run.id,
            id: "scene:intro",
            loopCount: 1,
            name: "Intro",
            order: 1,
          },
          {
            clipId: run.id,
            id: "scene:run",
            loopCount: "infinite",
            name: "Run",
            order: 2,
          },
        ],
      }),
    ],
  });
}

function createInvalidAssetBundle() {
  const runner = createSpriteSheetAsset({
    frame: { columns: 1, height: 32, rows: 1, totalFrames: 1, width: 32 },
    id: "sprite:runner",
    image: {
      height: 32,
      mediaType: "image/png",
      storageId: "storage:runner",
      width: 32,
    },
    name: "Runner",
    pivot: { x: 0.5, y: 1 },
  });

  return createSideScrollerAssetBundle({
    bindings: [],
    clips: [
      createAnimationClip({
        assetId: "sprite:missing",
        fps: 12,
        fromFrame: 0,
        id: "clip:runner:run",
        loop: true,
        name: "Run",
        playback: "forward",
        toFrame: 0,
      }),
    ],
    hitboxes: [],
    id: "assets:broken-side-runner",
    name: "Broken Side Runner Assets",
    sprites: [runner],
    tilemaps: [
      createTilemapAsset({
        cellSize: 32,
        columns: 2,
        id: "tilemap:broken",
        layers: [
          {
            data: [[0]],
            id: "layer:collision",
            kind: "collision",
            name: "Collision",
            visible: false,
          },
        ],
        name: "Broken Level",
        rows: 2,
        tilesetAssetId: runner.id,
      }),
    ],
    timelines: [],
  });
}
