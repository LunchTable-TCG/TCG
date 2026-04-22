import type {
  GameplayIntentKind,
  MatchCardView,
  MatchCombatView,
  MatchEvent,
  MatchEventSummary,
  MatchPromptView,
  MatchSeatView,
  MatchSpectatorView,
  MatchStackItemView,
  MatchZoneView,
  SeatId,
  SeatStateView,
  ZoneKind,
} from "@lunchtable/shared-types";

import { deriveBattlefieldCardStates } from "./state";
import type { MatchState } from "./state";

const PRIVATE_ZONE_KINDS = new Set<ZoneKind>(["deck", "hand", "sideboard"]);
const PUBLIC_ZONE_KINDS = [
  "battlefield",
  "graveyard",
  "command",
  "objective",
  "laneReserve",
] as const satisfies ZoneKind[];
const ZONE_ORDER = [
  "deck",
  "hand",
  "battlefield",
  "graveyard",
  "exile",
  "command",
  "objective",
  "sideboard",
  "laneReserve",
] as const satisfies ZoneKind[];

function isPublicZoneKind(
  zone: ZoneKind,
): zone is (typeof PUBLIC_ZONE_KINDS)[number] {
  return PUBLIC_ZONE_KINDS.includes(zone as (typeof PUBLIC_ZONE_KINDS)[number]);
}

function cardIdFromInstanceId(instanceId: string): string {
  const [, cardId] = instanceId.split(":");
  return cardId ?? instanceId;
}

function createCardView(
  state: MatchState,
  seat: SeatId,
  zone: ZoneKind,
  instanceId: string,
  visibility: MatchCardView["visibility"],
): MatchCardView {
  const cardId = cardIdFromInstanceId(instanceId);
  const card = state.cardCatalog[cardId];
  const derivedState =
    zone === "battlefield"
      ? deriveBattlefieldCardStates(state)[instanceId]
      : null;
  const annotations = [...(derivedState?.annotations ?? [])];
  if (
    zone === "battlefield" &&
    state.battlefieldEntryTurns[instanceId] === state.shell.turnNumber &&
    !derivedState?.permissions.includes("ignoreSummoningSickness")
  ) {
    annotations.push("summoningSick");
  }
  return {
    annotations,
    cardId,
    controllerSeat: seat,
    counters: {},
    instanceId,
    isTapped: false,
    keywords: [...(derivedState?.keywords ?? card?.keywords ?? [])],
    name: card?.name ?? cardId,
    ownerSeat: seat,
    permissions: [...(derivedState?.permissions ?? [])],
    slotId: null,
    statLine: derivedState
      ? {
          power: derivedState.power,
          toughness: derivedState.toughness,
        }
      : card?.stats
        ? {
            power: card.stats.power,
            toughness: card.stats.toughness,
          }
        : null,
    visibility,
    zone,
  };
}

function createZoneView(input: {
  instances: string[];
  ownerSeat: SeatId;
  revealCards: boolean;
  state: MatchState;
  zone: ZoneKind;
}): MatchZoneView {
  const visibility = input.revealCards ? "private-self" : "hidden";
  return {
    cards: input.revealCards
      ? input.instances.map((instanceId) =>
          createCardView(
            input.state,
            input.ownerSeat,
            input.zone,
            instanceId,
            visibility,
          ),
        )
      : [],
    cardCount: input.instances.length,
    ownerSeat: input.ownerSeat,
    visibility,
    zone: input.zone,
  };
}

function createPublicZoneView(
  state: MatchState,
  seat: SeatId,
  zone: ZoneKind,
  instances: string[],
): MatchZoneView {
  return {
    cards: instances.map((instanceId) =>
      createCardView(state, seat, zone, instanceId, "public"),
    ),
    cardCount: instances.length,
    ownerSeat: seat,
    visibility: "public",
    zone,
  };
}

function createSeatStateView(
  state: MatchState,
  seat: MatchState["seats"][SeatId],
): SeatStateView {
  return {
    actorType: seat.actorType,
    autoPassEnabled: seat.autoPassEnabled,
    deckCount: seat.deck.length,
    graveyardCount: seat.graveyard.length,
    handCount: seat.hand.length,
    hasPriority: state.shell.prioritySeat === seat.seat,
    isActiveTurn: state.shell.activeSeat === seat.seat,
    lifeTotal: seat.lifeTotal,
    resources: seat.resources.map((resource) => ({ ...resource })),
    seat: seat.seat,
    status: seat.status,
    username: seat.username,
  };
}

