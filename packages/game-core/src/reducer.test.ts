import { describe, expect, it } from "vitest";

import {
  applyGameplayIntent,
  createGameState,
  createMatchShellFromState,
  replayGameplayIntents,
} from "./index";

function createMulliganPrompt(seat: "seat-0" | "seat-1") {
  return {
    choiceIds: ["keep", "mulligan:6"],
    expiresAt: null,
    kind: "mulligan" as const,
    message: "Choose whether to keep 7 cards or take a mulligan.",
    ownerSeat: seat,
    promptId: `prompt:${seat}:mulligan`,
    resolvedChoiceIds: [],
    status: "pending" as const,
  };
}

function createMulliganState() {
  const state = createGameState({
    matchId: "match_phase9",
    seed: "seed:phase-9",
    status: "active",
  });

  state.cardCatalog = {
    "tidecall-apprentice": {
      cardId: "tidecall-apprentice",
      cost: 1,
      kind: "unit",
      keywords: [],
      name: "Tidecall Apprentice",
      stats: {
        power: 1,
        toughness: 2,
      },
    },
    "ember-summoner": {
      cardId: "ember-summoner",
      cost: 2,
      kind: "unit",
      keywords: [],
      name: "Ember Summoner",
      stats: {
        power: 2,
        toughness: 2,
      },
    },
  };

  const seat0 = state.seats["seat-0"];
  const seat1 = state.seats["seat-1"];
  seat0.status = "active";
  seat1.status = "active";
  seat0.ready = true;
  seat1.ready = true;
  seat0.hand = [
    "seat-0:tidecall-apprentice:deck:1",
    "seat-0:ember-summoner:deck:2",
    "seat-0:tidecall-apprentice:deck:3",
    "seat-0:tidecall-apprentice:deck:4",
    "seat-0:tidecall-apprentice:deck:5",
    "seat-0:tidecall-apprentice:deck:6",
    "seat-0:tidecall-apprentice:deck:7",
  ];
  seat0.deck = [
    "seat-0:tidecall-apprentice:deck:8",
    "seat-0:tidecall-apprentice:deck:9",
    "seat-0:tidecall-apprentice:deck:10",
  ];
  seat1.hand = [
    "seat-1:tidecall-apprentice:deck:1",
    "seat-1:tidecall-apprentice:deck:2",
    "seat-1:tidecall-apprentice:deck:3",
    "seat-1:tidecall-apprentice:deck:4",
    "seat-1:tidecall-apprentice:deck:5",
    "seat-1:tidecall-apprentice:deck:6",
    "seat-1:tidecall-apprentice:deck:7",
  ];
  seat1.deck = [
    "seat-1:tidecall-apprentice:deck:8",
    "seat-1:tidecall-apprentice:deck:9",
    "seat-1:tidecall-apprentice:deck:10",
  ];
  state.prompts = [
    createMulliganPrompt("seat-0"),
    createMulliganPrompt("seat-1"),
  ];
  state.shell.activeSeat = "seat-0";
  state.shell.phase = "mulligan";
  state.shell.prioritySeat = null;
  state.shell.startedAt = 1000;
  state.shell.turnNumber = 1;
  state.shell.version = 0;
  state.shell = createMatchShellFromState(state);

  return state;
}

function keepBothOpeningHands() {
  const initialState = createMulliganState();
  const firstKeep = applyGameplayIntent(initialState, {
    intentId: "intent_keep_001",
    kind: "keepOpeningHand",
    matchId: initialState.shell.id,
    payload: {},
    seat: "seat-0",
    stateVersion: initialState.shell.version,
  });
  const secondKeep = applyGameplayIntent(firstKeep.nextState, {
    intentId: "intent_keep_002",
    kind: "keepOpeningHand",
    matchId: initialState.shell.id,
    payload: {},
    seat: "seat-1",
    stateVersion: firstKeep.nextState.shell.version,
  });

  return secondKeep.nextState;
}

