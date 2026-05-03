import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireViewerUser } from "./lib/viewer";

type AssetCtx = MutationCtx | QueryCtx;
type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

interface ElizaImageGenerationRequest {
  body: {
    aspectRatio: "1:1";
    model: string;
    numImages: number;
    prompt: string;
    stylePreset: "digital-art";
  };
  headers: Record<string, string>;
  method: "POST";
  url: string;
}

interface ElizaGeneratedImage {
  base64: string | null;
  url: string | null;
}

export interface GameAssetRecord {
  createdAt: number;
  id: Id<"gameAssets">;
  mediaType: string;
  metadata: GameAssetMetadata;
  name: string;
  ownerUserId: Id<"users">;
  prompt: string | null;
  source: "generated" | "imported";
  status: "active" | "archived";
  storageId: Id<"_storage">;
  updatedAt: number;
}

export interface GameAssetMetadata {
  generator: "elizaOS Cloud";
  kind: "side-scroller-sprite";
  originalUrl: string | null;
  prompt: string;
}

export const getViewerUserIdInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"users">> => {
    const user = await requireViewerUser(ctx);
    return user._id;
  },
});

export const createGeneratedAssetInternal = internalMutation({
  args: {
    mediaType: v.string(),
    metadataJson: v.string(),
    name: v.string(),
    ownerUserId: v.id("users"),
    prompt: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<GameAssetRecord> => {
    const now = Date.now();
    const assetId = await ctx.db.insert("gameAssets", {
      createdAt: now,
      mediaType: args.mediaType,
      metadataJson: args.metadataJson,
      name: args.name,
      ownerUserId: args.ownerUserId,
      prompt: args.prompt,
      source: "generated",
      status: "active",
      storageId: args.storageId,
      updatedAt: now,
    });
    const asset = await ctx.db.get(assetId);
    if (!asset) {
      throw new Error("Generated asset was not persisted");
    }
    return toGameAssetRecord(asset);
  },
});

export const generateSideScrollerAsset = action({
  args: {
    name: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<GameAssetRecord> => {
    const apiKey = process.env.ELIZA_CLOUD_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing required environment variable: ELIZA_CLOUD_API_KEY",
      );
    }

    const ownerUserId = await ctx.runQuery(
      internal.assets.getViewerUserIdInternal,
      {},
    );
    const request = createElizaImageGenerationRequest({
      apiKey,
      model: "google/gemini-2.5-flash-image",
      prompt: `Create a clean transparent pixel art side-scroller sprite sheet. ${args.prompt}`,
    });
    const response = await fetch(request.url, {
      body: JSON.stringify(request.body),
      headers: request.headers,
      method: request.method,
    });
    if (!response.ok) {
      throw new Error(
        `elizaOS Cloud image generation failed: ${response.status}`,
      );
    }

    const responseBody: JsonValue = await response.json();
    const generation = parseElizaImageGenerationResponse(responseBody);
    const image = generation.images[0];
    if (image === undefined) {
      throw new Error("elizaOS Cloud image generation returned no image");
    }
    const blob =
      image.base64 === null
        ? await fetchGeneratedImageBlob(image.url)
        : new Blob([base64ToArrayBuffer(image.base64)], {
            type: "image/png",
          });
    const storageId = await ctx.storage.store(blob);
    const metadata: GameAssetMetadata = {
      generator: "elizaOS Cloud",
      kind: "side-scroller-sprite",
      originalUrl: image.url,
      prompt: args.prompt,
    };

    return ctx.runMutation(internal.assets.createGeneratedAssetInternal, {
      mediaType: blob.type || "image/png",
      metadataJson: JSON.stringify(metadata),
      name: args.name,
      ownerUserId,
      prompt: args.prompt,
      storageId,
    });
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx): Promise<GameAssetRecord[]> => {
    const user = await requireViewerUser(ctx);
    const assets = await ctx.db
      .query("gameAssets")
      .withIndex("by_ownerUserId_and_updatedAt", (index) =>
        index.eq("ownerUserId", user._id),
      )
      .order("desc")
      .collect();

    return assets.map(toGameAssetRecord);
  },
});

