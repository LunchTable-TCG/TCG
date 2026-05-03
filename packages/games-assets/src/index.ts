export type AssetMediaType = "image/jpeg" | "image/png" | "image/webp";

export interface PivotPoint {
  x: number;
  y: number;
}

export interface SpriteSheetImageRef {
  height: number;
  mediaType: AssetMediaType;
  storageId?: string;
  url?: string;
  width: number;
}

export interface SpriteSheetFrameGrid {
  columns: number;
  height: number;
  rows: number;
  totalFrames: number;
  width: number;
}

export interface SpriteSheetAsset {
  frame: SpriteSheetFrameGrid;
  id: string;
  image: SpriteSheetImageRef;
  kind: "sprite-sheet";
  name: string;
  pivot: PivotPoint;
}

export type AnimationPlaybackMode = "forward" | "pingpong" | "reverse";

export interface AnimationClip {
  assetId: string;
  fps: number;
  fromFrame: number;
  id: string;
  loop: boolean;
  name: string;
  playback: AnimationPlaybackMode;
  toFrame: number;
}

export type HitboxKind = "attack" | "collision" | "hurt" | "push";

export interface Hitbox {
  frame: number;
  height: number;
  kind: HitboxKind;
  width: number;
  x: number;
  y: number;
}

export interface HitboxSet {
  assetId: string;
  boxes: Hitbox[];
  id: string;
}

export type TilemapLayerKind = "collision" | "visual";

export interface TilemapLayer {
  data: number[][];
  id: string;
  kind: TilemapLayerKind;
  name: string;
  visible: boolean;
}

export interface TilemapAsset {
  cellSize: number;
  columns: number;
  id: string;
  layers: TilemapLayer[];
  name: string;
  rows: number;
  tilesetAssetId: string;
}

export interface SceneTimelineScene {
  clipId: string;
  id: string;
  loopCount: number | "infinite";
  name: string;
  order: number;
}

export interface SceneTimeline {
  id: string;
  name: string;
  scenes: SceneTimelineScene[];
}

export interface SideScrollerAssetBinding {
  assetId: string;
  clip?: string;
  frame?: number;
  objectId: string;
  variant?: string;
}

export interface AssetBundle {
  clips: AnimationClip[];
  hitboxes: HitboxSet[];
  id: string;
  name: string;
  sprites: SpriteSheetAsset[];
  tilemaps: TilemapAsset[];
  timelines: SceneTimeline[];
}

export interface SideScrollerAssetBundle extends AssetBundle {
  sideScroller: {
    bindings: SideScrollerAssetBinding[];
    collisionTilemapId: string | null;
  };
}

export type AssetBundleValidationIssueCode =
  | "duplicateAssetId"
  | "invalidAnimationFrameRange"
  | "invalidTilemapLayer"
  | "unknownBindingAsset"
  | "unknownBindingClip"
  | "unknownClipAsset"
  | "unknownHitboxAsset"
  | "unknownTilemapTileset"
  | "unknownTimelineClip";

export interface AssetBundleValidationIssue {
  code: AssetBundleValidationIssueCode;
  message: string;
  path: string;
  severity: "error";
}

export interface AssetBundleValidationSummary {
  animationClipCount: number;
  hitboxSetCount: number;
  spriteCount: number;
  tilemapCount: number;
  timelineCount: number;
}

export interface AssetBundleValidationResult {
  issues: AssetBundleValidationIssue[];
  ok: boolean;
  summary: AssetBundleValidationSummary;
}

export type ElizaImageAspectRatio =
  | "1:1"
  | "16:9"
  | "21:9"
  | "3:4"
  | "4:3"
  | "9:16"
  | "9:21";

export type ElizaImageStylePreset =
  | "3d-model"
  | "analog-film"
  | "cinematic"
  | "comic-book"
  | "digital-art"
  | "fantasy-art"
  | "isometric"
  | "line-art"
  | "low-poly"
  | "neon-punk"
  | "none"
  | "origami"
  | "photographic";

