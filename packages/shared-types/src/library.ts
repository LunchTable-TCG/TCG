import type { GenericId } from "convex/values";

import type { UserId } from "./auth";

export type DeckId = GenericId<"decks">;

export const DECK_STATUSES = ["active", "archived"] as const;
export type DeckStatus = (typeof DECK_STATUSES)[number];

export const CARD_LIBRARY_KINDS = ["unit", "spell", "relic"] as const;
export type CardLibraryKind = (typeof CARD_LIBRARY_KINDS)[number];

export const CARD_LIBRARY_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "mythic",
] as const;
export type CardLibraryRarity = (typeof CARD_LIBRARY_RARITIES)[number];

export interface CardReasoningMetadataV1 {
  effectKinds: string[];
  promptSurfaces: string[];
  rulesSummary: string[];
  stats: {
    power: number;
    toughness: number;
  } | null;
  targetClasses: string[];
  timingAffordances: string[];
}

export interface CardCatalogEntry {
  abilities: Array<{
    id: string;
    kind: "activated" | "replacement" | "static" | "triggered";
    requiresTargets: boolean;
    resourceCost: number | null;
    speed: "fast" | "slow" | null;
    text: string;
    targets?: Array<{
      maxSelections: number;
      minSelections: number;
      selector:
        | "anyCard"
        | "friendlyUnit"
        | "opposingUnit"
        | "player"
        | "self"
        | "stackObject";
    }>;
  }>;
  cardId: string;
  cost: number;
  formatId: string;
  isBanned: boolean;
  keywords: string[];
  kind: CardLibraryKind;
  name: string;
  rarity: CardLibraryRarity;
  reasoning: CardReasoningMetadataV1;
  rulesText: string[];
  setId: string;
  stats?: {
    power: number;
    toughness: number;
  };
}

export interface DeckCardEntry {
  cardId: string;
  count: number;
}

export interface DeckValidationIssue {
  code:
    | "bannedCard"
    | "insufficientOwnedCards"
    | "invalidCount"
    | "sideboardTooLarge"
    | "tooFewCards"
    | "tooManyCopies"
    | "unknownCard";
  message: string;
  severity: "error" | "warning";
}

export interface DeckValidationResult {
  formatId: string;
  isLegal: boolean;
  issues: DeckValidationIssue[];
  mainboardCount: number;
  sideboardCount: number;
}

export interface DeckRecord {
  formatId: string;
  id: DeckId;
  mainboard: DeckCardEntry[];
  name: string;
  sideboard: DeckCardEntry[];
  status: DeckStatus;
  updatedAt: number;
  validation: DeckValidationResult;
}

export interface CollectionCardEntry {
  card: CardCatalogEntry;
  ownedCount: number;
}

export interface CollectionSummary {
  entries: CollectionCardEntry[];
  formatId: string;
  totalOwnedCards: number;
  totalUniqueCards: number;
}

export interface FormatRuntimeSettings {
  bannedCardIds: string[];
  formatId: string;
  isPublished: boolean;
  name: string;
  updatedAt: number | null;
  updatedByUserId: UserId | null;
}
