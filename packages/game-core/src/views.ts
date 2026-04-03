import type {
  GameplayIntentKind,
  MatchCardView,
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
  return {
    annotations: [...(derivedState?.annotations ?? [])],
    cardId,
    controllerSeat: seat,
    counters: {},
    instanceId,
    isTapped: false,
    keywords: [...(derivedState?.keywords ?? card?.keywords ?? [])],
    name: card?.name ?? cardId,
    ownerSeat: seat,
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

function createRecentEventSummary(event: MatchEvent): MatchEventSummary {
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
    return {
      kind: event.kind,
      label: "Played a card",
      seat: event.payload.seat,
      sequence: event.sequence,
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
    return {
      kind: event.kind,
      label: `Activated ${event.payload.abilityId}`,
      seat: event.payload.seat,
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

  if (
    state.shell.status === "active" &&
    state.shell.prioritySeat === viewerSeat &&
    !prompt
  ) {
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
  events: MatchEvent[],
  limit = 10,
): MatchEventSummary[] {
  return events.slice(-limit).map(createRecentEventSummary);
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
    kind: "seat",
    match: state.shell,
    prompt: prompt ? createPromptView(prompt) : null,
    recentEvents: createRecentEventSummaries(events),
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
    kind: "spectator",
    match: state.shell,
    prompt: null,
    recentEvents: createRecentEventSummaries(events),
    seats: Object.values(state.seats).map((seat) =>
      createSeatStateView(state, seat),
    ),
    stack: createStackViews(state),
    zones: createZoneViews(state, null),
  };
}
