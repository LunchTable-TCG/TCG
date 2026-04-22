import type {
  GameplayIntent,
  MatchEvent,
  MatchPhase,
  SeatId,
  ZoneKind,
} from "@lunchtable/shared-types";

import {
  type MatchState,
  createMatchShellFromState,
  deriveBattlefieldCardStates,
  deriveDeterministicNumber,
  isActivatedAbility,
  isTriggeredAbility,
  listReplacementAbilities,
} from "./state";

export interface MatchTransition {
  events: MatchEvent[];
  nextState: MatchState;
  outcome: "applied" | "noop" | "rejected";
  reason?: MatchTransitionReason;
}

export type MatchTransitionReason =
  | "abilityNotFound"
  | "cardNotFound"
  | "cardNotInZone"
  | "insufficientResources"
  | "invalidMatch"
  | "invalidPhase"
  | "invalidPrompt"
  | "invalidSeat"
  | "invalidZone"
  | "matchComplete"
  | "notPriorityOwner"
  | "staleStateVersion"
  | "unsupportedCost"
  | "unsupportedTargeting"
  | "unsupportedIntent";

type CombatAssignment = Extract<
  GameplayIntent,
  { kind: "assignCombatDamage" }
>["payload"]["assignments"][number];

const MAIN_PHASES = new Set<MatchPhase>(["main1", "main2"]);
const PHASE_ADVANCE_MAP: Partial<Record<MatchPhase, MatchPhase>> = {
  attack: "block",
  block: "damage",
  cleanup: "main1",
  damage: "main2",
  draw: "main1",
  end: "cleanup",
  main1: "attack",
  main2: "end",
  ready: "main1",
  upkeep: "draw",
};

function createEventFactory(state: MatchState) {
  let offset = 0;

  return function createEvent<TKind extends MatchEvent["kind"]>(
    kind: TKind,
    payload: Extract<MatchEvent, { kind: TKind }>["payload"],
  ): Extract<MatchEvent, { kind: TKind }> {
    offset += 1;
    const sequence = state.eventSequence + offset;
    return {
      at: (state.shell.startedAt ?? state.shell.createdAt) + sequence,
      eventId: `event_${sequence}`,
      kind,
      matchId: state.shell.id,
      payload,
      sequence,
      stateVersion: state.shell.version + 1,
    } as Extract<MatchEvent, { kind: TKind }>;
  };
}

function cloneCardCatalog(state: MatchState["cardCatalog"]) {
  return Object.fromEntries(
    Object.entries(state).map(([cardId, entry]) => [
      cardId,
      {
        ...entry,
        abilities: entry.abilities,
        keywords: [...entry.keywords],
        stats: entry.stats ? { ...entry.stats } : undefined,
      },
    ]),
  );
}

function getPendingPrompt(
  state: MatchState,
  seat: SeatId,
  kind?: MatchState["prompts"][number]["kind"],
) {
  return (
    state.prompts.find(
      (prompt) =>
        prompt.ownerSeat === seat &&
        prompt.status === "pending" &&
        (!kind || prompt.kind === kind),
    ) ?? null
  );
}

function resolvePrompt(
  state: MatchState,
  seat: SeatId,
  kind: MatchState["prompts"][number]["kind"],
  choiceIds: string[],
) {
  const prompt = getPendingPrompt(state, seat, kind);
  if (!prompt) {
    return null;
  }

  const normalizedChoiceIds = [...new Set(choiceIds)];
  if (
    normalizedChoiceIds.length !== 1 ||
    normalizedChoiceIds.some((choiceId) => !prompt.choiceIds.includes(choiceId))
  ) {
    return null;
  }

  prompt.status = "resolved";
  prompt.resolvedChoiceIds = normalizedChoiceIds;
  return prompt;
}

function getSeatIds(state: MatchState): SeatId[] {
  return Object.keys(state.seats) as SeatId[];
}

function getZoneReference(
  seat: MatchState["seats"][SeatId],
  zone: ZoneKind,
): string[] | null {
  switch (zone) {
    case "battlefield":
      return seat.battlefield;
    case "command":
      return seat.command;
    case "deck":
      return seat.deck;
    case "exile":
      return seat.exile;
    case "graveyard":
      return seat.graveyard;
    case "hand":
      return seat.hand;
    case "objective":
      return seat.objective;
    case "sideboard":
      return seat.sideboard;
    default:
      return null;
  }
}

function getCardIdFromInstanceId(instanceId: string) {
  const [, cardId] = instanceId.split(":");
  return cardId ?? instanceId;
}

function getOtherSeatId(state: MatchState, currentSeat: SeatId): SeatId | null {
  return getSeatIds(state).find((seat) => seat !== currentSeat) ?? null;
}

function clearCombat(state: MatchState) {
  state.combat.attackers = [];
  state.combat.blocks = [];
}

function sortCombatAttackers(attackers: MatchState["combat"]["attackers"]) {
  return [...attackers].sort((left, right) => {
    if (left.attackerId === right.attackerId) {
      if (left.defenderSeat === right.defenderSeat) {
        return (left.laneId ?? "").localeCompare(right.laneId ?? "");
      }
      return left.defenderSeat.localeCompare(right.defenderSeat);
    }
    return left.attackerId.localeCompare(right.attackerId);
  });
}

function sortCombatBlocks(blocks: MatchState["combat"]["blocks"]) {
  return [...blocks].sort((left, right) => {
    if (left.attackerId === right.attackerId) {
      return left.blockerId.localeCompare(right.blockerId);
    }
    return left.attackerId.localeCompare(right.attackerId);
  });
}

function sortCombatAssignments(assignments: CombatAssignment[]) {
  return [...assignments].sort((left, right) => {
    if (left.sourceId === right.sourceId) {
      if (left.targetId === right.targetId) {
        return left.amount - right.amount;
      }
      return left.targetId.localeCompare(right.targetId);
    }
    return left.sourceId.localeCompare(right.sourceId);
  });
}