export interface AssetGenerationRequest {
  apiBaseUrl?: string;
  apiKey: string;
  aspectRatio: ElizaImageAspectRatio;
  model: string;
  numImages: number;
  prompt: string;
  sourceImage?: string;
  stylePreset?: ElizaImageStylePreset;
}

export interface ElizaImageGenerationRequestBody {
  aspectRatio: ElizaImageAspectRatio;
  model: string;
  numImages: number;
  prompt: string;
  sourceImage?: string;
  stylePreset?: ElizaImageStylePreset;
}

export interface ElizaImageGenerationRequest {
  body: ElizaImageGenerationRequestBody;
  headers: Record<string, string>;
  method: "POST";
  url: string;
}

export interface ElizaGeneratedImage {
  base64: string | null;
  url: string | null;
}

export interface ElizaImageGenerationResult {
  images: ElizaGeneratedImage[];
}

export interface ElizaImageGenerationResponseImage {
  image?: string;
  url?: string;
}

export interface ElizaImageGenerationResponseBody {
  images?: ElizaImageGenerationResponseImage[];
}

export type AssetStudioToolAuthority = "export" | "generate-request" | "read";

export type AssetStudioToolName =
  | "exportAssetBundle"
  | "exportSpriteAtlas"
  | "listAssets"
  | "requestImageGeneration"
  | "validateAssets";

export type AssetStudioToolSchemaValueType =
  | "array"
  | "boolean"
  | "integer"
  | "number"
  | "object"
  | "string";

export interface AssetStudioToolSchemaProperty {
  description: string;
  type: AssetStudioToolSchemaValueType;
}

export interface AssetStudioToolSchema {
  additionalProperties: boolean;
  properties: Record<string, AssetStudioToolSchemaProperty>;
  required: string[];
  type: "object";
}

export interface AssetStudioToolDefinition {
  authority: AssetStudioToolAuthority;
  description: string;
  inputSchema: AssetStudioToolSchema;
  name: AssetStudioToolName;
  title: string;
}

export type AssetStudioToolArgumentValue = boolean | null | number | string;

export interface AssetStudioToolCall {
  arguments: Record<string, AssetStudioToolArgumentValue>;
  name: AssetStudioToolName;
}

export type AssetStudioJsonValue =
  | AssetStudioJsonValue[]
  | boolean
  | null
  | number
  | string
  | { [key: string]: AssetStudioJsonValue };

export type AssetStudioJsonObject = { [key: string]: AssetStudioJsonValue };

export interface AssetStudioToolResult {
  content: Array<{
    text: string;
    type: "text";
  }>;
  isError: boolean;
  structuredContent: AssetStudioJsonObject;
}

export interface AssetStudioFrame {
  assets: {
    clips: AnimationClip[];
    hitboxes: HitboxSet[];
    sprites: SpriteSheetAsset[];
    tilemaps: TilemapAsset[];
    timelines: SceneTimeline[];
  };
  bundleId: string;
  bundleName: string;
  summary: AssetBundleValidationSummary;
  tools: AssetStudioToolDefinition[];
  validation: AssetBundleValidationResult;
}

export function createSpriteSheetAsset(
  input: Omit<SpriteSheetAsset, "kind">,
): SpriteSheetAsset {
  return {
    frame: { ...input.frame },
    id: input.id,
    image: { ...input.image },
    kind: "sprite-sheet",
    name: input.name,
    pivot: clampPivot(input.pivot),
  };
}

export function createAnimationClip(input: AnimationClip): AnimationClip {
  return { ...input };
}

export function createHitboxSet(input: HitboxSet): HitboxSet {
  return {
    assetId: input.assetId,
    boxes: input.boxes.map((box) => ({
      frame: Math.max(0, Math.round(box.frame)),
      height: Math.max(0, Math.round(box.height)),
      kind: box.kind,
      width: Math.max(0, Math.round(box.width)),
      x: Math.max(0, Math.round(box.x)),
      y: Math.max(0, Math.round(box.y)),
    })),
    id: input.id,
  };
}