function getCardNameFromInstanceId(
  state: MatchState,
  instanceId: string | null,
): string | null {
  if (!instanceId) {
    return null;
  }

  const cardId = cardIdFromInstanceId(instanceId);
  return state.cardCatalog[cardId]?.name ?? cardId;
}

function getCardIdFromEventInstanceId(
  instanceId: string | null,
): string | null {
  if (!instanceId) {
    return null;
  }

  return cardIdFromInstanceId(instanceId);
}

function createRecentEventSummary(
  state: MatchState,
  event: MatchEvent,
): MatchEventSummary {
  if (event.kind === "matchCreated") {
    return {
      kind: event.kind,
      label: "Match created",
      seat: null,
      sequence: event.sequence,
    };
  }

  if (event.kind === "autoPassToggled") {
    return {
      kind: event.kind,
      label: event.payload.enabled ? "Auto-pass enabled" : "Auto-pass disabled",
      seat: event.payload.seat,
      sequence: event.sequence,
    };
  }

  if (event.kind === "playerConceded") {
    return {
      kind: event.kind,
      label: `Conceded (${event.payload.reason})`,
      seat: event.payload.seat,
      sequence: event.sequence,
    };
  }

  if (event.kind === "openingHandKept") {
    return {
      kind: event.kind,
      label: "Kept opening hand",
      seat: event.payload.seat,
      sequence: event.sequence,
    };
  }

  if (event.kind === "mulliganTaken") {
    return {
      kind: event.kind,
      label: `Took mulligan to ${event.payload.handSize}`,
      seat: event.payload.seat,
      sequence: event.sequence,
    };
  }

  if (event.kind === "cardPlayed") {
    const cardName = getCardNameFromInstanceId(
      state,
      event.payload.cardInstanceId,
    );

    return {
      cardId:
        getCardIdFromEventInstanceId(event.payload.cardInstanceId) ?? undefined,
      cardName: cardName ?? undefined,
      focusInstanceId: event.payload.cardInstanceId,
      kind: event.kind,
      label: cardName ? `Played ${cardName}` : "Played a card",
      seat: event.payload.seat,
      sequence: event.sequence,
      toZone: event.payload.toZone,
    };
  }

  if (event.kind === "cardsDrawn") {
    return {
      kind: event.kind,
      label:
        event.payload.count === 1
          ? "Drew 1 card"
          : `Drew ${event.payload.count} cards`,
      seat: event.payload.seat,
      sequence: event.sequence,
    };
  }

  if (event.kind === "priorityPassed") {
    return {
      kind: event.kind,
      label: "Passed priority",
      seat: event.payload.seat,
      sequence: event.sequence,
    };
  }

  if (event.kind === "phaseAdvanced") {
    return {
      kind: event.kind,
      label: `Phase: ${event.payload.from} -> ${event.payload.to}`,
      seat: null,
      sequence: event.sequence,
    };
  }

  if (event.kind === "abilityActivated") {
    const cardName = getCardNameFromInstanceId(
      state,
      event.payload.sourceInstanceId,
    );
    const targetLabel =
      event.payload.targetIds && event.payload.targetIds.length > 0
        ? ` targeting ${event.payload.targetIds
            .map(
              (targetId) =>
                getCardNameFromInstanceId(state, targetId) ?? targetId,
            )
            .join(", ")}`
        : "";

    return {
      abilityId: event.payload.abilityId,
      cardId:
        getCardIdFromEventInstanceId(event.payload.sourceInstanceId) ??
        undefined,
      cardName: cardName ?? undefined,
      focusInstanceId: event.payload.sourceInstanceId,
      kind: event.kind,
      label: cardName
        ? `${cardName} activated ${event.payload.abilityId}${targetLabel}`
        : `Activated ${event.payload.abilityId}`,
      seat: event.payload.seat,
      sequence: event.sequence,
    };
  }

  if (event.kind === "attackersDeclared") {
    return {
      kind: event.kind,
      label:
        event.payload.attackers.length === 0
          ? "Skipped attacks"
          : `Declared ${event.payload.attackers.length} attacker${event.payload.attackers.length === 1 ? "" : "s"}`,
      seat: event.payload.seat,
      sequence: event.sequence,
    };
  }

  if (event.kind === "blockersDeclared") {
    return {
      kind: event.kind,
      label:
        event.payload.blocks.length === 0
          ? "Declared no blocks"
          : `Declared ${event.payload.blocks.length} block${event.payload.blocks.length === 1 ? "" : "s"}`,
      seat: event.payload.seat,
      sequence: event.sequence,
    };
  }

  if (event.kind === "combatDamageAssigned") {
    return {
      kind: event.kind,
      label:
        event.payload.assignments.length === 0
          ? "Combat damage skipped"
          : `Combat damage assigned (${event.payload.assignments.length})`,
      seat: null,
      sequence: event.sequence,
    };
  }

  if (event.kind === "stackObjectCreated") {
    return {
      kind: event.kind,
      label: `Stack: ${event.payload.label}`,
      seat: event.payload.controllerSeat,
      sequence: event.sequence,
    };
  }

  if (event.kind === "stackObjectResolved") {
    return {
      kind: event.kind,
      label: `Resolved ${event.payload.stackId}`,
      seat: null,
      sequence: event.sequence,
    };
  }

  if (event.kind === "lifeTotalChanged") {
    return {
      kind: event.kind,
      label: `Life ${event.payload.from} -> ${event.payload.to}`,
      seat: event.payload.seat,
      sequence: event.sequence,
    };
  }

  return {
    kind: event.kind,
    label: event.kind,
    seat:
      "seat" in event.payload && typeof event.payload.seat === "string"
        ? event.payload.seat
        : null,
    sequence: event.sequence,
  };
}

