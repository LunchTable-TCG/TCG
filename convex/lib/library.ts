import {
  createCatalogEntriesForFormat,
  starterFormat,
  validateDeckForFormat,
} from "@lunchtable/card-content";
import type { FormatDefinition } from "@lunchtable/game-core";
import type {
  CardCatalogEntry,
  CollectionSummary,
  DeckCardEntry,
  DeckRecord,
  DeckValidationResult,
  FormatRuntimeSettings,
} from "@lunchtable/shared-types";

import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader, DatabaseWriter } from "../_generated/server";

export const DEFAULT_COLLECTION_CARD_COPIES = 4;
const SUPPORTED_FORMATS = [starterFormat] as const;

export interface FormatRuntime {
  format: FormatDefinition;
  settings: FormatRuntimeSettings;
}

export function getFormatDefinition(formatId: string): FormatDefinition {
  const format = SUPPORTED_FORMATS.find(
    (candidate) => candidate.formatId === formatId,
  );
  if (!format) {
    throw new Error(`Unsupported format: ${formatId}`);
  }

  return format;
}

export function listSupportedFormatIds(): string[] {
  return SUPPORTED_FORMATS.map((format) => format.formatId);
}

function normalizeBanList(
  format: FormatDefinition,
  banList: string[] | undefined,
): string[] {
  const knownCardIds = new Set(format.cardPool.map((card) => card.id));

  return [
    ...new Set((banList ?? []).filter((cardId) => knownCardIds.has(cardId))),
  ].sort((left, right) => left.localeCompare(right));
}

export function createFormatRuntime(
  formatId: string,
  override?: {
    banList?: string[];
    isPublished?: boolean;
    updatedAt?: number | null;
    updatedByUserId?: Id<"users"> | null;
  },
): FormatRuntime {
  const format = getFormatDefinition(formatId);
  const bannedCardIds = normalizeBanList(format, override?.banList);

  return {
    format: {
      ...format,
      banList: bannedCardIds,
    },
    settings: {
      bannedCardIds,
      formatId: format.formatId,
      isPublished: override?.isPublished ?? true,
      name: format.name,
      updatedAt: override?.updatedAt ?? null,
      updatedByUserId: override?.updatedByUserId ?? null,
    },
  };
}

export async function loadFormatRuntime(
  db: DatabaseReader | DatabaseWriter,
  formatId: string,
): Promise<FormatRuntime> {
  const settings = await db
    .query("formatSettings")
    .withIndex("by_formatId", (query) => query.eq("formatId", formatId))
    .unique();

  return createFormatRuntime(formatId, {
    banList: settings?.banList,
    isPublished: settings?.isPublished,
    updatedAt: settings?.updatedAt ?? null,
    updatedByUserId: settings?.updatedByUserId ?? null,
  });
}

export async function saveFormatRuntime(
  db: DatabaseWriter,
  input: {
    banList: string[];
    formatId: string;
    isPublished: boolean;
    now: number;
    updatedByUserId: Id<"users">;
  },
): Promise<FormatRuntime> {
  const runtime = createFormatRuntime(input.formatId, {
    banList: input.banList,
    isPublished: input.isPublished,
    updatedAt: input.now,
    updatedByUserId: input.updatedByUserId,
  });
  const existing = await db
    .query("formatSettings")
    .withIndex("by_formatId", (query) => query.eq("formatId", input.formatId))
    .unique();

  if (existing) {
    await db.patch(existing._id, {
      banList: runtime.settings.bannedCardIds,
      isPublished: runtime.settings.isPublished,
      updatedAt: input.now,
      updatedByUserId: input.updatedByUserId,
    });
  } else {
    await db.insert("formatSettings", {
      banList: runtime.settings.bannedCardIds,
      formatId: input.formatId,
      isPublished: runtime.settings.isPublished,
      updatedAt: input.now,
      updatedByUserId: input.updatedByUserId,
    });
  }

  return runtime;
}