export function createTilemapAsset(input: TilemapAsset): TilemapAsset {
  return {
    cellSize: input.cellSize,
    columns: input.columns,
    id: input.id,
    layers: input.layers.map((layer) => ({
      data: layer.data.map((row) => [...row]),
      id: layer.id,
      kind: layer.kind,
      name: layer.name,
      visible: layer.visible,
    })),
    name: input.name,
    rows: input.rows,
    tilesetAssetId: input.tilesetAssetId,
  };
}

export function createSceneTimeline(input: SceneTimeline): SceneTimeline {
  return {
    id: input.id,
    name: input.name,
    scenes: input.scenes
      .map((scene) => ({ ...scene }))
      .sort((left, right) => left.order - right.order),
  };
}

export function createSideScrollerAssetBundle(
  input: AssetBundle & {
    bindings: SideScrollerAssetBinding[];
    collisionTilemapId?: string | null;
  },
): SideScrollerAssetBundle {
  return {
    clips: input.clips.map(createAnimationClip),
    hitboxes: input.hitboxes.map(createHitboxSet),
    id: input.id,
    name: input.name,
    sideScroller: {
      bindings: input.bindings.map((binding) => ({ ...binding })),
      collisionTilemapId: input.collisionTilemapId ?? null,
    },
    sprites: input.sprites.map((sprite) =>
      createSpriteSheetAsset({
        frame: sprite.frame,
        id: sprite.id,
        image: sprite.image,
        name: sprite.name,
        pivot: sprite.pivot,
      }),
    ),
    tilemaps: input.tilemaps.map(createTilemapAsset),
    timelines: input.timelines.map(createSceneTimeline),
  };
}

export function validateAssetBundle(
  bundle: AssetBundle | SideScrollerAssetBundle,
): AssetBundleValidationResult {
  const spriteById = new Map(
    bundle.sprites.map((sprite) => [sprite.id, sprite] as const),
  );
  const clipById = new Map(
    bundle.clips.map((clip) => [clip.id, clip] as const),
  );
  const issues: AssetBundleValidationIssue[] = [
    ...collectDuplicateAssetIssues(bundle),
    ...collectClipIssues(bundle.clips, spriteById),
    ...collectHitboxIssues(bundle.hitboxes, spriteById),
    ...collectTilemapIssues(bundle.tilemaps, spriteById),
    ...collectTimelineIssues(bundle.timelines, clipById),
    ...collectSideScrollerBindingIssues(bundle, spriteById, clipById),
  ];

  return {
    issues,
    ok: issues.length === 0,
    summary: {
      animationClipCount: bundle.clips.length,
      hitboxSetCount: bundle.hitboxes.length,
      spriteCount: bundle.sprites.length,
      tilemapCount: bundle.tilemaps.length,
      timelineCount: bundle.timelines.length,
    },
  };
}

export function exportSpriteAtlasJson(
  sprite: SpriteSheetAsset,
  clips: AnimationClip[],
): string {
  return `${JSON.stringify(
    {
      animations: clips
        .filter((clip) => clip.assetId === sprite.id)
        .map((clip) => ({
          fps: clip.fps,
          fromFrame: clip.fromFrame,
          id: clip.id,
          loop: clip.loop,
          name: clip.name,
          playback: clip.playback,
          toFrame: clip.toFrame,
        })),
      frames: Array.from({ length: sprite.frame.totalFrames }, (_, index) => ({
        height: sprite.frame.height,
        index,
        width: sprite.frame.width,
        x: (index % sprite.frame.columns) * sprite.frame.width,
        y: Math.floor(index / sprite.frame.columns) * sprite.frame.height,
      })),
      meta: {
        assetId: sprite.id,
        image: sprite.image.url ?? sprite.image.storageId ?? sprite.id,
        name: sprite.name,
        pivot: { ...sprite.pivot },
        size: {
          height: sprite.image.height,
          width: sprite.image.width,
        },
      },
    },
    null,
    2,
  )}\n`;
}

