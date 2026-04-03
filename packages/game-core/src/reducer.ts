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
  deriveDeterministicNumber,
} from "./state";

export interface MatchTransition {
  events: MatchEvent[];
  nextState: MatchState;
  outcome: "applied" | "noop" | "rejected";
  reason?: MatchTransitionReason;
}

export type MatchTransitionReason =
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
  | "unsupportedIntent";

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
  resetTurnResources(state);
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
    cardCatalog: cloneCardCatalog(state.cardCatalog),
    eventSequence: state.eventSequence,
    lastPriorityPassSeat: state.lastPriorityPassSeat,
    prompts: state.prompts.map((prompt) => ({
      ...prompt,
      choiceIds: [...prompt.choiceIds],
      resolvedChoiceIds: [...prompt.resolvedChoiceIds],
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
    stack: state.stack.map((item) => ({
      ...item,
      targetIds: [...item.targetIds],
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
    const destinationZone =
      catalogEntry.kind === "spell" ? nextSeat.graveyard : nextSeat.battlefield;
    const destinationKind: ZoneKind =
      catalogEntry.kind === "spell" ? "graveyard" : "battlefield";
    destinationZone.push(intent.payload.cardInstanceId);
    manaResource.current -= catalogEntry.cost;
    nextState.lastPriorityPassSeat = null;
    nextState.shell.prioritySeat = getOtherSeatId(nextState, intent.seat);
    nextState.shell.version += 1;

    const events: MatchEvent[] = [
      createEvent("cardMoved", {
        cardInstanceId: intent.payload.cardInstanceId,
        fromZone: intent.payload.sourceZone,
        publicReason: "cast",
        toZone: destinationKind,
      }),
      createEvent("cardPlayed", {
        cardInstanceId: intent.payload.cardInstanceId,
        seat: intent.seat,
        toZone: destinationKind,
      }),
    ];
    return finalizeState(nextState, events);
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