function canAttack(
  state: MatchState,
  controllerSeat: SeatId,
  instanceId: string,
  derived = deriveBattlefieldCardStates(state),
) {
  const cardState = derived[instanceId];
  if (!cardState || cardState.controllerSeat !== controllerSeat) {
    return false;
  }

  if ((cardState.power ?? 0) <= 0 || (cardState.toughness ?? 0) <= 0) {
    return false;
  }

  const entryTurn = state.battlefieldEntryTurns[instanceId];
  if (
    entryTurn === state.shell.turnNumber &&
    !cardState.permissions.includes("ignoreSummoningSickness")
  ) {
    return false;
  }

  return true;
}

function canBlock(
  state: MatchState,
  controllerSeat: SeatId,
  blockerId: string,
  attackerId: string,
  derived = deriveBattlefieldCardStates(state),
) {
  const blocker = derived[blockerId];
  const attacker = derived[attackerId];
  if (!blocker || !attacker || blocker.controllerSeat !== controllerSeat) {
    return false;
  }

  if ((blocker.power ?? 0) <= 0 || (blocker.toughness ?? 0) <= 0) {
    return false;
  }

  if (
    attacker.keywords.includes("flying") &&
    !blocker.permissions.includes("canBlockFlying")
  ) {
    return false;
  }

  return true;
}

function buildDefaultCombatAssignments(state: MatchState): CombatAssignment[] {
  const derived = deriveBattlefieldCardStates(state);
  const blockerByAttacker = new Map(
    state.combat.blocks.map((block) => [block.attackerId, block.blockerId]),
  );

  const assignments: CombatAssignment[] = [];
  for (const attacker of state.combat.attackers) {
    const attackerState = derived[attacker.attackerId];
    const attackerPower = attackerState?.power ?? 0;
    if (attackerPower <= 0) {
      continue;
    }

    const blockerId = blockerByAttacker.get(attacker.attackerId);
    if (blockerId) {
      assignments.push({
        amount: attackerPower,
        sourceId: attacker.attackerId,
        targetId: blockerId,
      });
      continue;
    }

    assignments.push({
      amount: attackerPower,
      sourceId: attacker.attackerId,
      targetId: attacker.defenderSeat,
    });
  }

  for (const block of state.combat.blocks) {
    const blockerState = derived[block.blockerId];
    const blockerPower = blockerState?.power ?? 0;
    if (blockerPower <= 0) {
      continue;
    }
    assignments.push({
      amount: blockerPower,
      sourceId: block.blockerId,
      targetId: block.attackerId,
    });
  }

  return sortCombatAssignments(assignments);
}

function setSeatResources(seat: MatchState["seats"][SeatId], amount: number) {
  seat.resources = [
    {
      current: amount,
      label: "Mana",
      maximum: amount,
      resourceId: "mana",
    },
  ];
}

function resetTurnResources(state: MatchState) {
  const activeSeat = state.shell.activeSeat;
  const amount = Math.max(1, state.shell.turnNumber);
  for (const seat of Object.values(state.seats)) {
    setSeatResources(seat, seat.seat === activeSeat ? amount : 0);
  }
}

function shuffleInstances(
  instances: string[],
  random: MatchState["random"],
): [string[], MatchState["random"]] {
  let nextRandom = random;
  const weighted = instances.map((instanceId) => {
    const [weight, updatedRandom] = deriveDeterministicNumber(nextRandom);
    nextRandom = updatedRandom;
    return {
      instanceId,
      weight,
    };
  });

  weighted.sort((left, right) => {
    if (left.weight === right.weight) {
      return left.instanceId.localeCompare(right.instanceId);
    }
    return left.weight - right.weight;
  });

  return [weighted.map((item) => item.instanceId), nextRandom];
}

function advanceTurn(state: MatchState) {
  const currentActiveSeat =
    state.shell.activeSeat ?? getSeatIds(state)[0] ?? null;
  const nextActiveSeat = currentActiveSeat
    ? (getOtherSeatId(state, currentActiveSeat) ?? currentActiveSeat)
    : (getSeatIds(state)[0] ?? null);

  state.shell.activeSeat = nextActiveSeat;
  state.shell.turnNumber += 1;
  state.shell.phase = "main1";
  state.shell.prioritySeat = nextActiveSeat;
  state.lastPriorityPassSeat = null;
  clearCombat(state);
  resetTurnResources(state);
  state.continuousEffects = state.continuousEffects.filter(
    (effect) =>
      effect.expiresAtTurn === null ||
      effect.expiresAtTurn >= state.shell.turnNumber,
  );
}

function advancePhase(state: MatchState) {
  if (state.shell.phase === "cleanup") {
    advanceTurn(state);
    return;
  }

  const nextPhase = PHASE_ADVANCE_MAP[state.shell.phase] ?? state.shell.phase;
  state.shell.phase = nextPhase;
  state.shell.prioritySeat = state.shell.activeSeat;
  state.lastPriorityPassSeat = null;
  if (nextPhase === "main1") {
    resetTurnResources(state);
  }
}

function drawCards(seat: MatchState["seats"][SeatId], count: number) {
  const drawn = seat.deck.splice(0, count);
  seat.hand.push(...drawn);
  return drawn;
}

function completeMatch(
  state: MatchState,
  createEvent: ReturnType<typeof createEventFactory>,
  input: {
    defeatedSeats: SeatId[];
    reason:
      | "administrative"
      | "concession"
      | "draw"
      | "elimination"
      | "objective";
  },
) {
  if (state.shell.status === "complete") {
    return [] as MatchEvent[];
  }

  for (const seatId of input.defeatedSeats) {
    const seat = state.seats[seatId];
    if (seat) {
      seat.status = "eliminated";
    }
  }

  state.shell.status = "complete";
  state.shell.completedAt = state.shell.startedAt ?? state.shell.createdAt;
  state.shell.winnerSeat =
    input.defeatedSeats.length === 1
      ? getOtherSeatId(state, input.defeatedSeats[0] ?? "seat-0")
      : null;

  return [
    createEvent("matchCompleted", {
      reason: input.reason,
      winnerSeat: state.shell.winnerSeat,
    }),
  ];
}

function applyTurnStartDraw(
  state: MatchState,
  createEvent: ReturnType<typeof createEventFactory>,
) {
  const activeSeatId = state.shell.activeSeat;
  if (!activeSeatId) {
    return [] as MatchEvent[];
  }

  const activeSeat = state.seats[activeSeatId];
  if (!activeSeat) {
    return [] as MatchEvent[];
  }

  const drawn = drawCards(activeSeat, 1);
  if (drawn.length === 0) {
    return completeMatch(state, createEvent, {
      defeatedSeats: [activeSeatId],
      reason: "elimination",
    });
  }

  return [
    createEvent("cardsDrawn", {
      count: drawn.length,
      seat: activeSeatId,
    }),
  ];
}

