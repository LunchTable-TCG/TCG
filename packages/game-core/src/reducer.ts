import type {
  GameplayIntent,
  MatchEvent,
  SeatId,
} from "@lunchtable/shared-types";

import { type MatchState, createMatchShellFromState } from "./state";

export interface MatchTransition {
  events: MatchEvent[];
  nextState: MatchState;
  outcome: "applied" | "noop" | "rejected";
  reason?:
    | "invalidMatch"
    | "invalidSeat"
    | "matchComplete"
    | "staleStateVersion"
    | "unsupportedIntent";
}

function createAutoPassToggledEvent(
  state: MatchState,
  input: {
    enabled: boolean;
    seat: SeatId;
  },
): Extract<MatchEvent, { kind: "autoPassToggled" }> {
  return {
    at: state.shell.createdAt,
    eventId: `event_${state.eventSequence + 1}`,
    kind: "autoPassToggled",
    matchId: state.shell.id,
    payload: input,
    sequence: state.eventSequence + 1,
    stateVersion: state.shell.version + 1,
  };
}

function createPlayerConcededEvent(
  state: MatchState,
  input: {
    reason: "disconnect" | "manual" | "timeout";
    seat: SeatId;
  },
): Extract<MatchEvent, { kind: "playerConceded" }> {
  return {
    at: state.shell.createdAt,
    eventId: `event_${state.eventSequence + 1}`,
    kind: "playerConceded",
    matchId: state.shell.id,
    payload: input,
    sequence: state.eventSequence + 1,
    stateVersion: state.shell.version + 1,
  };
}

function cloneState(state: MatchState): MatchState {
  return {
    eventSequence: state.eventSequence,
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

function getOtherSeatId(state: MatchState, currentSeat: SeatId): SeatId | null {
  return Object.keys(state.seats).find((seat) => seat !== currentSeat) ?? null;
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

  if (intent.kind === "passPriority") {
    return {
      events: [],
      nextState: state,
      outcome: "noop",
    };
  }

  const nextState = cloneState(state);
  const nextSeat = nextState.seats[intent.seat];

  if (intent.kind === "toggleAutoPass") {
    nextSeat.autoPassEnabled = intent.payload.enabled;
    nextState.shell.version += 1;
    const event = createAutoPassToggledEvent(state, {
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
    const event = createPlayerConcededEvent(state, {
      reason: intent.payload.reason,
      seat: intent.seat,
    });
    return finalizeState(nextState, [event]);
  }

  return {
    events: [],
    nextState: state,
    outcome: "rejected",
    reason: "unsupportedIntent",
  };
}