export function createElizaImageGenerationRequest(
  input: AssetGenerationRequest,
): ElizaImageGenerationRequest {
  const apiBaseUrl = input.apiBaseUrl ?? "https://elizacloud.ai";
  const body: ElizaImageGenerationRequestBody = {
    aspectRatio: input.aspectRatio,
    model: input.model,
    numImages: clampInteger(input.numImages, 1, 4),
    prompt: input.prompt,
    ...(input.sourceImage === undefined
      ? {}
      : { sourceImage: input.sourceImage }),
    ...(input.stylePreset === undefined
      ? {}
      : { stylePreset: input.stylePreset }),
  };

  return {
    body,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    url: `${apiBaseUrl}/api/v1/generate-image`,
  };
}

export function parseElizaImageGenerationResponse(
  input: ElizaImageGenerationResponseBody,
): ElizaImageGenerationResult {
  const images = input.images ?? [];
  if (images.length === 0) {
    throw new Error(
      "elizaOS Cloud image generation response contained no images",
    );
  }

  return {
    images: images.map((image) => ({
      base64: image.image ?? null,
      url: image.url ?? null,
    })),
  };
}

export function createAssetStudioToolDefinitions(): AssetStudioToolDefinition[] {
  return [
    createAssetStudioTool(
      "listAssets",
      "List sprite sheets, clips, hitboxes, tilemaps, timelines, and validation summary.",
      "read",
      {},
      [],
    ),
    createAssetStudioTool(
      "validateAssets",
      "Validate the asset bundle for pack readiness.",
      "read",
      {},
      [],
    ),
    createAssetStudioTool(
      "exportAssetBundle",
      "Export the current asset bundle as pack-ready JSON.",
      "export",
      {},
      [],
    ),
    createAssetStudioTool(
      "exportSpriteAtlas",
      "Export one sprite sheet atlas JSON with clip metadata.",
      "export",
      {
        spriteId: {
          description: "Sprite sheet asset id to export.",
          type: "string",
        },
      },
      ["spriteId"],
    ),
    createAssetStudioTool(
      "requestImageGeneration",
      "Create a server-routable elizaOS Cloud image generation request envelope.",
      "generate-request",
      {
        name: {
          description: "Generated asset display name.",
          type: "string",
        },
        prompt: {
          description: "Generation prompt for the side-scroller asset.",
          type: "string",
        },
      },
      ["name", "prompt"],
    ),
  ];
}

export function createAssetStudioFrame(
  bundle: AssetBundle | SideScrollerAssetBundle,
): AssetStudioFrame {
  const validation = validateAssetBundle(bundle);

  return {
    assets: {
      clips: bundle.clips.map(createAnimationClip),
      hitboxes: bundle.hitboxes.map(createHitboxSet),
      sprites: bundle.sprites.map((sprite) =>
        createSpriteSheetAsset({
          frame: sprite.frame,
          id: sprite.id,
          image: sprite.image,
          name: sprite.name,
          pivot: sprite.pivot,
        }),
      ),
      tilemaps: bundle.tilemaps.map(createTilemapAsset),
      timelines: bundle.timelines.map(createSceneTimeline),
    },
    bundleId: bundle.id,
    bundleName: bundle.name,
    summary: validation.summary,
    tools: createAssetStudioToolDefinitions(),
    validation,
  };
}

