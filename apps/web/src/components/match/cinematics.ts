import type { CardCatalogEntry } from "@lunchtable/shared-types";

import type { MatchCinematicCue } from "./model";

export const DEFAULT_MATCH_CINEMATIC_ASSET_BASE_URL = "/cinematics";

export interface MatchCinematicSceneModel {
  accentColor: string;
  auraColor: string;
  bobAmplitude: number;
  glyphScale: [number, number, number];
  groundColor: string;
  idleSpin: number;
  rimColor: string;
  ringColor: string;
  shardCount: number;
  shardSpeed: number;
}

export interface MatchCinematicAssetBundle {
  mode: "cdn";
  modelOffsetY: number;
  modelRotationY: number;
  modelScale: number;
  modelUrl: string | null;
  posterUrl: string | null;
}

interface MatchCinematicAssetManifestEntry {
  modelOffsetY?: number;
  modelRotationY?: number;
  modelScale?: number;
  modelPath?: string;
  posterPath?: string;
}

interface CinematicPalette {
  accentColor: string;
  auraColor: string;
  groundColor: string;
  rimColor: string;
  ringColor: string;
}

function getBasePalette(kind: MatchCinematicCue["kind"]): CinematicPalette {
  if (kind === "ability") {
    return {
      accentColor: "#7be1ff",
      auraColor: "#eff8ff",
      groundColor: "#14344d",
      rimColor: "#ffd78a",
      ringColor: "#4ec8ff",
    };
  }

  return {
    accentColor: "#ffcd73",
    auraColor: "#fff2d1",
    groundColor: "#4a250f",
    rimColor: "#8ad7ff",
    ringColor: "#ffb347",
  };
}

function getFamilyPalette(card: CardCatalogEntry | null): Partial<CinematicPalette> {
  const source = `${card?.cardId ?? ""} ${card?.name ?? ""}`.toLowerCase();

  if (
    source.includes("ember") ||
    source.includes("lantern") ||
    source.includes("spark")
  ) {
    return {
      accentColor: "#ffb15a",
      auraColor: "#fff0cf",
      groundColor: "#52230e",
      rimColor: "#ffe08f",
      ringColor: "#ff7a45",
    };
  }

  if (
    source.includes("tide") ||
    source.includes("mirror") ||
    source.includes("sky")
  ) {
    return {
      accentColor: "#75d7ff",
      auraColor: "#e9fbff",
      groundColor: "#133a58",
      rimColor: "#b9f0ff",
      ringColor: "#56b9ff",
    };
  }

  if (
    source.includes("archive") ||
    source.includes("marshal") ||
    source.includes("banner") ||
    source.includes("bastion")
  ) {
    return {
      accentColor: "#f4d57d",
      auraColor: "#fff6da",
      groundColor: "#46311a",
      rimColor: "#ffeab1",
      ringColor: "#c7a04a",
    };
  }

  return {};
}

const CARD_CINEMATIC_ASSET_MANIFEST: Record<
  string,
  MatchCinematicAssetManifestEntry
> = {
  "archive-apprentice": {
    modelOffsetY: -0.96,
    modelPath: "cards/archive-apprentice/summon.glb",
    modelRotationY: Math.PI,
    modelScale: 0.94,
    posterPath: "cards/archive-apprentice/poster.gif",
  },
  "ember-summoner": {
    modelOffsetY: -1.18,
    modelPath: "cards/ember-summoner/summon.glb",
    modelRotationY: Math.PI * 0.96,
    modelScale: 1.26,
  },
  "mirror-warden": {
    modelOffsetY: -1.08,
    modelPath: "cards/mirror-warden/summon.glb",
    modelRotationY: Math.PI,
    modelScale: 1.04,
    posterPath: "cards/mirror-warden/poster.gif",
  },
  "sky-patrol-scout": {
    modelOffsetY: -1.08,
    modelPath: "cards/sky-patrol-scout/summon.glb",
    modelRotationY: Math.PI * 0.88,
    modelScale: 1.22,
    posterPath: "cards/sky-patrol-scout/poster.jpg",
  },
};

