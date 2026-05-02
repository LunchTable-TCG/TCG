import type {
  AgentMatchContextV1,
  AgentVisibleCardV1,
  CardCatalogEntry,
  LegalActionDescriptorV1,
  MatchCardView,
  MatchPromptChoiceView,
  MatchSeatView,
  MatchView,
} from "@lunchtable/shared-types";
import {
  AGENT_MATCH_CONTEXT_VERSION,
  assertMatchSeatId,
} from "@lunchtable/shared-types";

import type {
  BotDecisionFrame,
  BotLegalAction,
  BotSupportedIntent,
} from "./types";

function nowMs() {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }

  return Date.now();
}

function createActionId(frame: BotDecisionFrame, suffix: string) {
  return `bot:${frame.seat}:${frame.view.match.version}:${suffix}`;
}

function getCurrentSeat(view: MatchSeatView) {
  return (
    view.seats.find((candidate) => candidate.seat === view.viewerSeat) ?? null
  );
}

function getCurrentResourceTotal(view: MatchSeatView): number {
  const seat = getCurrentSeat(view);
  if (!seat) {
    return 0;
  }

  return seat.resources.reduce(
    (total, resource) => total + resource.current,
    0,
  );
}

function getZoneCards(view: MatchSeatView, zone: MatchCardView["zone"]) {
  return (
    view.zones.find(
      (candidate) =>
        candidate.ownerSeat === view.viewerSeat && candidate.zone === zone,
    )?.cards ?? []
  );
}

function getBattlefieldCards(view: MatchSeatView) {
  return view.zones.flatMap((zone) =>
    zone.zone === "battlefield" ? zone.cards : [],
  );
}

function getOpponentSeat(view: MatchSeatView) {
  return view.seats.find((seat) => seat.seat !== view.viewerSeat)?.seat ?? null;
}

function getCatalogEntry(
  catalog: CardCatalogEntry[],
  cardId: string,
): CardCatalogEntry | null {
  return catalog.find((entry) => entry.cardId === cardId) ?? null;
}

function toActionArgs(
  intent: BotSupportedIntent,
): LegalActionDescriptorV1["args"] {
  return Object.entries(intent.payload).reduce<LegalActionDescriptorV1["args"]>(
    (args, [key, value]) => {
      if (
        typeof value === "boolean" ||
        typeof value === "number" ||
        typeof value === "string" ||
        value === null
      ) {
        args[key] = value;
        return args;
      }

      if (Array.isArray(value)) {
        args[key] = value.map((entry) =>
          typeof entry === "string" ? entry : JSON.stringify(entry),
        );
      }

      return args;
    },
    {},
  );
}

function createLegalityFingerprint(
  frame: BotDecisionFrame,
  intent: BotSupportedIntent,
): string {
  return [
    "v1",
    frame.matchId,
    String(frame.view.match.version),
    intent.kind,
    JSON.stringify(toActionArgs(intent)),
  ].join(":");
}

function createDescriptor<TIntent extends BotSupportedIntent>(input: {
  frame: BotDecisionFrame;
  humanLabel: string;
  intent: TIntent;
  machineLabel: string;
  priority: number;
}) {
  const kind: TIntent["kind"] = input.intent.kind;

  return {
    actionId: input.intent.intentId,
    args: toActionArgs(input.intent),
    humanLabel: input.humanLabel,
    intent: input.intent,
    kind,
    legalityFingerprint: createLegalityFingerprint(input.frame, input.intent),
    machineLabel: input.machineLabel,
    priority: input.priority,
  };
}

