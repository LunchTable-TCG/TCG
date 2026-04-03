import type {
  CardCatalogEntry,
  DeckCardEntry,
  DeckValidationResult,
} from "@lunchtable/shared-types";

import type { CardDefinition, FormatDefinition } from "@lunchtable/game-core";

function summarizeAbility(ability: CardDefinition["abilities"][number]) {
  return {
    id: ability.id,
    kind: ability.kind,
    requiresTargets:
      ability.kind === "activated" && Array.isArray(ability.targets)
        ? ability.targets.length > 0
        : false,
    resourceCost:
      ability.kind === "activated"
        ? ability.costs.reduce((total, cost) => {
            if (cost.kind !== "resource") {
              return total;
            }
            return total + cost.amount;
          }, 0)
        : null,
    speed: ability.kind === "activated" ? ability.speed : null,
    text: ability.text,
  };
}

export function createCatalogEntriesForFormat(
  format: FormatDefinition,
): CardCatalogEntry[] {
  return format.cardPool.map((card) => ({
    abilities: card.abilities.map(summarizeAbility),
    cardId: card.id,
    cost: card.cost,
    formatId: format.formatId,
    isBanned: format.banList.includes(card.id),
    keywords: [...card.keywords],
    kind: card.kind,
    name: card.name,
    rarity: card.rarity,
    rulesText: [...card.rulesText],
    setId: card.setId,
    stats: card.stats ? { ...card.stats } : undefined,
  }));
}

function sumDeckCounts(entries: DeckCardEntry[]): number {
  return entries.reduce((total, entry) => total + entry.count, 0);
}

function pushOwnershipIssue(
  issues: DeckValidationResult["issues"],
  cardName: string,
  requiredCount: number,
  ownedCount: number,
) {
  issues.push({
    code: "insufficientOwnedCards",
    message: `${cardName}: requires ${requiredCount} copies but only ${ownedCount} are owned.`,
    severity: "error",
  });
}

export function validateDeckForFormat(input: {
  catalog: CardCatalogEntry[];
  collectionCounts?: Record<string, number>;
  format: FormatDefinition;
  mainboard: DeckCardEntry[];
  sideboard: DeckCardEntry[];
}): DeckValidationResult {
  const issues: DeckValidationResult["issues"] = [];
  const catalogById = new Map(input.catalog.map((card) => [card.cardId, card]));
  const allEntries = [...input.mainboard, ...input.sideboard];
  const requiredCounts = new Map<string, number>();

  for (const entry of allEntries) {
    if (!Number.isInteger(entry.count) || entry.count < 0) {
      issues.push({
        code: "invalidCount",
        message: `${entry.cardId}: deck counts must be non-negative integers.`,
        severity: "error",
      });
      continue;
    }
    if (entry.count === 0) {
      continue;
    }

    const nextRequiredCount =
      (requiredCounts.get(entry.cardId) ?? 0) + entry.count;
    requiredCounts.set(entry.cardId, nextRequiredCount);

    const card = catalogById.get(entry.cardId);
    if (!card) {
      issues.push({
        code: "unknownCard",
        message: `${entry.cardId}: card is not present in the selected format.`,
        severity: "error",
      });
      continue;
    }

    if (card.isBanned) {
      issues.push({
        code: "bannedCard",
        message: `${card.name}: is banned in ${input.format.name}.`,
        severity: "error",
      });
    }

    if (nextRequiredCount > input.format.deckRules.maxCopies) {
      issues.push({
        code: "tooManyCopies",
        message: `${card.name}: exceeds the ${input.format.deckRules.maxCopies}-copy limit.`,
        severity: "error",
      });
    }
  }

  const mainboardCount = sumDeckCounts(input.mainboard);
  const sideboardCount = sumDeckCounts(input.sideboard);

  if (mainboardCount < input.format.deckRules.minCards) {
    issues.push({
      code: "tooFewCards",
      message: `Mainboard needs at least ${input.format.deckRules.minCards} cards.`,
      severity: "error",
    });
  }

  if (sideboardCount > input.format.deckRules.sideboardSize) {
    issues.push({
      code: "sideboardTooLarge",
      message: `Sideboard exceeds the ${input.format.deckRules.sideboardSize}-card limit.`,
      severity: "error",
    });
  }

  if (input.collectionCounts) {
    for (const [cardId, requiredCount] of requiredCounts) {
      const ownedCount = input.collectionCounts[cardId] ?? 0;
      if (requiredCount > ownedCount) {
        const cardName = catalogById.get(cardId)?.name ?? cardId;
        pushOwnershipIssue(issues, cardName, requiredCount, ownedCount);
      }
    }
  }

  return {
    formatId: input.format.formatId,
    isLegal: issues.every((issue) => issue.severity !== "error"),
    issues,
    mainboardCount,
    sideboardCount,
  };
}