export function runAssetStudioTool(
  bundle: AssetBundle | SideScrollerAssetBundle,
  call: AssetStudioToolCall,
): AssetStudioToolResult {
  try {
    if (call.name === "listAssets") {
      return createAssetStudioToolResult({
        frame: toAssetStudioJsonValue(createAssetStudioFrame(bundle)),
      });
    }

    if (call.name === "validateAssets") {
      return createAssetStudioToolResult({
        validation: toAssetStudioJsonValue(validateAssetBundle(bundle)),
      });
    }

    if (call.name === "exportAssetBundle") {
      return createAssetStudioToolResult({
        bundleJson: `${JSON.stringify(bundle, null, 2)}\n`,
      });
    }

    if (call.name === "exportSpriteAtlas") {
      const spriteId = requireToolString(call.arguments, "spriteId");
      const sprite = bundle.sprites.find(
        (candidate) => candidate.id === spriteId,
      );
      if (sprite === undefined) {
        return createAssetStudioToolError(`Unknown sprite asset: ${spriteId}`);
      }

      return createAssetStudioToolResult({
        atlasJson: exportSpriteAtlasJson(sprite, bundle.clips),
        spriteId,
      });
    }

    const name = requireToolString(call.arguments, "name");
    const prompt = requireToolString(call.arguments, "prompt");
    return createAssetStudioToolResult({
      directApiKeyExposed: false,
      provider: "elizaOS Cloud",
      requiredSecretEnv: "ELIZA_CLOUD_API_KEY",
      request: {
        name,
        prompt,
      },
      serverAction: "assets.generateSideScrollerAsset",
      suggested: {
        aspectRatio: "1:1",
        model: "google/gemini-2.5-flash-image",
        stylePreset: "digital-art",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.length > 0) {
      return createAssetStudioToolError(error.message);
    }
    return createAssetStudioToolError("Asset studio tool failed");
  }
}

function createAssetStudioTool(
  name: AssetStudioToolName,
  description: string,
  authority: AssetStudioToolAuthority,
  properties: Record<string, AssetStudioToolSchemaProperty>,
  required: string[],
): AssetStudioToolDefinition {
  return {
    authority,
    description,
    inputSchema: {
      additionalProperties: false,
      properties,
      required: [...required],
      type: "object",
    },
    name,
    title: name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (letter) => letter.toUpperCase()),
  };
}

function requireToolString(
  args: Record<string, AssetStudioToolArgumentValue>,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function createAssetStudioToolResult(
  structuredContent: AssetStudioJsonObject,
): AssetStudioToolResult {
  return {
    content: [
      {
        text: JSON.stringify(structuredContent, null, 2),
        type: "text",
      },
    ],
    isError: false,
    structuredContent,
  };
}

function createAssetStudioToolError(message: string): AssetStudioToolResult {
  return {
    content: [{ text: message, type: "text" }],
    isError: true,
    structuredContent: {
      error: message,
    },
  };
}

function toAssetStudioJsonValue(value: object): AssetStudioJsonValue {
  return JSON.parse(JSON.stringify(value));
}

function clampPivot(pivot: PivotPoint): PivotPoint {
  return {
    x: clampNumber(pivot.x, 0, 1),
    y: clampNumber(pivot.y, 0, 1),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Expected a finite number");
  }
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isInteger(value)) {
    throw new Error("Expected an integer");
  }
  return Math.min(max, Math.max(min, value));
}

function collectDuplicateAssetIssues(
  bundle: AssetBundle,
): AssetBundleValidationIssue[] {
  const ids = [
    ...bundle.sprites.map((sprite) => sprite.id),
    ...bundle.clips.map((clip) => clip.id),
    ...bundle.hitboxes.map((hitboxSet) => hitboxSet.id),
    ...bundle.tilemaps.map((tilemap) => tilemap.id),
    ...bundle.timelines.map((timeline) => timeline.id),
  ];
  const seen = new Set<string>();
  const reported = new Set<string>();
  const issues: AssetBundleValidationIssue[] = [];

  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      continue;
    }
    if (reported.has(id)) {
      continue;
    }
    reported.add(id);
    issues.push(
      createIssue("duplicateAssetId", `${id}: duplicate asset id`, id),
    );
  }

  return issues;
}

function collectClipIssues(
  clips: AnimationClip[],
  spriteById: ReadonlyMap<string, SpriteSheetAsset>,
): AssetBundleValidationIssue[] {
  return clips.flatMap((clip) => {
    const sprite = spriteById.get(clip.assetId);
    if (sprite === undefined) {
      return [
        createIssue(
          "unknownClipAsset",
          `${clip.id}: unknown clip asset ${clip.assetId}`,
          `${clip.id}.assetId`,
        ),
      ];
    }
    if (
      clip.fromFrame < 0 ||
      clip.toFrame < clip.fromFrame ||
      clip.toFrame >= sprite.frame.totalFrames
    ) {
      return [
        createIssue(
          "invalidAnimationFrameRange",
          `${clip.id}: invalid frame range`,
          `${clip.id}.frames`,
        ),
      ];
    }
    return [];
  });
}