function getCardCatalogEntry(
  state: MatchState,
  instanceId: string,
): MatchState["cardCatalog"][string] | null {
  return state.cardCatalog[getCardIdFromInstanceId(instanceId)] ?? null;
}

function hasUnsupportedEffects(
  effects: MatchState["stack"][number]["effects"],
) {
  return effects.some((effect) => {
    switch (effect.kind) {
      case "destroy":
      case "grantKeyword":
      case "modifyStats":
        return false;
      case "drawCards":
      case "adjustResource":
      case "dealDamage":
        return effect.target === "target";
      case "setAutoPass":
        return false;
      default:
        return true;
    }
  });
}

function getAllZoneInstances(state: MatchState) {
  return Object.values(state.seats).flatMap((seat) => [
    ...seat.battlefield,
    ...seat.command,
    ...seat.deck,
    ...seat.exile,
    ...seat.graveyard,
    ...seat.hand,
    ...seat.objective,
    ...seat.sideboard,
  ]);
}

function matchesTargetSelector(input: {
  controllerSeat: SeatId;
  selector:
    | "anyCard"
    | "friendlyUnit"
    | "opposingUnit"
    | "player"
    | "self"
    | "stackObject";
  sourceInstanceId: string;
  state: MatchState;
  targetId: string;
}) {
  switch (input.selector) {
    case "self":
      return input.targetId === input.sourceInstanceId;
    case "friendlyUnit":
      return input.state.seats[input.controllerSeat].battlefield.includes(
        input.targetId,
      );
    case "opposingUnit": {
      const otherSeat = getOtherSeatId(input.state, input.controllerSeat);
      return otherSeat
        ? input.state.seats[otherSeat].battlefield.includes(input.targetId)
        : false;
    }
    case "player": {
      const otherSeat = getOtherSeatId(input.state, input.controllerSeat);
      return (
        input.targetId === input.controllerSeat ||
        (otherSeat !== null && input.targetId === otherSeat)
      );
    }
    case "stackObject":
      return input.state.stack.some(
        (stackObject) => stackObject.stackId === input.targetId,
      );
    case "anyCard":
      return getAllZoneInstances(input.state).includes(input.targetId);
    default:
      return false;
  }
}

function hasValidAbilityTargets(input: {
  ability: Extract<
    MatchState["cardCatalog"][string]["abilities"][number],
    {
      kind: "activated";
    }
  >;
  controllerSeat: SeatId;
  sourceInstanceId: string;
  state: MatchState;
  targetIds: string[];
}) {
  const targetSpecs = input.ability.targets ?? [];
  if (targetSpecs.length === 0) {
    return input.targetIds.length === 0;
  }

  if (targetSpecs.length !== 1) {
    return false;
  }

  const [targetSpec] = targetSpecs;
  if (!targetSpec) {
    return false;
  }

  if (
    input.targetIds.length < targetSpec.count.min ||
    input.targetIds.length > targetSpec.count.max
  ) {
    return false;
  }

  if (new Set(input.targetIds).size !== input.targetIds.length) {
    return false;
  }

  return input.targetIds.every((targetId) =>
    matchesTargetSelector({
      controllerSeat: input.controllerSeat,
      selector: targetSpec.selector,
      sourceInstanceId: input.sourceInstanceId,
      state: input.state,
      targetId,
    }),
  );
}

function createStackObjectId(state: MatchState, offset = 0) {
  return `stack_${state.eventSequence + state.stack.length + offset + 1}`;
}

function createStackObject(
  state: MatchState,
  input: Omit<
    MatchState["stack"][number],
    "stackId" | "status" | "targetIds"
  > & {
    targetIds?: string[];
  },
) {
  const stackObject = {
    ...input,
    stackId: createStackObjectId(state),
    status: "pending" as const,
    targetIds: [...(input.targetIds ?? [])],
  };
  state.stack.push(stackObject);
  return stackObject;
}

function createStackObjectCreatedEvents(
  createEvent: ReturnType<typeof createEventFactory>,
  stackObjects: MatchState["stack"],
) {
  return stackObjects.map((stackObject) =>
    createEvent("stackObjectCreated", {
      controllerSeat: stackObject.controllerSeat,
      label: stackObject.label,
      stackId: stackObject.stackId,
    }),
  );
}

function ensureResource(
  seat: MatchState["seats"][SeatId],
  resourceId: string,
  label = "Mana",
) {
  let resource = seat.resources.find(
    (seatResource) => seatResource.resourceId === resourceId,
  );
  if (!resource) {
    resource = {
      current: 0,
      label,
      maximum: 0,
      resourceId,
    };
    seat.resources.push(resource);
  }
  return resource;
}

function applyLifeTotalCheck(
  state: MatchState,
  createEvent: ReturnType<typeof createEventFactory>,
) {
  const defeatedSeats = getSeatIds(state).filter(
    (seatId) => (state.seats[seatId]?.lifeTotal ?? 1) <= 0,
  );
  if (defeatedSeats.length === 0 || state.shell.status === "complete") {
    return [] as MatchEvent[];
  }

  return completeMatch(state, createEvent, {
    defeatedSeats,
    reason: defeatedSeats.length > 1 ? "draw" : "elimination",
  });
}

function moveBattlefieldCard(
  state: MatchState,
  createEvent: ReturnType<typeof createEventFactory>,
  input: {
    instanceId: string;
    publicReason: string;
    toZone: "exile" | "graveyard";
  },
) {
  for (const seatId of getSeatIds(state)) {
    const battlefield = state.seats[seatId]?.battlefield;
    if (!battlefield) {
      continue;
    }

    const cardIndex = battlefield.indexOf(input.instanceId);
    if (cardIndex === -1) {
      continue;
    }

    const destinationZone = getZoneReference(state.seats[seatId], input.toZone);
    if (!destinationZone) {
      return [] as MatchEvent[];
    }

    battlefield.splice(cardIndex, 1);
    delete state.battlefieldEntryTurns[input.instanceId];
    destinationZone.push(input.instanceId);
    return [
      createEvent("cardMoved", {
        cardInstanceId: input.instanceId,
        fromZone: "battlefield",
        publicReason: input.publicReason,
        toZone: input.toZone,
      }),
    ];
  }

  return [] as MatchEvent[];
}