function getZoneInstances(state: MatchState["seats"][SeatId], zone: ZoneKind) {
  switch (zone) {
    case "battlefield":
      return state.battlefield;
    case "command":
      return state.command;
    case "deck":
      return state.deck;
    case "exile":
      return state.exile;
    case "graveyard":
      return state.graveyard;
    case "hand":
      return state.hand;
    case "laneReserve":
      return [];
    case "objective":
      return state.objective;
    case "sideboard":
      return state.sideboard;
    default:
      return [];
  }
}

function createZoneViews(
  state: MatchState,
  viewerSeat: SeatId | null,
): MatchZoneView[] {
  const zones: MatchZoneView[] = [];

  for (const seat of Object.values(state.seats)) {
    for (const zone of ZONE_ORDER) {
      if (PRIVATE_ZONE_KINDS.has(zone)) {
        zones.push(
          createZoneView({
            instances: getZoneInstances(seat, zone),
            ownerSeat: seat.seat,
            revealCards: viewerSeat === seat.seat,
            state,
            zone,
          }),
        );
        continue;
      }

      if (isPublicZoneKind(zone)) {
        zones.push(
          createPublicZoneView(
            state,
            seat.seat,
            zone,
            getZoneInstances(seat, zone),
          ),
        );
        continue;
      }

      if (zone === "exile") {
        zones.push(createPublicZoneView(state, seat.seat, zone, seat.exile));
      }
    }
  }

  return zones;
}

function createStackViews(state: MatchState): MatchStackItemView[] {
  return state.stack.map((item) => ({
    controllerSeat: item.controllerSeat,
    label: item.label,
    sourceInstanceId: item.sourceInstanceId,
    stackId: item.stackId,
    targetLabels: [...item.targetIds],
  }));
}

function createCombatView(state: MatchState): MatchCombatView {
  return {
    attackers: state.combat.attackers.map((attacker) => ({
      ...attacker,
    })),
    blocks: state.combat.blocks.map((block) => ({
      ...block,
    })),
  };
}

function createPromptView(
  prompt: MatchState["prompts"][number],
): MatchPromptView {
  return {
    choices: prompt.choiceIds.map((choiceId) => ({
      choiceId,
      disabled: false,
      hint: null,
      label: choiceId,
    })),
    expiresAt: prompt.expiresAt,
    kind: prompt.kind,
    maxSelections: 1,
    message: prompt.message,
    minSelections: 1,
    ownerSeat: prompt.ownerSeat,
    promptId: prompt.promptId,
  };
}

function seatHasActivatedAbility(state: MatchState, viewerSeat: SeatId) {
  return state.seats[viewerSeat].battlefield.some((instanceId) =>
    state.cardCatalog[cardIdFromInstanceId(instanceId)]?.abilities.some(
      (ability) =>
        ability.kind === "activated" &&
        (ability.speed === "fast" ||
          ((state.shell.phase === "main1" || state.shell.phase === "main2") &&
            state.stack.length === 0)),
    ),
  );
}

function getOtherSeatId(state: MatchState, viewerSeat: SeatId): SeatId | null {
  return (
    (Object.keys(state.seats) as SeatId[]).find(
      (seat) => seat !== viewerSeat,
    ) ?? null
  );
}

function canAttack(state: MatchState, viewerSeat: SeatId, instanceId: string) {
  const derived = deriveBattlefieldCardStates(state)[instanceId];
  if (!derived || derived.controllerSeat !== viewerSeat) {
    return false;
  }

  if ((derived.power ?? 0) <= 0) {
    return false;
  }

  const entryTurn = state.battlefieldEntryTurns[instanceId];
  if (
    entryTurn === state.shell.turnNumber &&
    !derived.permissions.includes("ignoreSummoningSickness")
  ) {
    return false;
  }

  return true;
}