function collectHitboxIssues(
  hitboxes: HitboxSet[],
  spriteById: ReadonlyMap<string, SpriteSheetAsset>,
): AssetBundleValidationIssue[] {
  return hitboxes.flatMap((hitboxSet) =>
    spriteById.has(hitboxSet.assetId)
      ? []
      : [
          createIssue(
            "unknownHitboxAsset",
            `${hitboxSet.id}: unknown hitbox asset ${hitboxSet.assetId}`,
            `${hitboxSet.id}.assetId`,
          ),
        ],
  );
}

function collectTilemapIssues(
  tilemaps: TilemapAsset[],
  spriteById: ReadonlyMap<string, SpriteSheetAsset>,
): AssetBundleValidationIssue[] {
  const issues: AssetBundleValidationIssue[] = [];
  for (const tilemap of tilemaps) {
    if (!spriteById.has(tilemap.tilesetAssetId)) {
      issues.push(
        createIssue(
          "unknownTilemapTileset",
          `${tilemap.id}: unknown tilemap tileset ${tilemap.tilesetAssetId}`,
          `${tilemap.id}.tilesetAssetId`,
        ),
      );
    }
    for (const layer of tilemap.layers) {
      if (
        layer.data.length !== tilemap.rows ||
        layer.data.some((row) => row.length !== tilemap.columns)
      ) {
        issues.push(
          createIssue(
            "invalidTilemapLayer",
            `${layer.id}: tilemap layer dimensions do not match tilemap`,
            `${tilemap.id}.${layer.id}.data`,
          ),
        );
      }
    }
  }
  return issues;
}

function collectTimelineIssues(
  timelines: SceneTimeline[],
  clipById: ReadonlyMap<string, AnimationClip>,
): AssetBundleValidationIssue[] {
  return timelines.flatMap((timeline) =>
    timeline.scenes.flatMap((scene) =>
      clipById.has(scene.clipId)
        ? []
        : [
            createIssue(
              "unknownTimelineClip",
              `${scene.id}: unknown timeline clip ${scene.clipId}`,
              `${timeline.id}.${scene.id}.clipId`,
            ),
          ],
    ),
  );
}

function collectSideScrollerBindingIssues(
  bundle: AssetBundle | SideScrollerAssetBundle,
  spriteById: ReadonlyMap<string, SpriteSheetAsset>,
  clipById: ReadonlyMap<string, AnimationClip>,
): AssetBundleValidationIssue[] {
  if (!isSideScrollerAssetBundle(bundle)) {
    return [];
  }

  const issues: AssetBundleValidationIssue[] = [];
  for (const binding of bundle.sideScroller.bindings) {
    if (!spriteById.has(binding.assetId)) {
      issues.push(
        createIssue(
          "unknownBindingAsset",
          `${binding.objectId}: unknown binding asset ${binding.assetId}`,
          `${binding.objectId}.assetId`,
        ),
      );
    }
    if (binding.clip !== undefined && !clipById.has(binding.clip)) {
      issues.push(
        createIssue(
          "unknownBindingClip",
          `${binding.objectId}: unknown binding clip ${binding.clip}`,
          `${binding.objectId}.clip`,
        ),
      );
    }
  }
  return issues;
}

function isSideScrollerAssetBundle(
  bundle: AssetBundle | SideScrollerAssetBundle,
): bundle is SideScrollerAssetBundle {
  return "sideScroller" in bundle;
}

function createIssue(
  code: AssetBundleValidationIssueCode,
  message: string,
  path: string,
): AssetBundleValidationIssue {
  return {
    code,
    message,
    path,
    severity: "error",
  };
}