function getDestroyDestination(
  state: MatchState,
  instanceId: string,
): "exile" | "graveyard" {
  const isDestroyDestination = (
    destination: string,
  ): destination is "exile" | "graveyard" =>
    destination === "exile" || destination === "graveyard";

  const replacement = listReplacementAbilities(state, instanceId).find(
    (ability) =>
      ability.watches.kind === "event" &&
      ability.watches.event === "selfWouldBeDestroyed" &&
      ability.replace.kind === "moveInstead" &&
      isDestroyDestination(ability.replace.destination),
  );

  if (
    replacement?.replace.kind === "moveInstead" &&
    isDestroyDestination(replacement.replace.destination)
  ) {
    return replacement.replace.destination;
  }

  return "graveyard";
}

function applyStateBasedActions(
  state: MatchState,
  createEvent: ReturnType<typeof createEventFactory>,
) {
  const events: MatchEvent[] = [];

  while (true) {
    const derivedBattlefield = deriveBattlefieldCardStates(state);
    const doomedInstanceIds = Object.values(derivedBattlefield)
      .filter(
        (cardState) => cardState.toughness !== null && cardState.toughness <= 0,
      )
      .map((cardState) => cardState.instanceId);

    if (doomedInstanceIds.length === 0) {
      break;
    }

    for (const instanceId of doomedInstanceIds) {
      events.push(
        ...moveBattlefieldCard(state, createEvent, {
          instanceId,
          publicReason: "stateBasedAction",
          toZone: getDestroyDestination(state, instanceId),
        }),
      );
    }
  }

  return events;
}

function applyEffectSequence(
  state: MatchState,
  createEvent: ReturnType<typeof createEventFactory>,
  input: {
    controllerSeat: SeatId;
    effects: MatchState["stack"][number]["effects"];
    sourceInstanceId: string | null;
    targetIds: string[];
  },
) {
  const events: MatchEvent[] = [];

  for (const effect of input.effects) {
    if (effect.kind === "drawCards") {
      const targetSeatId =
        effect.target === "controller"
          ? input.controllerSeat
          : getOtherSeatId(state, input.controllerSeat);
      if (targetSeatId) {
        drawCards(state.seats[targetSeatId], effect.amount);
      }
      continue;
    }

    if (effect.kind === "adjustResource") {
      const targetSeatId =
        effect.target === "controller"
          ? input.controllerSeat
          : getOtherSeatId(state, input.controllerSeat);
      if (targetSeatId) {
        const resource = ensureResource(
          state.seats[targetSeatId],
          effect.resourceId,
          effect.resourceId === "mana" ? "Mana" : effect.resourceId,
        );
        resource.current += effect.amount;
        if (resource.maximum !== null) {
          resource.maximum = Math.max(resource.maximum ?? 0, resource.current);
        }
      }
      continue;
    }

    if (effect.kind === "dealDamage") {
      const targetSeatId =
        effect.target === "opponent"
          ? getOtherSeatId(state, input.controllerSeat)
          : null;
      if (targetSeatId) {
        const seat = state.seats[targetSeatId];
        const previousLifeTotal = seat.lifeTotal;
        seat.lifeTotal -= effect.amount;
        events.push(
          createEvent("lifeTotalChanged", {
            from: previousLifeTotal,
            reason: "stackEffect",
            seat: targetSeatId,
            to: seat.lifeTotal,
          }),
        );
        events.push(...applyLifeTotalCheck(state, createEvent));
      }
      continue;
    }

    if (effect.kind === "destroy") {
      const targetIds =
        effect.target === "self"
          ? input.sourceInstanceId
            ? [input.sourceInstanceId]
            : []
          : input.targetIds;

      for (const targetId of targetIds) {
        events.push(
          ...moveBattlefieldCard(state, createEvent, {
            instanceId: targetId,
            publicReason: "destroyed",
            toZone: getDestroyDestination(state, targetId),
          }),
        );
      }
      continue;
    }

    if (effect.kind === "grantKeyword" || effect.kind === "modifyStats") {
      const targetIds =
        effect.target === "self"
          ? input.sourceInstanceId
            ? [input.sourceInstanceId]
            : []
          : input.targetIds;

      if (targetIds.length === 0) {
        continue;
      }

      state.continuousEffects.push({
        controllerSeat: input.controllerSeat,
        effect,
        expiresAtTurn:
          effect.until === "endOfTurn" ? state.shell.turnNumber : null,
        sourceInstanceId: input.sourceInstanceId,
        targetIds: [...targetIds],
      });
      continue;
    }

    if (effect.kind === "setAutoPass") {
      state.seats[input.controllerSeat].autoPassEnabled = effect.value;
    }
  }

  return events;
}

function enqueueSelfEntersBattlefieldTriggers(
  state: MatchState,
  createEvent: ReturnType<typeof createEventFactory>,
  input: {
    controllerSeat: SeatId;
    sourceInstanceId: string;
  },
) {
  const cardEntry = getCardCatalogEntry(state, input.sourceInstanceId);
  if (!cardEntry) {
    return [] as MatchEvent[];
  }

  const triggeredAbilities = cardEntry.abilities.filter(
    (
      ability,
    ): ability is Extract<
      (typeof cardEntry.abilities)[number],
      { kind: "triggered" }
    > => {
      return (
        isTriggeredAbility(ability) &&
        ability.trigger.kind === "event" &&
        ability.trigger.event === "selfEntersBattlefield" &&
        !ability.condition &&
        !hasUnsupportedEffects(ability.effect)
      );
    },
  );

  if (triggeredAbilities.length === 0) {
    return [] as MatchEvent[];
  }

  const createdObjects = triggeredAbilities.map((ability) =>
    createStackObject(state, {
      abilityId: ability.id,
      cardId: cardEntry.cardId,
      controllerSeat: input.controllerSeat,
      destinationZone: null,
      effects: ability.effect,
      kind: "triggeredAbility",
      label: `${cardEntry.name}: ${ability.text}`,
      originZone: "battlefield",
      sourceInstanceId: input.sourceInstanceId,
      targetIds: [],
    }),
  );

  state.shell.prioritySeat = state.shell.activeSeat;
  state.lastPriorityPassSeat = null;
  return createStackObjectCreatedEvents(createEvent, createdObjects);
}