function canBlockAttacker(
  state: MatchState,
  viewerSeat: SeatId,
  blockerId: string,
  attackerId: string,
) {
  const derived = deriveBattlefieldCardStates(state);
  const blocker = derived[blockerId];
  const attacker = derived[attackerId];
  if (!blocker || !attacker || blocker.controllerSeat !== viewerSeat) {
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

function seatHasCombatAttack(state: MatchState, viewerSeat: SeatId) {
  return state.seats[viewerSeat].battlefield.some((instanceId) =>
    canAttack(state, viewerSeat, instanceId),
  );
}

function seatHasCombatBlock(state: MatchState, viewerSeat: SeatId) {
  return state.combat.attackers.some((attacker) =>
    state.seats[viewerSeat].battlefield.some((blockerId) =>
      canBlockAttacker(state, viewerSeat, blockerId, attacker.attackerId),
    ),
  );
}

function createAvailableIntents(
  state: MatchState,
  viewerSeat: SeatId,
  prompt: MatchState["prompts"][number] | null,
): GameplayIntentKind[] {
  const intents: GameplayIntentKind[] = ["toggleAutoPass", "concede"];
  const viewerState = state.seats[viewerSeat];

  if (prompt?.kind === "mulligan") {
    return ["keepOpeningHand", "takeMulligan", ...intents];
  }

  if (prompt?.kind === "choice") {
    return ["choosePromptOptions", ...intents];
  }

  if (prompt?.kind === "targets") {
    return ["chooseTargets", ...intents];
  }

  if (prompt?.kind === "modes") {
    return ["chooseModes", ...intents];
  }

  if (prompt?.kind === "costs") {
    return ["chooseCosts", ...intents];
  }

  if (
    state.shell.status === "active" &&
    state.shell.prioritySeat === viewerSeat &&
    !prompt
  ) {
    if (
      state.shell.phase === "damage" &&
      state.shell.activeSeat === viewerSeat &&
      state.combat.attackers.length > 0
    ) {
      intents.unshift("assignCombatDamage");
    }
    if (
      state.shell.phase === "block" &&
      state.shell.activeSeat !== viewerSeat &&
      state.combat.attackers.length > 0 &&
      seatHasCombatBlock(state, viewerSeat)
    ) {
      intents.unshift("declareBlockers");
    }
    if (
      state.shell.phase === "attack" &&
      state.shell.activeSeat === viewerSeat &&
      seatHasCombatAttack(state, viewerSeat)
    ) {
      intents.unshift("declareAttackers");
    }
    if (seatHasActivatedAbility(state, viewerSeat)) {
      intents.unshift("activateAbility");
    }
    if (
      (state.shell.phase === "main1" || state.shell.phase === "main2") &&
      viewerState.hand.length > 0
    ) {
      intents.unshift("playCard");
    }
    intents.unshift("passPriority");
  }

  return intents;
}

export function createRecentEventSummaries(
  state: MatchState,
  events: MatchEvent[],
  limit = 10,
): MatchEventSummary[] {
  return events
    .slice(-limit)
    .map((event) => createRecentEventSummary(state, event));
}

export function createSeatView(
  state: MatchState,
  viewerSeat: SeatId,
  events: MatchEvent[],
): MatchSeatView {
  const prompt =
    state.prompts.find(
      (matchPrompt) =>
        matchPrompt.ownerSeat === viewerSeat &&
        matchPrompt.status === "pending",
    ) ?? null;

  return {
    availableIntents: createAvailableIntents(state, viewerSeat, prompt),
    combat: createCombatView(state),
    kind: "seat",
    match: state.shell,
    prompt: prompt ? createPromptView(prompt) : null,
    recentEvents: createRecentEventSummaries(state, events),
    seats: Object.values(state.seats).map((seat) =>
      createSeatStateView(state, seat),
    ),
    stack: createStackViews(state),
    viewerSeat,
    zones: createZoneViews(state, viewerSeat),
  };
}

export function createSpectatorView(
  state: MatchState,
  events: MatchEvent[],
): MatchSpectatorView {
  return {
    availableIntents: [],
    combat: createCombatView(state),
    kind: "spectator",
    match: state.shell,
    prompt: null,
    recentEvents: createRecentEventSummaries(state, events),
    seats: Object.values(state.seats).map((seat) =>
      createSeatStateView(state, seat),
    ),
    stack: createStackViews(state),
    zones: createZoneViews(state, null),
  };
}