describe("applyGameplayIntent", () => {
  it("resolves mulligan prompts and moves to the first main phase once both seats keep", () => {
    const state = createMulliganState();

    const firstKeep = applyGameplayIntent(state, {
      intentId: "intent_keep_001",
      kind: "keepOpeningHand",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: state.shell.version,
    });

    expect(firstKeep.outcome).toBe("applied");
    expect(firstKeep.events.map((event) => event.kind)).toEqual([
      "openingHandKept",
      "promptResolved",
    ]);
    expect(firstKeep.nextState.shell.phase).toBe("mulligan");

    const secondKeep = applyGameplayIntent(firstKeep.nextState, {
      intentId: "intent_keep_002",
      kind: "keepOpeningHand",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: firstKeep.nextState.shell.version,
    });

    expect(secondKeep.outcome).toBe("applied");
    expect(secondKeep.events.map((event) => event.kind)).toEqual([
      "openingHandKept",
      "promptResolved",
      "phaseAdvanced",
    ]);
    expect(secondKeep.nextState.shell.phase).toBe("main1");
    expect(secondKeep.nextState.shell.prioritySeat).toBe("seat-0");
    expect(secondKeep.nextState.seats["seat-0"]?.resources[0]?.current).toBe(1);
    expect(
      secondKeep.nextState.prompts.every(
        (prompt) => prompt.status === "resolved",
      ),
    ).toBe(true);
  });

  it("takes a deterministic mulligan and redraws one fewer card", () => {
    const state = createMulliganState();

    const transition = applyGameplayIntent(state, {
      intentId: "intent_mulligan_001",
      kind: "takeMulligan",
      matchId: state.shell.id,
      payload: {
        targetHandSize: null,
      },
      seat: "seat-0",
      stateVersion: state.shell.version,
    });

    expect(transition.outcome).toBe("applied");
    expect(transition.events.map((event) => event.kind)).toEqual([
      "mulliganTaken",
    ]);
    expect(transition.nextState.seats["seat-0"]?.hand).toHaveLength(6);
    expect(transition.nextState.seats["seat-0"]?.deck).toHaveLength(4);
    expect(transition.nextState.seats["seat-0"]?.mulligansTaken).toBe(1);
  });

  it("plays a card, spends mana, and advances priority on consecutive passes", () => {
    const state = keepBothOpeningHands();

    const playTransition = applyGameplayIntent(state, {
      intentId: "intent_play_001",
      kind: "playCard",
      matchId: state.shell.id,
      payload: {
        alternativeCostId: null,
        cardInstanceId: "seat-0:tidecall-apprentice:deck:1",
        sourceZone: "hand",
        targetSlotId: null,
      },
      seat: "seat-0",
      stateVersion: state.shell.version,
    });

    expect(playTransition.outcome).toBe("applied");
    expect(playTransition.events.map((event) => event.kind)).toEqual([
      "cardMoved",
      "cardPlayed",
    ]);
    expect(playTransition.nextState.seats["seat-0"]?.battlefield).toContain(
      "seat-0:tidecall-apprentice:deck:1",
    );
    expect(playTransition.nextState.seats["seat-0"]?.hand).not.toContain(
      "seat-0:tidecall-apprentice:deck:1",
    );
    expect(
      playTransition.nextState.seats["seat-0"]?.resources[0]?.current,
    ).toBe(0);
    expect(playTransition.nextState.shell.prioritySeat).toBe("seat-1");

    const firstPass = applyGameplayIntent(playTransition.nextState, {
      intentId: "intent_pass_001",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: playTransition.nextState.shell.version,
    });

    expect(firstPass.outcome).toBe("applied");
    expect(firstPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
    ]);
    expect(firstPass.nextState.shell.prioritySeat).toBe("seat-0");

    const secondPass = applyGameplayIntent(firstPass.nextState, {
      intentId: "intent_pass_002",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: firstPass.nextState.shell.version,
    });

    expect(secondPass.outcome).toBe("applied");
    expect(secondPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
      "phaseAdvanced",
    ]);
    expect(secondPass.nextState.shell.phase).toBe("attack");
    expect(secondPass.nextState.shell.prioritySeat).toBe("seat-0");
  });

  it("rejects card play from a seat without priority", () => {
    const state = keepBothOpeningHands();

    const transition = applyGameplayIntent(state, {
      intentId: "intent_play_reject_001",
      kind: "playCard",
      matchId: state.shell.id,
      payload: {
        alternativeCostId: null,
        cardInstanceId: "seat-0:tidecall-apprentice:deck:1",
        sourceZone: "hand",
        targetSlotId: null,
      },
      seat: "seat-1",
      stateVersion: state.shell.version,
    });

    expect(transition.outcome).toBe("rejected");
    expect(transition.reason).toBe("notPriorityOwner");
  });

  it("replays the same seed and intents into the same final state", () => {
    const initialState = createGameState({
      matchId: "match_replay",
      seed: "seed:replay-stable",
      status: "active",
    });

    const intents = [
      {
        intentId: "intent_toggle_001",
        kind: "toggleAutoPass",
        matchId: initialState.shell.id,
        payload: {
          enabled: true,
        },
        seat: "seat-0",
        stateVersion: 0,
      },
      {
        intentId: "intent_concede_002",
        kind: "concede",
        matchId: initialState.shell.id,
        payload: {
          reason: "manual",
        },
        seat: "seat-1",
        stateVersion: 1,
      },
    ] as const;

    const firstReplay = replayGameplayIntents(initialState, [...intents]);
    const secondReplay = replayGameplayIntents(
      createGameState({
        matchId: "match_replay",
        seed: "seed:replay-stable",
        status: "active",
      }),
      [...intents],
    );

    expect(firstReplay.events).toHaveLength(3);
    expect(firstReplay.state.seats["seat-0"]?.autoPassEnabled).toBe(true);
    expect(firstReplay.state.shell.status).toBe("complete");
    expect(firstReplay.state.shell.winnerSeat).toBe("seat-0");
    expect(firstReplay).toEqual(secondReplay);
  });
});
