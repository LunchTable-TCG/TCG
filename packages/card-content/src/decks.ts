import type {
  CardCatalogEntry,
  CardReasoningMetadataV1,
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
    targets:
      ability.kind === "activated"
        ? (ability.targets ?? []).map((target) => ({
            maxSelections: target.count.max,
            minSelections: target.count.min,
            selector: target.selector,
          }))
        : undefined,
  };
}

function appendUnique(values: string[], value: string) {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function collectEffectKinds(ability: CardDefinition["abilities"][number]) {
  if (ability.kind === "static") {
    return [ability.effect.kind];
  }

  if (ability.kind === "replacement") {
    return [ability.replace.kind];
  }

  return ability.effect.map((effect) => effect.kind);
}

function collectTargetClasses(ability: CardDefinition["abilities"][number]) {
  const targetClasses: string[] = [];

  if (ability.kind === "activated") {
    for (const target of ability.targets ?? []) {
      appendUnique(targetClasses, target.selector);
    }
  }

  if (ability.kind === "activated" || ability.kind === "triggered") {
    for (const effect of ability.effect) {
      if ("target" in effect && effect.target === "target") {
        appendUnique(targetClasses, "target");
      }
      if ("target" in effect && effect.target === "opponent") {
        appendUnique(targetClasses, "opponent");
      }
    }
  }

  return targetClasses;
}

function collectPromptSurfaces(ability: CardDefinition["abilities"][number]) {
  const promptSurfaces: string[] = [];

  if (ability.kind === "activated") {
    if ((ability.targets?.length ?? 0) > 0) {
      appendUnique(promptSurfaces, "targets");
    }
    if (ability.costs.some((cost) => cost.kind !== "resource")) {
      appendUnique(promptSurfaces, "costs");
    }
  }

  if (ability.kind === "activated" || ability.kind === "triggered") {
    for (const effect of ability.effect) {
      if (effect.kind === "randomSelection") {
        appendUnique(promptSurfaces, "choice");
      }
    }
  }

  return promptSurfaces;
}

function collectTimingAffordances(ability: CardDefinition["abilities"][number]) {
  const timingAffordances: string[] = [];

  if (ability.kind === "activated") {
    appendUnique(
      timingAffordances,
      ability.speed === "fast" ? "fastActivation" : "slowActivation",
    );
  }

  if (ability.kind === "triggered") {
    appendUnique(
      timingAffordances,
      ability.trigger.kind === "event"
        ? `trigger:${ability.trigger.event}`
        : "triggered",
    );
  }

  if (ability.kind === "static") {
    appendUnique(timingAffordances, `static:${ability.layer}`);
  }

  if (ability.kind === "replacement") {
    appendUnique(
      timingAffordances,
      ability.watches.kind === "event"
        ? `replacement:${ability.watches.event}`
        : "replacement",
    );
  }

  return timingAffordances;
}

function buildCardReasoningMetadata(
  card: CardDefinition,
): CardReasoningMetadataV1 {
  const effectKinds: string[] = [];
  const promptSurfaces: string[] = [];
  const targetClasses: string[] = [];
  const timingAffordances = ["mainPhaseCast"];

  for (const ability of card.abilities) {
    for (const effectKind of collectEffectKinds(ability)) {
      appendUnique(effectKinds, effectKind);
    }
    for (const promptSurface of collectPromptSurfaces(ability)) {
      appendUnique(promptSurfaces, promptSurface);
    }
    for (const targetClass of collectTargetClasses(ability)) {
      appendUnique(targetClasses, targetClass);
    }
    for (const affordance of collectTimingAffordances(ability)) {
      appendUnique(timingAffordances, affordance);
    }
  }

  return {
    effectKinds,
    promptSurfaces,
    rulesSummary: card.rulesText.slice(0, 3),
    stats: card.stats ? { ...card.stats } : null,
    targetClasses,
    timingAffordances,
  };
}

export function validateCardReasoningMetadata(
  catalog: CardCatalogEntry[],
): string[] {
  return catalog.flatMap((card) => {
    const issues: string[] = [];

    if (card.reasoning.timingAffordances.length === 0) {
      issues.push(`${card.cardId}: missing timing affordances`);
    }
    if (!Array.isArray(card.reasoning.rulesSummary)) {
      issues.push(`${card.cardId}: rules summary must be an array`);
    }
    if (!Array.isArray(card.reasoning.effectKinds)) {
      issues.push(`${card.cardId}: effect kinds must be an array`);
    }

    return issues;
  });
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
    reasoning: buildCardReasoningMetadata(card),
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