export async function assertFormatPublishedForOperation(
  db: DatabaseReader | DatabaseWriter,
  formatId: string,
  actionLabel: string,
): Promise<FormatRuntime> {
  const runtime = await loadFormatRuntime(db, formatId);
  if (!runtime.settings.isPublished) {
    throw new Error(
      `${runtime.settings.name} is not currently published for ${actionLabel}`,
    );
  }

  return runtime;
}

export function listCatalogEntries(runtime: FormatRuntime): CardCatalogEntry[] {
  return createCatalogEntriesForFormat(runtime.format);
}

export async function listCollectionEntriesForUser(
  db: DatabaseReader | DatabaseWriter,
  userId: Id<"users">,
  formatId: string,
) {
  return db
    .query("collectionEntries")
    .withIndex("by_user_format", (query) =>
      query.eq("userId", userId).eq("formatId", formatId),
    )
    .collect();
}

function buildDefaultCollectionCounts(
  runtime: FormatRuntime,
): Record<string, number> {
  if (runtime.settings.formatId !== starterFormat.formatId) {
    return {};
  }

  return Object.fromEntries(
    listCatalogEntries(runtime).map((card) => [
      card.cardId,
      DEFAULT_COLLECTION_CARD_COPIES,
    ]),
  );
}

export function buildCollectionCountMap(
  runtime: FormatRuntime,
  entries: Array<Pick<Doc<"collectionEntries">, "cardId" | "ownedCount">>,
): Record<string, number> {
  const counts = buildDefaultCollectionCounts(runtime);

  for (const entry of entries) {
    counts[entry.cardId] = entry.ownedCount;
  }

  return counts;
}

export function buildCollectionSummary(
  runtime: FormatRuntime,
  entries: Doc<"collectionEntries">[],
): CollectionSummary {
  const catalog = listCatalogEntries(runtime);
  const ownedCounts = buildCollectionCountMap(runtime, entries);
  const summaryEntries = catalog.map((card) => ({
    card,
    ownedCount: ownedCounts[card.cardId] ?? 0,
  }));

  return {
    entries: summaryEntries,
    formatId: runtime.settings.formatId,
    totalOwnedCards: summaryEntries.reduce(
      (total, entry) => total + entry.ownedCount,
      0,
    ),
    totalUniqueCards: summaryEntries.filter((entry) => entry.ownedCount > 0)
      .length,
  };
}

export function validateDeckForUserCollection(input: {
  collectionEntries: Doc<"collectionEntries">[];
  mainboard: DeckCardEntry[];
  runtime: FormatRuntime;
  sideboard: DeckCardEntry[];
}): DeckValidationResult {
  return validateDeckForFormat({
    catalog: listCatalogEntries(input.runtime),
    collectionCounts: buildCollectionCountMap(
      input.runtime,
      input.collectionEntries,
    ),
    format: input.runtime.format,
    mainboard: input.mainboard,
    sideboard: input.sideboard,
  });
}

export function toDeckRecord(
  deck: Doc<"decks">,
  validation: DeckValidationResult,
): DeckRecord {
  return {
    formatId: deck.formatId,
    id: deck._id,
    mainboard: deck.mainboard,
    name: deck.name,
    sideboard: deck.sideboard,
    status: deck.status,
    updatedAt: deck.updatedAt,
    validation,
  };
}

export async function ensureStarterCollectionEntries(
  db: DatabaseWriter,
  userId: Id<"users">,
  now: number,
) {
  const runtime = await loadFormatRuntime(db, starterFormat.formatId);
  const existingEntries = await listCollectionEntriesForUser(
    db,
    userId,
    starterFormat.formatId,
  );
  const existingCardIds = new Set(existingEntries.map((entry) => entry.cardId));

  for (const card of listCatalogEntries(runtime)) {
    if (existingCardIds.has(card.cardId)) {
      continue;
    }

    await db.insert("collectionEntries", {
      cardId: card.cardId,
      formatId: starterFormat.formatId,
      ownedCount: DEFAULT_COLLECTION_CARD_COPIES,
      source: "starterGrant",
      updatedAt: now,
      userId,
    });
  }
}