export const getUrl = query({
  args: {
    assetId: v.id("gameAssets"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ asset: GameAssetRecord; url: string }> => {
    const user = await requireViewerUser(ctx);
    const asset = await requireOwnedAsset(ctx, args.assetId, user._id);
    const url = await ctx.storage.getUrl(asset.storageId);
    if (url === null) {
      throw new Error("Asset file is unavailable");
    }

    return {
      asset: toGameAssetRecord(asset),
      url,
    };
  },
});

export const archive = mutation({
  args: {
    assetId: v.id("gameAssets"),
  },
  handler: async (ctx, args): Promise<GameAssetRecord> => {
    const user = await requireViewerUser(ctx);
    const asset = await requireOwnedAsset(ctx, args.assetId, user._id);
    await ctx.db.patch(asset._id, {
      status: "archived",
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get(asset._id);
    if (!updated) {
      throw new Error("Asset disappeared while archiving");
    }
    return toGameAssetRecord(updated);
  },
});

async function requireOwnedAsset(
  ctx: AssetCtx,
  assetId: Id<"gameAssets">,
  ownerUserId: Id<"users">,
): Promise<Doc<"gameAssets">> {
  const asset = await ctx.db.get(assetId);
  if (!asset || asset.ownerUserId !== ownerUserId) {
    throw new Error("Asset not found for the current user");
  }
  return asset;
}

async function fetchGeneratedImageBlob(url: string | null): Promise<Blob> {
  if (url === null) {
    throw new Error(
      "elizaOS Cloud image generation did not include image data",
    );
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Generated image download failed: ${response.status}`);
  }
  return response.blob();
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return buffer;
}

function toGameAssetRecord(asset: Doc<"gameAssets">): GameAssetRecord {
  return {
    createdAt: asset.createdAt,
    id: asset._id,
    mediaType: asset.mediaType,
    metadata: parseMetadata(asset.metadataJson),
    name: asset.name,
    ownerUserId: asset.ownerUserId,
    prompt: asset.prompt ?? null,
    source: asset.source,
    status: asset.status,
    storageId: asset.storageId,
    updatedAt: asset.updatedAt,
  };
}

function parseMetadata(metadataJson: string): GameAssetMetadata {
  const parsed: JsonValue = JSON.parse(metadataJson);
  if (!isGameAssetMetadata(parsed)) {
    throw new Error("Stored game asset metadata is invalid");
  }

  return {
    generator: parsed.generator,
    kind: parsed.kind,
    originalUrl: parsed.originalUrl,
    prompt: parsed.prompt,
  };
}

function createElizaImageGenerationRequest(input: {
  apiKey: string;
  model: string;
  prompt: string;
}): ElizaImageGenerationRequest {
  return {
    body: {
      aspectRatio: "1:1",
      model: input.model,
      numImages: 1,
      prompt: input.prompt,
      stylePreset: "digital-art",
    },
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    url: "https://elizacloud.ai/api/v1/generate-image",
  };
}

function parseElizaImageGenerationResponse(input: JsonValue): {
  images: ElizaGeneratedImage[];
} {
  if (!isJsonObject(input) || !Array.isArray(input.images)) {
    throw new Error(
      "elizaOS Cloud image generation response contained no images",
    );
  }

  const images = input.images.map(parseElizaGeneratedImage).filter(isDefined);
  if (images.length === 0) {
    throw new Error(
      "elizaOS Cloud image generation response contained no images",
    );
  }

  return { images };
}

function parseElizaGeneratedImage(
  value: JsonValue,
): ElizaGeneratedImage | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const base64 = typeof value.image === "string" ? value.image : null;
  const url = typeof value.url === "string" ? value.url : null;
  if (base64 === null && url === null) {
    return null;
  }

  return { base64, url };
}

function isGameAssetMetadata(
  value: JsonValue,
): value is JsonObject & GameAssetMetadata {
  return (
    isJsonObject(value) &&
    value.generator === "elizaOS Cloud" &&
    value.kind === "side-scroller-sprite" &&
    (typeof value.originalUrl === "string" || value.originalUrl === null) &&
    typeof value.prompt === "string"
  );
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<TValue>(value: TValue | null): value is TValue {
  return value !== null;
}
