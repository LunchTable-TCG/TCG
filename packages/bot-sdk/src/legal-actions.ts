import type {
  CardCatalogEntry,
  MatchCardView,
  MatchPromptView,
  MatchSeatView,
} from "@lunchtable/shared-types";

import type { BotDecisionFrame, BotLegalAction } from "./types";

function createIntentId(frame: BotDecisionFrame, suffix: string) {
  return `bot:${frame.seat}:${frame.view.match.version}:${suffix}`;
}

function getCurrentResourceTotal(view: MatchSeatView): number {
  const seat = view.seats.find(
    (candidate) => candidate.seat === view.viewerSeat,
  );
  if (!seat) {
    return 0;
  }

  return seat.resources.reduce(
    (total, resource) => total + resource.current,
    0,
  );
}

function getHandCards(view: MatchSeatView): MatchCardView[] {
  return (
    view.zones.find(
      (zone) => zone.ownerSeat === view.viewerSeat && zone.zone === "hand",
    )?.cards ?? []
  );
}

function getBattlefieldCards(view: MatchSeatView): MatchCardView[] {
  return (
    view.zones.find(
      (zone) =>
        zone.ownerSeat === view.viewerSeat && zone.zone === "battlefield",
    )?.cards ?? []
  );
}

function getCatalogEntry(
  catalog: CardCatalogEntry[],
  cardId: string,
): CardCatalogEntry | null {
  return catalog.find((entry) => entry.cardId === cardId) ?? null;
}

function scoreCardForPlay(entry: CardCatalogEntry | null): number {
  if (!entry) {
    return -1;
  }

  let score = 0;
  if (
    entry.abilities.some(
      (ability) =>
        ability.kind === "triggered" &&
        /deal \d+ damage to the opposing seat/i.test(ability.text),
    )
  ) {
    score += 100;
  }
  if (
    entry.abilities.some(
      (ability) =>
        ability.kind === "triggered" && /draw \d+ cards?/i.test(ability.text),
    )
  ) {
    score += 60;
  }
  if (entry.keywords.includes("haste")) {
    score += 25;
  }
  score += entry.cost * 2;
  score += entry.stats?.power ?? 0;
  score += entry.stats?.toughness ?? 0;
  return score;
}

function listPlayableCardActions(frame: BotDecisionFrame): BotLegalAction[] {
  if (!frame.view.availableIntents.includes("playCard")) {
    return [];
  }

  const currentResourceTotal = getCurrentResourceTotal(frame.view);
  return getHandCards(frame.view)
    .reduce<BotLegalAction[]>((actions, card) => {
      const entry = getCatalogEntry(frame.catalog, card.cardId);
      if (!entry || entry.cost > currentResourceTotal) {
        return actions;
      }

      const intent: BotLegalAction["intent"] = {
        intentId: createIntentId(frame, `play:${card.instanceId}`),
        kind: "playCard",
        matchId: frame.matchId,
        payload: {
          alternativeCostId: null,
          cardInstanceId: card.instanceId,
          sourceZone: "hand",
          targetSlotId: null,
        },
        seat: frame.seat,
        stateVersion: frame.view.match.version,
      };

      actions.push({
        intent,
        kind: "playCard",
        label: `Play ${entry.name}`,
        priority: scoreCardForPlay(entry),
      });
      return actions;
    }, [])
    .sort((left, right) => {
      if (left.priority === right.priority) {
        return left.label.localeCompare(right.label);
      }
      return right.priority - left.priority;
    });
}

function listActivatedAbilityActions(
  frame: BotDecisionFrame,
): BotLegalAction[] {
  if (!frame.view.availableIntents.includes("activateAbility")) {
    return [];
  }

  const currentResourceTotal = getCurrentResourceTotal(frame.view);
  return getBattlefieldCards(frame.view)
    .flatMap((card) => {
      const entry = getCatalogEntry(frame.catalog, card.cardId);
      if (!entry) {
        return [];
      }

      return entry.abilities
        .filter(
          (ability) =>
            ability.kind === "activated" &&
            !ability.requiresTargets &&
            (ability.resourceCost ?? 0) <= currentResourceTotal,
        )
        .map((ability) => {
          const intent: BotLegalAction["intent"] = {
            intentId: createIntentId(
              frame,
              `ability:${card.instanceId}:${ability.id}`,
            ),
            kind: "activateAbility",
            matchId: frame.matchId,
            payload: {
              abilityId: ability.id,
              sourceInstanceId: card.instanceId,
            },
            seat: frame.seat,
            stateVersion: frame.view.match.version,
          };

          return {
            intent,
            kind: "activateAbility" as const,
            label: ability.text,
            priority: 40 + (ability.resourceCost ?? 0),
          };
        });
    })
    .sort((left, right) => right.priority - left.priority);
}

function buildPromptIntent(
  frame: BotDecisionFrame,
  prompt: MatchPromptView,
): BotLegalAction | null {
  const firstEnabledChoice = prompt.choices.find((choice) => !choice.disabled);
  if (!firstEnabledChoice) {
    return null;
  }

  if (
    prompt.kind === "mulligan" &&
    frame.view.availableIntents.includes("keepOpeningHand")
  ) {
    return {
      intent: {
        intentId: createIntentId(frame, `keep:${prompt.promptId}`),
        kind: "keepOpeningHand",
        matchId: frame.matchId,
        payload: {},
        seat: frame.seat,
        stateVersion: frame.view.match.version,
      },
      kind: "keepOpeningHand",
      label: "Keep opening hand",
      priority: 1000,
    };
  }

  return null;
}

export function listLegalBotActions(frame: BotDecisionFrame): BotLegalAction[] {
  const actions: BotLegalAction[] = [];

  if (frame.view.prompt) {
    const promptAction = buildPromptIntent(frame, frame.view.prompt);
    if (promptAction) {
      actions.push(promptAction);
    }
  }

  actions.push(...listPlayableCardActions(frame));
  actions.push(...listActivatedAbilityActions(frame));

  if (frame.view.availableIntents.includes("passPriority")) {
    actions.push({
      intent: {
        intentId: createIntentId(frame, "pass"),
        kind: "passPriority",
        matchId: frame.matchId,
        payload: {},
        seat: frame.seat,
        stateVersion: frame.view.match.version,
      },
      kind: "passPriority",
      label: "Pass priority",
      priority: 1,
    });
  }

  return actions.sort((left, right) => {
    if (left.priority === right.priority) {
      return left.label.localeCompare(right.label);
    }
    return right.priority - left.priority;
  });
}