function resolveTopOfStack(
  state: MatchState,
  createEvent: ReturnType<typeof createEventFactory>,
) {
  const stackObject = state.stack.pop();
  if (!stackObject) {
    return [] as MatchEvent[];
  }

  const events: MatchEvent[] = [
    createEvent("stackObjectResolved", {
      resolution: "resolved",
      stackId: stackObject.stackId,
    }),
  ];

  if (
    stackObject.kind === "castCard" &&
    stackObject.sourceInstanceId &&
    stackObject.destinationZone
  ) {
    const destinationZone = getZoneReference(
      state.seats[stackObject.controllerSeat],
      stackObject.destinationZone,
    );
    if (destinationZone) {
      destinationZone.push(stackObject.sourceInstanceId);
      if (stackObject.destinationZone === "battlefield") {
        state.battlefieldEntryTurns[stackObject.sourceInstanceId] =
          state.shell.turnNumber;
      }
      events.push(
        createEvent("cardMoved", {
          cardInstanceId: stackObject.sourceInstanceId,
          fromZone: stackObject.originZone ?? "hand",
          publicReason: "resolved",
          toZone: stackObject.destinationZone,
        }),
      );
      if (stackObject.destinationZone === "battlefield") {
        events.push(
          ...enqueueSelfEntersBattlefieldTriggers(state, createEvent, {
            controllerSeat: stackObject.controllerSeat,
            sourceInstanceId: stackObject.sourceInstanceId,
          }),
        );
      }
    }
  }

  if (stackObject.effects.length > 0) {
    events.push(
      ...applyEffectSequence(state, createEvent, {
        controllerSeat: stackObject.controllerSeat,
        effects: stackObject.effects,
        sourceInstanceId: stackObject.sourceInstanceId,
        targetIds: stackObject.targetIds,
      }),
    );
  }

  events.push(...applyStateBasedActions(state, createEvent));

  state.shell.prioritySeat = state.shell.activeSeat;
  state.lastPriorityPassSeat = null;
  return events;
}

function resolveCombatDamage(
  state: MatchState,
  createEvent: ReturnType<typeof createEventFactory>,
  assignments: CombatAssignment[],
) {
  const events: MatchEvent[] = [
    createEvent("combatDamageAssigned", {
      assignments,
    }),
  ];
  const derived = deriveBattlefieldCardStates(state);
  const cardDamage = new Map<string, number>();
  const seatDamage = new Map<SeatId, number>();

  for (const assignment of assignments) {
    if (assignment.targetId in state.seats) {
      const seatId = assignment.targetId as SeatId;
      seatDamage.set(seatId, (seatDamage.get(seatId) ?? 0) + assignment.amount);
      continue;
    }

    cardDamage.set(
      assignment.targetId,
      (cardDamage.get(assignment.targetId) ?? 0) + assignment.amount,
    );
  }

  for (const [seatId, amount] of seatDamage) {
    const seat = state.seats[seatId];
    if (!seat || amount <= 0) {
      continue;
    }

    const previousLifeTotal = seat.lifeTotal;
    seat.lifeTotal -= amount;
    events.push(
      createEvent("lifeTotalChanged", {
        from: previousLifeTotal,
        reason: "combat",
        seat: seatId,
        to: seat.lifeTotal,
      }),
    );
  }

  for (const [targetId, amount] of cardDamage) {
    const targetState = derived[targetId];
    if (
      !targetState ||
      amount < (targetState.toughness ?? Number.POSITIVE_INFINITY)
    ) {
      continue;
    }

    events.push(
      ...moveBattlefieldCard(state, createEvent, {
        instanceId: targetId,
        publicReason: "combatDamage",
        toZone: getDestroyDestination(state, targetId),
      }),
    );
  }

  events.push(...applyStateBasedActions(state, createEvent));
  events.push(...applyLifeTotalCheck(state, createEvent));
  clearCombat(state);
  const previousPhase = state.shell.phase;
  state.shell.phase = "main2";
  state.shell.prioritySeat = state.shell.activeSeat;
  state.lastPriorityPassSeat = null;
  events.push(
    createEvent("phaseAdvanced", {
      from: previousPhase,
      to: state.shell.phase,
    }),
  );
  return events;
}

function finalizeState(
  state: MatchState,
  events: MatchEvent[],
): MatchTransition {
  if (events.length === 0) {
    return {
      events,
      nextState: state,
      outcome: "noop",
    };
  }
  state.eventSequence += events.length;
  state.shell = createMatchShellFromState(state);
  return {
    events,
    nextState: state,
    outcome: "applied",
  };
}

function cloneState(state: MatchState): MatchState {
  return {
    battlefieldEntryTurns: { ...(state.battlefieldEntryTurns ?? {}) },
    cardCatalog: cloneCardCatalog(state.cardCatalog),
    combat: {
      attackers: sortCombatAttackers(state.combat?.attackers ?? []),
      blocks: sortCombatBlocks(state.combat?.blocks ?? []),
    },
    continuousEffects: (state.continuousEffects ?? []).map((effect) => ({
      ...effect,
      targetIds: [...(effect.targetIds ?? [])],
    })),
    eventSequence: state.eventSequence,
    lastPriorityPassSeat: state.lastPriorityPassSeat,
    prompts: (state.prompts ?? []).map((prompt) => ({
      ...prompt,
      choiceIds: [...(prompt.choiceIds ?? [])],
      resolvedChoiceIds: [...(prompt.resolvedChoiceIds ?? [])],
    })),
    random: { ...state.random },
    seats: Object.fromEntries(
      Object.entries(state.seats).map(([seat, seatState]) => [
        seat,
        {
          ...seatState,
          battlefield: [...seatState.battlefield],
          command: [...seatState.command],
          deck: [...seatState.deck],
          exile: [...seatState.exile],
          graveyard: [...seatState.graveyard],
          hand: [...seatState.hand],
          objective: [...seatState.objective],
          resources: seatState.resources.map((resource) => ({ ...resource })),
          sideboard: [...seatState.sideboard],
        },
      ]),
    ) as MatchState["seats"],
    shell: {
      ...state.shell,
      format: {
        ...state.shell.format,
        deckRules: { ...state.shell.format.deckRules },
      },
      seats: state.shell.seats.map((seat) => ({ ...seat })),
      timers: {
        ...state.shell.timers,
        seatTimeRemainingMs: { ...state.shell.timers.seatTimeRemainingMs },
      },
    },
    stack: (state.stack ?? []).map((item) => ({
      ...item,
      targetIds: [...(item.targetIds ?? [])],
    })),
  };
}