function normalizeAssetBaseUrl(assetBaseUrl: string | null | undefined) {
  const normalized = assetBaseUrl?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\/+$/, "");
}

function joinAssetUrl(baseUrl: string, relativePath: string) {
  return `${baseUrl}/${relativePath.replace(/^\/+/, "")}`;
}

export function buildMatchCinematicAssetBundle(input: {
  card: CardCatalogEntry | null;
  assetBaseUrl?: string | null;
  cue: MatchCinematicCue;
}): MatchCinematicAssetBundle | null {
  const baseUrl = normalizeAssetBaseUrl(input.assetBaseUrl);
  const cardId = input.cue.cardId ?? input.card?.cardId ?? null;
  if (!baseUrl || !cardId) {
    return null;
  }

  const manifestEntry = CARD_CINEMATIC_ASSET_MANIFEST[cardId];
  if (!manifestEntry) {
    return null;
  }

  return {
    mode: "cdn",
    modelOffsetY: manifestEntry.modelOffsetY ?? -0.96,
    modelRotationY: manifestEntry.modelRotationY ?? Math.PI,
    modelScale: manifestEntry.modelScale ?? 1,
    modelUrl: manifestEntry.modelPath
      ? joinAssetUrl(baseUrl, manifestEntry.modelPath)
      : null,
    posterUrl: manifestEntry.posterPath
      ? joinAssetUrl(baseUrl, manifestEntry.posterPath)
      : null,
  };
}

export function buildMatchCinematicSceneModel(input: {
  card: CardCatalogEntry | null;
  cue: MatchCinematicCue;
}): MatchCinematicSceneModel {
  const { card, cue } = input;
  const basePalette = getBasePalette(cue.kind);
  const palette = {
    ...basePalette,
    ...getFamilyPalette(card),
  };

  const rarityBonus =
    card?.rarity === "mythic"
      ? 3
      : card?.rarity === "rare"
        ? 2
        : card?.rarity === "uncommon"
          ? 1
          : 0;
  const costBonus = Math.min(card?.cost ?? 0, 5);
  const hasFlying = card?.keywords.includes("flying") ?? false;
  const hasHaste = card?.keywords.includes("haste") ?? false;
  const hasWard =
    card?.keywords.some((keyword) => keyword.startsWith("ward")) ?? false;

  let glyphScale: [number, number, number] =
    cue.kind === "ability" ? [0.92, 0.92, 0.92] : [1, 1.06, 1];

  if (card?.kind === "spell") {
    glyphScale = [0.88, 1.18, 0.88];
  } else if (card?.kind === "relic") {
    glyphScale = [1.08, 0.9, 1.08];
  } else if ((card?.stats?.power ?? 0) >= 3 || (card?.stats?.toughness ?? 0) >= 4) {
    glyphScale = [1.06, 1.16, 1.06];
  }

  if (hasFlying) {
    glyphScale = [glyphScale[0], glyphScale[1] + 0.08, glyphScale[2]];
  }

  return {
    accentColor:
      hasHaste && cue.kind === "summon" ? "#ff9863" : palette.accentColor,
    auraColor: hasWard ? "#f0fbff" : palette.auraColor,
    bobAmplitude:
      (cue.kind === "ability" ? 0.1 : 0.14) +
      (hasFlying ? 0.04 : 0) +
      rarityBonus * 0.008,
    glyphScale,
    groundColor: palette.groundColor,
    idleSpin:
      (cue.kind === "ability" ? 0.9 : 0.58) +
      (card?.kind === "spell" ? 0.22 : 0) +
      (hasFlying ? 0.18 : 0) +
      rarityBonus * 0.04,
    rimColor: hasWard ? "#9ae8ff" : palette.rimColor,
    ringColor: palette.ringColor,
    shardCount:
      (cue.kind === "ability" ? 4 : 5) +
      rarityBonus +
      (hasFlying ? 1 : 0) +
      (costBonus >= 4 ? 1 : 0),
    shardSpeed:
      (cue.kind === "ability" ? 1.45 : 1.05) +
      (hasHaste ? 0.2 : 0) +
      (card?.kind === "spell" ? 0.16 : 0),
  };
}