function scoreCardForPlay(entry: CardCatalogEntry | null): number {
  if (!entry) {
    return -1;
  }

  let score = 0;
  if (entry.reasoning.effectKinds.includes("dealDamage")) {
    score += 100;
  }
  if (entry.reasoning.effectKinds.includes("drawCards")) {
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

function scoreAbilityTarget(input: {
  abilityText: string;
  card: MatchCardView;
}): number {
  let score = 0;

  if (
    input.abilityText.toLowerCase().includes("haste") &&
    !input.card.keywords.includes("haste")
  ) {
    score += 20;
  }

  score += input.card.statLine?.power ?? 0;
  score += input.card.statLine?.toughness ?? 0;
  return score;
}

function listAbilityTargetCandidates(input: {
  controllerSeat: string;
  sourceInstanceId: string;
  targetSelector:
    | "anyCard"
    | "friendlyUnit"
    | "opposingUnit"
    | "player"
    | "self"
    | "stackObject";
  view: MatchSeatView;
}): MatchCardView[] {
  const battlefield = getBattlefieldCards(input.view);

  switch (input.targetSelector) {
    case "self":
      return battlefield.filter(
        (card) => card.instanceId === input.sourceInstanceId,
      );
    case "friendlyUnit":
      return battlefield.filter(
        (card) => card.controllerSeat === input.controllerSeat,
      );
    case "opposingUnit":
      return battlefield.filter(
        (card) => card.controllerSeat !== input.controllerSeat,
      );
    default:
      return [];
  }
}

function listAttackerSubsets(cards: MatchCardView[]) {
  const limitedCards = cards.slice(0, 4);
  const subsets: MatchCardView[][] = [[]];

  for (const card of limitedCards) {
    const nextSubsets = subsets.map((subset) => [...subset, card]);
    subsets.push(...nextSubsets);
  }

  return subsets
    .map((subset) =>
      subset.sort((left, right) => left.name.localeCompare(right.name)),
    )
    .sort((left, right) => right.length - left.length);
}

function canAttackWithCard(card: MatchCardView, seat: string) {
  return (
    card.controllerSeat === seat &&
    (card.statLine?.power ?? 0) > 0 &&
    !card.annotations.includes("summoningSick")
  );
}

function canBlockWithCard(
  blocker: MatchCardView,
  attacker: MatchCardView,
  seat: string,
) {
  return (
    blocker.controllerSeat === seat &&
    (blocker.statLine?.power ?? 0) > 0 &&
    (blocker.statLine?.toughness ?? 0) > 0 &&
    (!attacker.keywords.includes("flying") ||
      blocker.keywords.includes("flying"))
  );
}

function listCombatAttackActions(frame: BotDecisionFrame): BotLegalAction[] {
  if (!frame.view.availableIntents.includes("declareAttackers")) {
    return [];
  }

  const defenderSeat = getOpponentSeat(frame.view);
  if (!defenderSeat) {
    return [];
  }

  const attackers = getZoneCards(frame.view, "battlefield").filter((card) =>
    canAttackWithCard(card, frame.seat),
  );

  return listAttackerSubsets(attackers).map((subset, index) =>
    createDescriptor({
      frame,
      humanLabel:
        subset.length === 0
          ? "Skip attacks"
          : `Attack with ${subset.map((card) => card.name).join(", ")}`,
      intent: {
        intentId: createActionId(
          frame,
          `attack:${index}:${subset.map((card) => card.instanceId).join(",") || "none"}`,
        ),
        kind: "declareAttackers",
        matchId: frame.matchId,
        payload: {
          attackers: subset.map((card) => ({
            attackerId: card.instanceId,
            defenderSeat: assertMatchSeatId(defenderSeat),
            laneId: null,
          })),
        },
        seat: frame.seat,
        stateVersion: frame.view.match.version,
      },
      machineLabel:
        subset.length === 0
          ? "declare_attackers()"
          : `declare_attackers(${subset.map((card) => card.cardId).join(",")})`,
      priority:
        subset.reduce(
          (total, card) =>
            total +
            (card.statLine?.power ?? 0) +
            (card.statLine?.toughness ?? 0),
          0,
        ) +
        subset.length * 10,
    }),
  );
}

function listCombatBlockActions(frame: BotDecisionFrame): BotLegalAction[] {
  if (!frame.view.availableIntents.includes("declareBlockers")) {
    return [];
  }

  const battlefieldById = new Map(
    getBattlefieldCards(frame.view).map((card) => [card.instanceId, card]),
  );
  const attackers = frame.view.combat.attackers
    .map((attacker) => battlefieldById.get(attacker.attackerId))
    .filter((card): card is MatchCardView => card !== undefined);
  const blockers = getZoneCards(frame.view, "battlefield").filter(
    (card) => card.controllerSeat === frame.seat,
  );

  const actions: BotLegalAction[] = [
    createDescriptor({
      frame,
      humanLabel: "Declare no blocks",
      intent: {
        intentId: createActionId(frame, "block:none"),
        kind: "declareBlockers",
        matchId: frame.matchId,
        payload: {
          blocks: [],
        },
        seat: frame.seat,
        stateVersion: frame.view.match.version,
      },
      machineLabel: "declare_blockers()",
      priority: 1,
    }),
  ];

  for (const attacker of attackers) {
    for (const blocker of blockers) {
      if (!canBlockWithCard(blocker, attacker, frame.seat)) {
        continue;
      }

      actions.push(
        createDescriptor({
          frame,
          humanLabel: `Block ${attacker.name} with ${blocker.name}`,
          intent: {
            intentId: createActionId(
              frame,
              `block:${attacker.instanceId}:${blocker.instanceId}`,
            ),
            kind: "declareBlockers",
            matchId: frame.matchId,
            payload: {
              blocks: [
                {
                  attackerId: attacker.instanceId,
                  blockerId: blocker.instanceId,
                },
              ],
            },
            seat: frame.seat,
            stateVersion: frame.view.match.version,
          },
          machineLabel: `declare_blockers(${blocker.cardId}->${attacker.cardId})`,
          priority:
            (attacker.statLine?.power ?? 0) +
            (blocker.statLine?.toughness ?? 0) +
            10,
        }),
      );
    }
  }

  return actions;
}

function buildDefaultCombatAssignmentsFromView(view: MatchSeatView) {
  const battlefieldById = new Map(
    getBattlefieldCards(view).map((card) => [card.instanceId, card]),
  );
  const blockerByAttacker = new Map(
    view.combat.blocks.map((block) => [block.attackerId, block.blockerId]),
  );

  const assignments: Array<{
    amount: number;
    sourceId: string;
    targetId: string;
  }> = [];

  for (const attacker of view.combat.attackers) {
    const attackerCard = battlefieldById.get(attacker.attackerId);
    const power = attackerCard?.statLine?.power ?? 0;
    if (power <= 0) {
      continue;
    }

    const blockerId = blockerByAttacker.get(attacker.attackerId);
    assignments.push({
      amount: power,
      sourceId: attacker.attackerId,
      targetId: blockerId ?? attacker.defenderSeat,
    });
  }

  for (const block of view.combat.blocks) {
    const blockerCard = battlefieldById.get(block.blockerId);
    const power = blockerCard?.statLine?.power ?? 0;
    if (power <= 0) {
      continue;
    }

    assignments.push({
      amount: power,
      sourceId: block.blockerId,
      targetId: block.attackerId,
    });
  }

  return assignments.sort((left, right) => {
    if (left.sourceId === right.sourceId) {
      return left.targetId.localeCompare(right.targetId);
    }
    return left.sourceId.localeCompare(right.sourceId);
  });
}

function listCombatDamageActions(frame: BotDecisionFrame): BotLegalAction[] {
  if (!frame.view.availableIntents.includes("assignCombatDamage")) {
    return [];
  }

  const assignments = buildDefaultCombatAssignmentsFromView(frame.view);
  return [
    createDescriptor({
      frame,
      humanLabel: "Resolve combat damage",
      intent: {
        intentId: createActionId(frame, "combat-damage"),
        kind: "assignCombatDamage",
        matchId: frame.matchId,
        payload: {
          assignments,
        },
        seat: frame.seat,
        stateVersion: frame.view.match.version,
      },
      machineLabel: "assign_combat_damage()",
      priority: 700,
    }),
  ];
}

function listPlayableCardActions(frame: BotDecisionFrame): BotLegalAction[] {
  if (!frame.view.availableIntents.includes("playCard")) {
    return [];
  }

  const currentResourceTotal = getCurrentResourceTotal(frame.view);
  return getZoneCards(frame.view, "hand")
    .reduce<BotLegalAction[]>((actions, card) => {
      const entry = getCatalogEntry(frame.catalog, card.cardId);
      if (!entry || entry.cost > currentResourceTotal) {
        return actions;
      }

      const intent: BotSupportedIntent = {
        intentId: createActionId(frame, `play:${card.instanceId}`),
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

      actions.push(
        createDescriptor({
          frame,
          humanLabel: `Play ${entry.name}`,
          intent,
          machineLabel: `play_card(${entry.cardId})`,
          priority: scoreCardForPlay(entry),
        }),
      );
      return actions;
    }, [])
    .sort((left, right) => {
      if (left.priority === right.priority) {
        return left.humanLabel.localeCompare(right.humanLabel);
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
  return getZoneCards(frame.view, "battlefield")
    .flatMap((card) => {
      const entry = getCatalogEntry(frame.catalog, card.cardId);
      if (!entry) {
        return [];
      }

      return entry.abilities
        .filter(
          (ability) =>
            ability.kind === "activated" &&
            (ability.resourceCost ?? 0) <= currentResourceTotal,
        )
        .flatMap((ability) => {
          if (!ability.requiresTargets) {
            return [
              createDescriptor({
                frame,
                humanLabel: `${entry.name}: ${ability.text}`,
                intent: {
                  intentId: createActionId(
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
                },
                machineLabel: `activate_ability(${entry.cardId}:${ability.id})`,
                priority: 40 + (ability.resourceCost ?? 0),
              }),
            ];
          }

          if ((ability.targets?.length ?? 0) !== 1) {
            return [];
          }

          const [targetSpec] = ability.targets ?? [];
          if (
            !targetSpec ||
            targetSpec.minSelections !== 1 ||
            targetSpec.maxSelections !== 1
          ) {
            return [];
          }

          return listAbilityTargetCandidates({
            controllerSeat: frame.seat,
            sourceInstanceId: card.instanceId,
            targetSelector: targetSpec.selector,
            view: frame.view,
          }).map((targetCard) =>
            createDescriptor({
              frame,
              humanLabel: `${entry.name}: ${ability.text} -> ${targetCard.name}`,
              intent: {
                intentId: createActionId(
                  frame,
                  `ability:${card.instanceId}:${ability.id}:${targetCard.instanceId}`,
                ),
                kind: "activateAbility",
                matchId: frame.matchId,
                payload: {
                  abilityId: ability.id,
                  sourceInstanceId: card.instanceId,
                  targetIds: [targetCard.instanceId],
                },
                seat: frame.seat,
                stateVersion: frame.view.match.version,
              },
              machineLabel: `activate_ability(${entry.cardId}:${ability.id},target=${targetCard.cardId})`,
              priority:
                40 +
                (ability.resourceCost ?? 0) +
                scoreAbilityTarget({
                  abilityText: ability.text,
                  card: targetCard,
                }),
            }),
          );
        });
    })
    .sort((left, right) => {
      if (left.priority === right.priority) {
        return left.humanLabel.localeCompare(right.humanLabel);
      }

      return right.priority - left.priority;
    });
}

function buildPromptChoiceIntent(input: {
  choice: MatchPromptChoiceView;
  frame: BotDecisionFrame;
}): BotLegalAction | null {
  const prompt = input.frame.view.prompt;
  if (!prompt || input.choice.disabled) {
    return null;
  }

  if (
    prompt.kind === "mulligan" &&
    input.frame.view.availableIntents.includes("keepOpeningHand") &&
    input.choice.choiceId === "keep"
  ) {
    return createDescriptor({
      frame: input.frame,
      humanLabel: "Keep opening hand",
      intent: {
        intentId: createActionId(input.frame, `keep:${prompt.promptId}`),
        kind: "keepOpeningHand",
        matchId: input.frame.matchId,
        payload: {},
        seat: input.frame.seat,
        stateVersion: input.frame.view.match.version,
      },
      machineLabel: "keep_opening_hand()",
      priority: 1000,
    });
  }

  if (
    prompt.kind === "mulligan" &&
    input.frame.view.availableIntents.includes("takeMulligan") &&
    input.choice.choiceId.startsWith("mulligan:")
  ) {
    return createDescriptor({
      frame: input.frame,
      humanLabel: `Take mulligan to ${input.choice.choiceId.split(":")[1] ?? "unknown"}`,
      intent: {
        intentId: createActionId(
          input.frame,
          `mulligan:${prompt.promptId}:${input.choice.choiceId}`,
        ),
        kind: "takeMulligan",
        matchId: input.frame.matchId,
        payload: {
          targetHandSize: Number(input.choice.choiceId.split(":")[1] ?? ""),
        },
        seat: input.frame.seat,
        stateVersion: input.frame.view.match.version,
      },
      machineLabel: `take_mulligan(${input.choice.choiceId})`,
      priority: 900,
    });
  }

  if (
    prompt.kind === "choice" &&
    input.frame.view.availableIntents.includes("choosePromptOptions")
  ) {
    return createDescriptor({
      frame: input.frame,
      humanLabel: input.choice.label,
      intent: {
        intentId: createActionId(
          input.frame,
          `prompt:${prompt.promptId}:${input.choice.choiceId}`,
        ),
        kind: "choosePromptOptions",
        matchId: input.frame.matchId,
        payload: {
          choiceIds: [input.choice.choiceId],
          promptId: prompt.promptId,
        },
        seat: input.frame.seat,
        stateVersion: input.frame.view.match.version,
      },
      machineLabel: `choose_prompt_option(${input.choice.choiceId})`,
      priority: 500,
    });
  }

  if (
    prompt.kind === "targets" &&
    input.frame.view.availableIntents.includes("chooseTargets")
  ) {
    return createDescriptor({
      frame: input.frame,
      humanLabel: input.choice.label,
      intent: {
        intentId: createActionId(
          input.frame,
          `targets:${prompt.promptId}:${input.choice.choiceId}`,
        ),
        kind: "chooseTargets",
        matchId: input.frame.matchId,
        payload: {
          promptId: prompt.promptId,
          targetIds: [input.choice.choiceId],
        },
        seat: input.frame.seat,
        stateVersion: input.frame.view.match.version,
      },
      machineLabel: `choose_target(${input.choice.choiceId})`,
      priority: 500,
    });
  }

  if (
    prompt.kind === "modes" &&
    input.frame.view.availableIntents.includes("chooseModes")
  ) {
    return createDescriptor({
      frame: input.frame,
      humanLabel: input.choice.label,
      intent: {
        intentId: createActionId(
          input.frame,
          `modes:${prompt.promptId}:${input.choice.choiceId}`,
        ),
        kind: "chooseModes",
        matchId: input.frame.matchId,
        payload: {
          modeIds: [input.choice.choiceId],
          promptId: prompt.promptId,
        },
        seat: input.frame.seat,
        stateVersion: input.frame.view.match.version,
      },
      machineLabel: `choose_mode(${input.choice.choiceId})`,
      priority: 500,
    });
  }

  if (
    prompt.kind === "costs" &&
    input.frame.view.availableIntents.includes("chooseCosts")
  ) {
    return createDescriptor({
      frame: input.frame,
      humanLabel: input.choice.label,
      intent: {
        intentId: createActionId(
          input.frame,
          `costs:${prompt.promptId}:${input.choice.choiceId}`,
        ),
        kind: "chooseCosts",
        matchId: input.frame.matchId,
        payload: {
          costIds: [input.choice.choiceId],
          promptId: prompt.promptId,
        },
        seat: input.frame.seat,
        stateVersion: input.frame.view.match.version,
      },
      machineLabel: `choose_cost(${input.choice.choiceId})`,
      priority: 500,
    });
  }

  return null;
}

function listPromptActions(frame: BotDecisionFrame) {
  if (!frame.view.prompt) {
    return [];
  }

  return frame.view.prompt.choices
    .map((choice) =>
      buildPromptChoiceIntent({
        choice,
        frame,
      }),
    )
    .filter((descriptor): descriptor is BotLegalAction => descriptor !== null);
}

function listCommandActions(frame: BotDecisionFrame) {
  const seat = getCurrentSeat(frame.view);
  if (!seat) {
    return [];
  }

  const actions: BotLegalAction[] = [];

  if (frame.view.availableIntents.includes("passPriority")) {
    actions.push(
      createDescriptor({
        frame,
        humanLabel: "Pass priority",
        intent: {
          intentId: createActionId(frame, "pass"),
          kind: "passPriority",
          matchId: frame.matchId,
          payload: {},
          seat: frame.seat,
          stateVersion: frame.view.match.version,
        },
        machineLabel: "pass_priority()",
        priority: 1,
      }),
    );
  }

  if (frame.view.availableIntents.includes("toggleAutoPass")) {
    actions.push(
      createDescriptor({
        frame,
        humanLabel: seat.autoPassEnabled
          ? "Disable auto-pass"
          : "Enable auto-pass",
        intent: {
          intentId: createActionId(
            frame,
            `auto-pass:${seat.autoPassEnabled ? "off" : "on"}`,
          ),
          kind: "toggleAutoPass",
          matchId: frame.matchId,
          payload: {
            enabled: !seat.autoPassEnabled,
          },
          seat: frame.seat,
          stateVersion: frame.view.match.version,
        },
        machineLabel: `toggle_auto_pass(${seat.autoPassEnabled ? "false" : "true"})`,
        priority: -1,
      }),
    );
  }

  if (frame.view.availableIntents.includes("concede")) {
    actions.push(
      createDescriptor({
        frame,
        humanLabel: "Concede match",
        intent: {
          intentId: createActionId(frame, "concede"),
          kind: "concede",
          matchId: frame.matchId,
          payload: {
            reason: "manual",
          },
          seat: frame.seat,
          stateVersion: frame.view.match.version,
        },
        machineLabel: "concede(manual)",
        priority: 0,
      }),
    );
  }

  return actions;
}

export function listLegalActionDescriptors(
  frame: BotDecisionFrame,
): BotLegalAction[] {
  return [
    ...listPromptActions(frame),
    ...listCombatDamageActions(frame),
    ...listCombatBlockActions(frame),
    ...listCombatAttackActions(frame),
    ...listPlayableCardActions(frame),
    ...listActivatedAbilityActions(frame),
    ...listCommandActions(frame),
  ].sort((left, right) => {
    if (left.priority === right.priority) {
      return left.humanLabel.localeCompare(right.humanLabel);
    }

    return right.priority - left.priority;
  });
}

function buildPromptDecision(
  view: MatchView,
): AgentMatchContextV1["promptDecision"] {
  if (!view.prompt) {
    return null;
  }

  return {
    choices: view.prompt.choices.map((choice) => ({
      choiceId: choice.choiceId,
      disabled: choice.disabled,
      hint: choice.hint,
      label: choice.label,
    })),
    kind: view.prompt.kind,
    maxSelections: view.prompt.maxSelections,
    message: view.prompt.message,
    minSelections: view.prompt.minSelections,
    ownerSeat: view.prompt.ownerSeat,
    promptId: view.prompt.promptId,
  };
}

function buildVisibleCards(
  catalog: CardCatalogEntry[],
  zones: MatchView["zones"],
): AgentVisibleCardV1[] {
  const catalogById = new Map(catalog.map((card) => [card.cardId, card]));
  const visibleCards = new Map<string, AgentVisibleCardV1>();

  for (const zone of zones) {
    if (zone.visibility === "hidden" || zone.cards.length === 0) {
      continue;
    }

    for (const card of zone.cards) {
      const catalogEntry = catalogById.get(card.cardId);
      if (!catalogEntry) {
        continue;
      }

      const existing = visibleCards.get(card.cardId);
      const seenInEntry = {
        ownerSeat: zone.ownerSeat,
        visibility: zone.visibility,
        zone: zone.zone,
      };

      if (existing) {
        if (
          !existing.seenIn.some(
            (candidate) =>
              candidate.ownerSeat === seenInEntry.ownerSeat &&
              candidate.visibility === seenInEntry.visibility &&
              candidate.zone === seenInEntry.zone,
          )
        ) {
          existing.seenIn.push(seenInEntry);
        }
        continue;
      }

      visibleCards.set(card.cardId, {
        card: catalogEntry,
        seenIn: [seenInEntry],
      });
    }
  }

  return [...visibleCards.values()].sort((left, right) =>
    left.card.name.localeCompare(right.card.name),
  );
}

export function createAgentMatchContext(input: {
  catalog: CardCatalogEntry[];
  receivedAt?: number;
  view: MatchView;
}): AgentMatchContextV1 {
  const buildStartedAt = nowMs();
  const receivedAt = input.receivedAt ?? Date.now();
  const seat = input.view.kind === "seat" ? input.view.viewerSeat : null;
  const frame =
    input.view.kind === "seat"
      ? ({
          availableIntentKinds: [...input.view.availableIntents],
          catalog: input.catalog,
          deadlineAt: input.view.match.timers.activeDeadlineAt,
          matchId: input.view.match.id,
          receivedAt,
          seat: input.view.viewerSeat as BotDecisionFrame["seat"],
          view: input.view,
        } satisfies Omit<BotDecisionFrame, "context">)
      : null;

  const legalActions =
    input.view.kind === "seat"
      ? listLegalActionDescriptors({
          ...frame,
          context: null as never,
        } as BotDecisionFrame)
      : [];

  const buildFinishedAt = nowMs();

  return {
    availableIntentKinds:
      input.view.kind === "seat" ? [...input.view.availableIntents] : [],
    builtAt: receivedAt,
    buildDurationMs: Number((buildFinishedAt - buildStartedAt).toFixed(3)),
    combat: {
      attackers: input.view.combat.attackers.map((attacker) => ({
        ...attacker,
      })),
      blocks: input.view.combat.blocks.map((block) => ({ ...block })),
    },
    legalActions,
    match: input.view.match,
    prompt: input.view.prompt,
    promptDecision: buildPromptDecision(input.view),
    recentEvents: [...input.view.recentEvents],
    seats: input.view.seats.map((seatState) => ({
      ...seatState,
      resources: seatState.resources.map((resource) => ({ ...resource })),
    })),
    stack: input.view.stack.map((stackItem) => ({
      ...stackItem,
      targetLabels: [...stackItem.targetLabels],
    })),
    version: AGENT_MATCH_CONTEXT_VERSION,
    viewKind: input.view.kind,
    viewerSeat: seat,
    visibleCards: buildVisibleCards(input.catalog, input.view.zones),
    zones: input.view.zones.map((zone) => ({
      ...zone,
      cards: zone.cards.map((card) => ({
        ...card,
        annotations: [...card.annotations],
        counters: { ...card.counters },
        keywords: [...card.keywords],
        permissions: [...(card.permissions ?? [])],
        statLine: card.statLine ? { ...card.statLine } : null,
      })),
    })),
  };
}