export function reduceGameplayIntent(
  state: MatchState,
  intent: GameplayIntent,
): MatchTransition {
  if (intent.matchId !== state.shell.id) {
    return {
      events: [],
      nextState: state,
      outcome: "rejected",
      reason: "invalidMatch",
    };
  }
  if (!(intent.seat in state.seats)) {
    return {
      events: [],
      nextState: state,
      outcome: "rejected",
      reason: "invalidSeat",
    };
  }
  if (state.shell.status === "complete" || state.shell.status === "cancelled") {
    return {
      events: [],
      nextState: state,
      outcome: "rejected",
      reason: "matchComplete",
    };
  }
  if (intent.stateVersion !== state.shell.version) {
    return {
      events: [],
      nextState: state,
      outcome: "rejected",
      reason: "staleStateVersion",
    };
  }

  const nextState = cloneState(state);
  const nextSeat = nextState.seats[intent.seat];
  const createEvent = createEventFactory(state);

  if (intent.kind === "toggleAutoPass") {
    nextSeat.autoPassEnabled = intent.payload.enabled;
    nextState.shell.version += 1;
    const event = createEvent("autoPassToggled", {
      enabled: intent.payload.enabled,
      seat: intent.seat,
    });
    return finalizeState(nextState, [event]);
  }

  if (intent.kind === "concede") {
    nextSeat.status = "conceded";
    nextState.shell.completedAt = nextState.shell.createdAt;
    nextState.shell.status = "complete";
    nextState.shell.version += 1;
    nextState.shell.winnerSeat = getOtherSeatId(nextState, intent.seat);
    const events: MatchEvent[] = [
      createEvent("playerConceded", {
        reason: intent.payload.reason,
        seat: intent.seat,
      }),
      createEvent("matchCompleted", {
        reason: "concession",
        winnerSeat: nextState.shell.winnerSeat,
      }),
    ];
    return finalizeState(nextState, events);
  }

  if (intent.kind === "keepOpeningHand") {
    const prompt = getPendingPrompt(nextState, intent.seat, "mulligan");
    if (!prompt) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPrompt",
      };
    }

    prompt.status = "resolved";
    prompt.resolvedChoiceIds = ["keep"];
    nextState.shell.version += 1;
    const events: MatchEvent[] = [
      createEvent("openingHandKept", {
        seat: intent.seat,
      }),
      createEvent("promptResolved", {
        choiceIds: ["keep"],
        promptId: prompt.promptId,
        seat: intent.seat,
      }),
    ];

    const remainingPrompt = nextState.prompts.some(
      (matchPrompt) =>
        matchPrompt.kind === "mulligan" && matchPrompt.status === "pending",
    );
    if (!remainingPrompt) {
      const previousPhase = nextState.shell.phase;
      nextState.shell.phase = "main1";
      nextState.shell.prioritySeat = nextState.shell.activeSeat;
      nextState.lastPriorityPassSeat = null;
      resetTurnResources(nextState);
      events.push(
        createEvent("phaseAdvanced", {
          from: previousPhase,
          to: nextState.shell.phase,
        }),
      );
    }

    return finalizeState(nextState, events);
  }

  if (intent.kind === "takeMulligan") {
    const prompt = getPendingPrompt(nextState, intent.seat, "mulligan");
    if (!prompt) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPrompt",
      };
    }

    const nextHandSize =
      intent.payload.targetHandSize ?? Math.max(0, nextSeat.hand.length - 1);

    nextSeat.deck.push(...nextSeat.hand);
    nextSeat.hand = [];
    const [shuffledDeck, nextRandom] = shuffleInstances(
      nextSeat.deck,
      nextState.random,
    );
    nextState.random = nextRandom;
    nextSeat.deck = shuffledDeck;
    drawCards(nextSeat, nextHandSize);
    nextSeat.mulligansTaken += 1;
    prompt.message = `Choose whether to keep ${nextHandSize} cards or take another mulligan.`;
    prompt.choiceIds = ["keep", `mulligan:${Math.max(0, nextHandSize - 1)}`];
    prompt.resolvedChoiceIds = [];
    nextState.shell.version += 1;
    const event = createEvent("mulliganTaken", {
      handSize: nextHandSize,
      seat: intent.seat,
    });
    return finalizeState(nextState, [event]);
  }

  if (intent.kind === "declareAttackers") {
    if (nextState.shell.phase !== "attack") {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPhase",
      };
    }
    if (nextState.shell.prioritySeat !== intent.seat) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "notPriorityOwner",
      };
    }
    if (nextState.shell.activeSeat !== intent.seat) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidSeat",
      };
    }

    const defendingSeat = getOtherSeatId(nextState, intent.seat);
    if (!defendingSeat) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidSeat",
      };
    }

    const normalizedAttackers = sortCombatAttackers(intent.payload.attackers);
    if (
      new Set(normalizedAttackers.map((attacker) => attacker.attackerId))
        .size !== normalizedAttackers.length
    ) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "unsupportedIntent",
      };
    }

    if (
      normalizedAttackers.some(
        (attacker) =>
          attacker.defenderSeat !== defendingSeat ||
          !nextSeat.battlefield.includes(attacker.attackerId) ||
          !canAttack(nextState, intent.seat, attacker.attackerId),
      )
    ) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "cardNotInZone",
      };
    }

    nextState.combat.attackers = normalizedAttackers;
    nextState.combat.blocks = [];
    nextState.lastPriorityPassSeat = null;
    nextState.shell.version += 1;

    const nextPhase = normalizedAttackers.length === 0 ? "main2" : "block";
    nextState.shell.phase = nextPhase;
    nextState.shell.prioritySeat =
      nextPhase === "block" ? defendingSeat : nextState.shell.activeSeat;

    return finalizeState(nextState, [
      createEvent("attackersDeclared", {
        attackers: normalizedAttackers,
        seat: intent.seat,
      }),
      createEvent("phaseAdvanced", {
        from: "attack",
        to: nextPhase,
      }),
    ]);
  }

  if (intent.kind === "declareBlockers") {
    if (nextState.shell.phase !== "block") {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPhase",
      };
    }
    if (nextState.shell.prioritySeat !== intent.seat) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "notPriorityOwner",
      };
    }
    if (nextState.shell.activeSeat === intent.seat) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidSeat",
      };
    }
    if (nextState.combat.attackers.length === 0) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPhase",
      };
    }

    const normalizedBlocks = sortCombatBlocks(intent.payload.blocks);
    if (
      new Set(normalizedBlocks.map((block) => block.blockerId)).size !==
        normalizedBlocks.length ||
      new Set(normalizedBlocks.map((block) => block.attackerId)).size !==
        normalizedBlocks.length
    ) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "unsupportedIntent",
      };
    }

    const attackerIds = new Set(
      nextState.combat.attackers.map((attacker) => attacker.attackerId),
    );
    if (
      normalizedBlocks.some(
        (block) =>
          !attackerIds.has(block.attackerId) ||
          !nextSeat.battlefield.includes(block.blockerId) ||
          !canBlock(nextState, intent.seat, block.blockerId, block.attackerId),
      )
    ) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "cardNotInZone",
      };
    }

    nextState.combat.blocks = normalizedBlocks;
    nextState.lastPriorityPassSeat = null;
    nextState.shell.phase = "damage";
    nextState.shell.prioritySeat = nextState.shell.activeSeat;
    nextState.shell.version += 1;

    return finalizeState(nextState, [
      createEvent("blockersDeclared", {
        blocks: normalizedBlocks,
        seat: intent.seat,
      }),
      createEvent("phaseAdvanced", {
        from: "block",
        to: "damage",
      }),
    ]);
  }

  if (intent.kind === "assignCombatDamage") {
    if (nextState.shell.phase !== "damage") {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPhase",
      };
    }
    if (nextState.shell.prioritySeat !== intent.seat) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "notPriorityOwner",
      };
    }
    if (nextState.shell.activeSeat !== intent.seat) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidSeat",
      };
    }
    if (nextState.combat.attackers.length === 0) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPhase",
      };
    }

    const expectedAssignments = buildDefaultCombatAssignments(nextState);
    const submittedAssignments = sortCombatAssignments(
      intent.payload.assignments,
    );
    if (
      JSON.stringify(submittedAssignments) !==
      JSON.stringify(expectedAssignments)
    ) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "unsupportedIntent",
      };
    }

    nextState.shell.version += 1;
    return finalizeState(
      nextState,
      resolveCombatDamage(nextState, createEvent, expectedAssignments),
    );
  }

  if (intent.kind === "choosePromptOptions") {
    const prompt = resolvePrompt(
      nextState,
      intent.seat,
      "choice",
      intent.payload.choiceIds,
    );
    if (!prompt) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPrompt",
      };
    }

    nextState.shell.version += 1;
    return finalizeState(nextState, [
      createEvent("promptResolved", {
        choiceIds: [...prompt.resolvedChoiceIds],
        promptId: prompt.promptId,
        seat: intent.seat,
      }),
    ]);
  }

  if (intent.kind === "chooseTargets") {
    const prompt = resolvePrompt(
      nextState,
      intent.seat,
      "targets",
      intent.payload.targetIds,
    );
    if (!prompt) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPrompt",
      };
    }

    nextState.shell.version += 1;
    return finalizeState(nextState, [
      createEvent("promptResolved", {
        choiceIds: [...prompt.resolvedChoiceIds],
        promptId: prompt.promptId,
        seat: intent.seat,
      }),
    ]);
  }

  if (intent.kind === "chooseModes") {
    const prompt = resolvePrompt(
      nextState,
      intent.seat,
      "modes",
      intent.payload.modeIds,
    );
    if (!prompt) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPrompt",
      };
    }

    nextState.shell.version += 1;
    return finalizeState(nextState, [
      createEvent("promptResolved", {
        choiceIds: [...prompt.resolvedChoiceIds],
        promptId: prompt.promptId,
        seat: intent.seat,
      }),
    ]);
  }

  if (intent.kind === "chooseCosts") {
    const prompt = resolvePrompt(
      nextState,
      intent.seat,
      "costs",
      intent.payload.costIds,
    );
    if (!prompt) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPrompt",
      };
    }

    nextState.shell.version += 1;
    return finalizeState(nextState, [
      createEvent("promptResolved", {
        choiceIds: [...prompt.resolvedChoiceIds],
        promptId: prompt.promptId,
        seat: intent.seat,
      }),
    ]);
  }

  if (intent.kind === "playCard") {
    if (!MAIN_PHASES.has(nextState.shell.phase)) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPhase",
      };
    }
    if (nextState.shell.prioritySeat !== intent.seat) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "notPriorityOwner",
      };
    }
    if (intent.payload.sourceZone !== "hand") {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidZone",
      };
    }

    const sourceZone = getZoneReference(nextSeat, intent.payload.sourceZone);
    if (!sourceZone) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidZone",
      };
    }

    const cardIndex = sourceZone.indexOf(intent.payload.cardInstanceId);
    if (cardIndex === -1) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "cardNotInZone",
      };
    }

    const cardId = getCardIdFromInstanceId(intent.payload.cardInstanceId);
    const catalogEntry = nextState.cardCatalog[cardId];
    if (!catalogEntry) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "cardNotFound",
      };
    }

    const manaResource =
      nextSeat.resources.find((resource) => resource.resourceId === "mana") ??
      null;
    if (!manaResource || manaResource.current < catalogEntry.cost) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "insufficientResources",
      };
    }

    sourceZone.splice(cardIndex, 1);
    const destinationKind: ZoneKind =
      catalogEntry.kind === "spell" ? "graveyard" : "battlefield";
    manaResource.current -= catalogEntry.cost;
    nextState.lastPriorityPassSeat = null;
    nextState.shell.prioritySeat = getOtherSeatId(nextState, intent.seat);
    const stackObject = createStackObject(nextState, {
      abilityId: null,
      cardId: catalogEntry.cardId,
      controllerSeat: intent.seat,
      destinationZone: destinationKind,
      effects: [],
      kind: "castCard",
      label: catalogEntry.name,
      originZone: intent.payload.sourceZone,
      sourceInstanceId: intent.payload.cardInstanceId,
    });
    nextState.shell.version += 1;

    const events: MatchEvent[] = [
      createEvent("cardPlayed", {
        cardInstanceId: intent.payload.cardInstanceId,
        seat: intent.seat,
        toZone: destinationKind,
      }),
      createEvent("stackObjectCreated", {
        controllerSeat: intent.seat,
        label: stackObject.label,
        stackId: stackObject.stackId,
      }),
    ];
    return finalizeState(nextState, events);
  }

  if (intent.kind === "activateAbility") {
    if (nextState.shell.prioritySeat !== intent.seat) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "notPriorityOwner",
      };
    }

    const sourceCard = getCardCatalogEntry(
      nextState,
      intent.payload.sourceInstanceId,
    );
    if (!sourceCard) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "cardNotFound",
      };
    }

    if (!nextSeat.battlefield.includes(intent.payload.sourceInstanceId)) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "cardNotInZone",
      };
    }

    const cardAbility = sourceCard.abilities.find(
      (ability) => ability.id === intent.payload.abilityId,
    );
    if (!cardAbility || !isActivatedAbility(cardAbility)) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "abilityNotFound",
      };
    }
    const ability = cardAbility;
    const targetIds = [...(intent.payload.targetIds ?? [])];
    if (hasUnsupportedEffects(ability.effect)) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "unsupportedTargeting",
      };
    }
    if (ability.costs.some((cost) => cost.kind !== "resource")) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "unsupportedCost",
      };
    }
    const resourceCosts = ability.costs.filter(
      (
        cost,
      ): cost is Extract<
        (typeof ability.costs)[number],
        { kind: "resource" }
      > => cost.kind === "resource",
    );
    if (
      ability.speed === "slow" &&
      (!MAIN_PHASES.has(nextState.shell.phase) || nextState.stack.length > 0)
    ) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "invalidPhase",
      };
    }

    if (
      !hasValidAbilityTargets({
        ability,
        controllerSeat: intent.seat,
        sourceInstanceId: intent.payload.sourceInstanceId,
        state: nextState,
        targetIds,
      })
    ) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "unsupportedTargeting",
      };
    }

    for (const cost of resourceCosts) {
      const resource = ensureResource(nextSeat, cost.resourceId);
      if (resource.current < cost.amount) {
        return {
          events: [],
          nextState: state,
          outcome: "rejected",
          reason: "insufficientResources",
        };
      }
    }

    for (const cost of resourceCosts) {
      const resource = ensureResource(nextSeat, cost.resourceId);
      resource.current -= cost.amount;
    }

    const stackObject = createStackObject(nextState, {
      abilityId: ability.id,
      cardId: sourceCard.cardId,
      controllerSeat: intent.seat,
      destinationZone: null,
      effects: ability.effect,
      kind: "activatedAbility",
      label: `${sourceCard.name}: ${ability.text}`,
      originZone: "battlefield",
      sourceInstanceId: intent.payload.sourceInstanceId,
      targetIds,
    });

    nextState.lastPriorityPassSeat = null;
    nextState.shell.prioritySeat = getOtherSeatId(nextState, intent.seat);
    nextState.shell.version += 1;

    return finalizeState(nextState, [
      createEvent("abilityActivated", {
        abilityId: ability.id,
        seat: intent.seat,
        sourceInstanceId: intent.payload.sourceInstanceId,
        targetIds: targetIds.length > 0 ? targetIds : undefined,
      }),
      createEvent("stackObjectCreated", {
        controllerSeat: intent.seat,
        label: stackObject.label,
        stackId: stackObject.stackId,
      }),
    ]);
  }

  if (intent.kind === "passPriority") {
    if (nextState.shell.prioritySeat !== intent.seat) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "notPriorityOwner",
      };
    }

    const otherSeat = getOtherSeatId(nextState, intent.seat);
    nextState.shell.version += 1;
    const events: MatchEvent[] = [
      createEvent("priorityPassed", {
        seat: intent.seat,
      }),
    ];

    if (otherSeat && nextState.lastPriorityPassSeat === otherSeat) {
      if (nextState.stack.length > 0) {
        events.push(...resolveTopOfStack(nextState, createEvent));
      } else if (
        nextState.shell.phase === "damage" &&
        nextState.combat.attackers.length > 0
      ) {
        events.push(
          ...resolveCombatDamage(
            nextState,
            createEvent,
            buildDefaultCombatAssignments(nextState),
          ),
        );
      } else if (
        (nextState.shell.phase === "attack" ||
          nextState.shell.phase === "block" ||
          nextState.shell.phase === "damage") &&
        nextState.combat.attackers.length === 0
      ) {
        const previousPhase = nextState.shell.phase;
        nextState.shell.phase = "main2";
        nextState.shell.prioritySeat = nextState.shell.activeSeat;
        nextState.lastPriorityPassSeat = null;
        events.push(
          createEvent("phaseAdvanced", {
            from: previousPhase,
            to: nextState.shell.phase,
          }),
        );
      } else {
        const previousPhase = nextState.shell.phase;
        advancePhase(nextState);
        events.push(
          createEvent("phaseAdvanced", {
            from: previousPhase,
            to: nextState.shell.phase,
          }),
        );
        if (previousPhase === "cleanup") {
          events.push(
            createEvent("turnAdvanced", {
              activeSeat: nextState.shell.activeSeat ?? intent.seat,
              turnNumber: nextState.shell.turnNumber,
            }),
          );
          events.push(...applyTurnStartDraw(nextState, createEvent));
        }
      }
    } else {
      nextState.lastPriorityPassSeat = intent.seat;
      nextState.shell.prioritySeat = otherSeat;
    }

    return finalizeState(nextState, events);
  }

  return {
    events: [],
    nextState: state,
    outcome: "rejected",
    reason: "unsupportedIntent",
  };
}
