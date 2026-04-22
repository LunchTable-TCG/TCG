import { describe, expect, it } from "vitest";

import {
  applyGameplayIntent,
  createGameState,
  createMatchShellFromState,
  createSeatView,
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

function createSelectionPromptState(
  kind: "choice" | "costs" | "modes" | "targets",
) {
  const state = createGameState({
    matchId: `match_prompt_${kind}`,
    seed: `seed:prompt-${kind}`,
    status: "active",
  });

  state.seats["seat-0"].status = "active";
  state.seats["seat-0"].ready = true;
  state.seats["seat-1"].status = "active";
  state.seats["seat-1"].ready = true;
  state.prompts = [
    {
      choiceIds: [`${kind}:alpha`, `${kind}:beta`],
      expiresAt: null,
      kind,
      message: `Resolve ${kind} prompt`,
      ownerSeat: "seat-0",
      promptId: `prompt:${kind}`,
      resolvedChoiceIds: [],
      status: "pending" as const,
    },
  ];
  state.shell.activeSeat = "seat-0";
  state.shell.phase = "main1";
  state.shell.prioritySeat = null;
  state.shell.startedAt = 1000;
  state.shell.turnNumber = 1;
  state.shell.version = 0;
  state.shell = createMatchShellFromState(state);

  return state;
}

function createMulliganState() {
  const state = createGameState({
    matchId: "match_phase9",
    seed: "seed:phase-9",
    status: "active",
  });

  state.cardCatalog = {
    "archive-apprentice": {
      abilities: [
        {
          costs: [
            {
              amount: 1,
              kind: "resource",
              resourceId: "mana",
            },
          ],
          effect: [
            {
              amount: 1,
              kind: "drawCards",
              target: "controller",
            },
          ],
          id: "study-bolt",
          kind: "activated",
          speed: "slow",
          text: "Pay 1 mana: Draw a card.",
        },
      ],
      cardId: "archive-apprentice",
      cost: 2,
      kind: "unit",
      keywords: [],
      name: "Archive Apprentice",
      stats: {
        power: 1,
        toughness: 3,
      },
    },
    "tidecall-apprentice": {
      abilities: [],
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
      abilities: [
        {
          effect: [
            {
              amount: 2,
              kind: "dealDamage",
              target: "opponent",
            },
          ],
          id: "entry-spark",
          kind: "triggered",
          text: "When this enters the battlefield, deal 2 damage to the opposing seat.",
          trigger: {
            event: "selfEntersBattlefield",
            kind: "event",
          },
        },
      ],
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
    "seat-0:archive-apprentice:deck:3",
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

  it.each([
    {
      buildIntent: (state: ReturnType<typeof createSelectionPromptState>) => ({
        intentId: "intent_choice_prompt_001",
        kind: "choosePromptOptions" as const,
        matchId: state.shell.id,
        payload: {
          choiceIds: ["choice:alpha"],
          promptId: "prompt:choice",
        },
        seat: "seat-0" as const,
        stateVersion: state.shell.version,
      }),
      kind: "choice" as const,
    },
    {
      buildIntent: (state: ReturnType<typeof createSelectionPromptState>) => ({
        intentId: "intent_targets_prompt_001",
        kind: "chooseTargets" as const,
        matchId: state.shell.id,
        payload: {
          promptId: "prompt:targets",
          targetIds: ["targets:alpha"],
        },
        seat: "seat-0" as const,
        stateVersion: state.shell.version,
      }),
      kind: "targets" as const,
    },
    {
      buildIntent: (state: ReturnType<typeof createSelectionPromptState>) => ({
        intentId: "intent_modes_prompt_001",
        kind: "chooseModes" as const,
        matchId: state.shell.id,
        payload: {
          modeIds: ["modes:alpha"],
          promptId: "prompt:modes",
        },
        seat: "seat-0" as const,
        stateVersion: state.shell.version,
      }),
      kind: "modes" as const,
    },
    {
      buildIntent: (state: ReturnType<typeof createSelectionPromptState>) => ({
        intentId: "intent_costs_prompt_001",
        kind: "chooseCosts" as const,
        matchId: state.shell.id,
        payload: {
          costIds: ["costs:alpha"],
          promptId: "prompt:costs",
        },
        seat: "seat-0" as const,
        stateVersion: state.shell.version,
      }),
      kind: "costs" as const,
    },
  ])(
    "resolves pending %s prompts through authoritative selection intents",
    ({ buildIntent, kind }) => {
      const state = createSelectionPromptState(kind);

      const transition = applyGameplayIntent(state, buildIntent(state));

      expect(transition.outcome).toBe("applied");
      expect(transition.events.map((event) => event.kind)).toEqual([
        "promptResolved",
      ]);
      expect(transition.nextState.prompts[0]?.status).toBe("resolved");
      expect(transition.nextState.prompts[0]?.resolvedChoiceIds).toEqual([
        `${kind}:alpha`,
      ]);
    },
  );

  it("rejects invalid generic prompt selections", () => {
    const state = createSelectionPromptState("targets");

    const transition = applyGameplayIntent(state, {
      intentId: "intent_invalid_targets_prompt_001",
      kind: "chooseTargets",
      matchId: state.shell.id,
      payload: {
        promptId: "prompt:targets",
        targetIds: ["targets:missing"],
      },
      seat: "seat-0",
      stateVersion: state.shell.version,
    });

    expect(transition.outcome).toBe("rejected");
    expect(transition.reason).toBe("invalidPrompt");
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
      "cardPlayed",
      "stackObjectCreated",
    ]);
    expect(playTransition.nextState.seats["seat-0"]?.battlefield).not.toContain(
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
      "stackObjectResolved",
      "cardMoved",
    ]);
    expect(secondPass.nextState.seats["seat-0"]?.battlefield).toContain(
      "seat-0:tidecall-apprentice:deck:1",
    );
    expect(secondPass.nextState.shell.phase).toBe("main1");
    expect(secondPass.nextState.shell.prioritySeat).toBe("seat-0");

    const thirdPass = applyGameplayIntent(secondPass.nextState, {
      intentId: "intent_pass_003",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: secondPass.nextState.shell.version,
    });
    const fourthPass = applyGameplayIntent(thirdPass.nextState, {
      intentId: "intent_pass_004",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: thirdPass.nextState.shell.version,
    });

    expect(fourthPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
      "phaseAdvanced",
    ]);
    expect(fourthPass.nextState.shell.phase).toBe("attack");
  });

  it("draws a card for the next active seat when cleanup advances the turn", () => {
    const state = keepBothOpeningHands();
    state.shell.phase = "cleanup";
    state.shell.prioritySeat = "seat-0";
    state.lastPriorityPassSeat = null;
    state.seats["seat-1"].deck = [
      "seat-1:tidecall-apprentice:deck:draw-turn",
      ...state.seats["seat-1"].deck,
    ];

    const firstPass = applyGameplayIntent(state, {
      intentId: "intent_turn_draw_pass_001",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: state.shell.version,
    });
    const secondPass = applyGameplayIntent(firstPass.nextState, {
      intentId: "intent_turn_draw_pass_002",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: firstPass.nextState.shell.version,
    });

    expect(secondPass.outcome).toBe("applied");
    expect(secondPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
      "phaseAdvanced",
      "turnAdvanced",
      "cardsDrawn",
    ]);
    expect(secondPass.nextState.shell.turnNumber).toBe(2);
    expect(secondPass.nextState.shell.activeSeat).toBe("seat-1");
    expect(secondPass.nextState.shell.phase).toBe("main1");
    expect(secondPass.nextState.seats["seat-1"]?.hand).toContain(
      "seat-1:tidecall-apprentice:deck:draw-turn",
    );
  });

  it("completes the match if the next active seat cannot draw at turn start", () => {
    const state = keepBothOpeningHands();
    state.shell.phase = "cleanup";
    state.shell.prioritySeat = "seat-0";
    state.lastPriorityPassSeat = null;
    state.seats["seat-1"].deck = [];

    const firstPass = applyGameplayIntent(state, {
      intentId: "intent_turn_loss_pass_001",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: state.shell.version,
    });
    const secondPass = applyGameplayIntent(firstPass.nextState, {
      intentId: "intent_turn_loss_pass_002",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: firstPass.nextState.shell.version,
    });

    expect(secondPass.outcome).toBe("applied");
    expect(secondPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
      "phaseAdvanced",
      "turnAdvanced",
      "matchCompleted",
    ]);
    expect(secondPass.nextState.shell.status).toBe("complete");
    expect(secondPass.nextState.shell.winnerSeat).toBe("seat-0");
    expect(secondPass.nextState.seats["seat-1"]?.status).toBe("eliminated");
  });

  it("enqueues and resolves self-enter triggers before priority resumes", () => {
    const state = keepBothOpeningHands();
    state.seats["seat-0"].resources = [
      {
        current: 2,
        label: "Mana",
        maximum: 2,
        resourceId: "mana",
      },
    ];

    const playTransition = applyGameplayIntent(state, {
      intentId: "intent_play_ember_001",
      kind: "playCard",
      matchId: state.shell.id,
      payload: {
        alternativeCostId: null,
        cardInstanceId: "seat-0:ember-summoner:deck:2",
        sourceZone: "hand",
        targetSlotId: null,
      },
      seat: "seat-0",
      stateVersion: state.shell.version,
    });
    const firstPass = applyGameplayIntent(playTransition.nextState, {
      intentId: "intent_pass_ember_001",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: playTransition.nextState.shell.version,
    });
    const secondPass = applyGameplayIntent(firstPass.nextState, {
      intentId: "intent_pass_ember_002",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: firstPass.nextState.shell.version,
    });

    expect(secondPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
      "stackObjectResolved",
      "cardMoved",
      "stackObjectCreated",
    ]);
    expect(secondPass.nextState.stack).toHaveLength(1);
    expect(secondPass.nextState.shell.prioritySeat).toBe("seat-0");

    const thirdPass = applyGameplayIntent(secondPass.nextState, {
      intentId: "intent_pass_ember_003",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: secondPass.nextState.shell.version,
    });
    const fourthPass = applyGameplayIntent(thirdPass.nextState, {
      intentId: "intent_pass_ember_004",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: thirdPass.nextState.shell.version,
    });

    expect(fourthPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
      "stackObjectResolved",
      "lifeTotalChanged",
    ]);
    expect(fourthPass.nextState.stack).toHaveLength(0);
    expect(fourthPass.nextState.seats["seat-1"]?.lifeTotal).toBe(18);
  });

  it("puts activated abilities on the stack and resolves them with the same parity as cards", () => {
    const state = keepBothOpeningHands();
    state.seats["seat-0"].battlefield.push(
      "seat-0:archive-apprentice:battlefield:1",
    );
    state.seats["seat-0"].resources = [
      {
        current: 1,
        label: "Mana",
        maximum: 1,
        resourceId: "mana",
      },
    ];
    state.seats["seat-0"].deck = [
      "seat-0:tidecall-apprentice:deck:draw1",
      ...state.seats["seat-0"].deck,
    ];

    const activateTransition = applyGameplayIntent(state, {
      intentId: "intent_activate_001",
      kind: "activateAbility",
      matchId: state.shell.id,
      payload: {
        abilityId: "study-bolt",
        sourceInstanceId: "seat-0:archive-apprentice:battlefield:1",
      },
      seat: "seat-0",
      stateVersion: state.shell.version,
    });

    expect(activateTransition.events.map((event) => event.kind)).toEqual([
      "abilityActivated",
      "stackObjectCreated",
    ]);
    expect(activateTransition.nextState.stack).toHaveLength(1);
    expect(
      activateTransition.nextState.seats["seat-0"]?.resources[0]?.current,
    ).toBe(0);

    const firstPass = applyGameplayIntent(activateTransition.nextState, {
      intentId: "intent_activate_pass_001",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: activateTransition.nextState.shell.version,
    });
    const secondPass = applyGameplayIntent(firstPass.nextState, {
      intentId: "intent_activate_pass_002",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: firstPass.nextState.shell.version,
    });

    expect(secondPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
      "stackObjectResolved",
    ]);
    expect(secondPass.nextState.stack).toHaveLength(0);
    expect(secondPass.nextState.seats["seat-0"]?.hand).toContain(
      "seat-0:tidecall-apprentice:deck:draw1",
    );
  });

  it("resolves targeted activated abilities and clears end-of-turn keyword grants on the next turn", () => {
    const state = keepBothOpeningHands();

    state.cardCatalog["field-marshal-cadet"] = {
      abilities: [
        {
          costs: [
            {
              amount: 1,
              kind: "resource",
              resourceId: "mana",
            },
          ],
          effect: [
            {
              keywordId: "haste",
              kind: "grantKeyword",
              target: "target",
              until: "endOfTurn",
            },
          ],
          id: "battlefield-orders",
          kind: "activated",
          speed: "slow",
          targets: [
            {
              count: {
                max: 1,
                min: 1,
              },
              selector: "friendlyUnit",
            },
          ],
          text: "Target friendly unit gains haste until end of turn.",
        },
      ],
      cardId: "field-marshal-cadet",
      cost: 2,
      kind: "unit",
      keywords: [],
      name: "Field Marshal Cadet",
      stats: {
        power: 2,
        toughness: 2,
      },
    };
    state.seats["seat-0"].battlefield.push(
      "seat-0:field-marshal-cadet:battlefield:1",
      "seat-0:tidecall-apprentice:battlefield:1",
    );
    state.seats["seat-0"].resources = [
      {
        current: 1,
        label: "Mana",
        maximum: 1,
        resourceId: "mana",
      },
    ];

    const activation = applyGameplayIntent(state, {
      intentId: "intent_targeted_activate_001",
      kind: "activateAbility",
      matchId: state.shell.id,
      payload: {
        abilityId: "battlefield-orders",
        sourceInstanceId: "seat-0:field-marshal-cadet:battlefield:1",
        targetIds: ["seat-0:tidecall-apprentice:battlefield:1"],
      },
      seat: "seat-0",
      stateVersion: state.shell.version,
    });

    expect(activation.outcome).toBe("applied");
    expect(activation.nextState.stack).toHaveLength(1);

    const resolvePassA = applyGameplayIntent(activation.nextState, {
      intentId: "intent_targeted_activate_pass_001",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: activation.nextState.shell.version,
    });
    const resolvePassB = applyGameplayIntent(resolvePassA.nextState, {
      intentId: "intent_targeted_activate_pass_002",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: resolvePassA.nextState.shell.version,
    });

    const resolvedSeatView = createSeatView(
      resolvePassB.nextState,
      "seat-0",
      resolvePassB.events,
    );
    const hastedUnit = resolvedSeatView.zones
      .find(
        (zone) => zone.ownerSeat === "seat-0" && zone.zone === "battlefield",
      )
      ?.cards.find(
        (card) =>
          card.instanceId === "seat-0:tidecall-apprentice:battlefield:1",
      );

    expect(hastedUnit?.keywords).toContain("haste");

    let advancedState = resolvePassB.nextState;
    for (let pair = 0; pair < 7; pair += 1) {
      const firstPass = applyGameplayIntent(advancedState, {
        intentId: `intent_advance_phase_${pair}_a`,
        kind: "passPriority",
        matchId: state.shell.id,
        payload: {},
        seat: "seat-0",
        stateVersion: advancedState.shell.version,
      });
      const secondPass = applyGameplayIntent(firstPass.nextState, {
        intentId: `intent_advance_phase_${pair}_b`,
        kind: "passPriority",
        matchId: state.shell.id,
        payload: {},
        seat: "seat-1",
        stateVersion: firstPass.nextState.shell.version,
      });
      advancedState = secondPass.nextState;
    }

    expect(advancedState.shell.turnNumber).toBe(2);

    const nextTurnSeatView = createSeatView(advancedState, "seat-0", []);
    const resetUnit = nextTurnSeatView.zones
      .find(
        (zone) => zone.ownerSeat === "seat-0" && zone.zone === "battlefield",
      )
      ?.cards.find(
        (card) =>
          card.instanceId === "seat-0:tidecall-apprentice:battlefield:1",
      );

    expect(resetUnit?.keywords).not.toContain("haste");
  });

  it("applies state-based cleanup after a continuous stat buff source leaves play", () => {
    const state = keepBothOpeningHands();
    state.cardCatalog = {
      "anchor-captain": {
        abilities: [
          {
            effect: {
              kind: "modifyStats",
              modifier: {
                toughness: 1,
              },
              target: "friendlyUnits",
            },
            id: "anchor-line",
            kind: "static",
            layer: "statModifiers",
            text: "Other friendly units get +0/+1.",
          },
        ],
        cardId: "anchor-captain",
        cost: 3,
        kind: "unit",
        keywords: [],
        name: "Anchor Captain",
        stats: {
          power: 2,
          toughness: 4,
        },
      },
      "fragile-apprentice": {
        abilities: [],
        cardId: "fragile-apprentice",
        cost: 1,
        kind: "unit",
        keywords: [],
        name: "Fragile Apprentice",
        stats: {
          power: 1,
          toughness: 0,
        },
      },
    };
    state.seats["seat-0"].battlefield = [
      "seat-0:anchor-captain:battlefield:1",
      "seat-0:fragile-apprentice:battlefield:1",
    ];
    state.stack = [
      {
        abilityId: "self-destruct",
        cardId: "anchor-captain",
        controllerSeat: "seat-0",
        destinationZone: null,
        effects: [
          {
            kind: "destroy",
            target: "self",
          },
        ],
        kind: "activatedAbility",
        label: "Anchor Captain self-destruct",
        originZone: "battlefield",
        sourceInstanceId: "seat-0:anchor-captain:battlefield:1",
        stackId: "stack_cleanup_001",
        status: "pending",
        targetIds: [],
      },
    ];
    state.shell.prioritySeat = "seat-0";

    const firstPass = applyGameplayIntent(state, {
      intentId: "intent_cleanup_pass_001",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: state.shell.version,
    });
    const secondPass = applyGameplayIntent(firstPass.nextState, {
      intentId: "intent_cleanup_pass_002",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: firstPass.nextState.shell.version,
    });

    expect(secondPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
      "stackObjectResolved",
      "cardMoved",
      "cardMoved",
    ]);
    expect(secondPass.nextState.seats["seat-0"]?.battlefield).toEqual([]);
    expect(secondPass.nextState.seats["seat-0"]?.graveyard).toEqual([
      "seat-0:anchor-captain:battlefield:1",
      "seat-0:fragile-apprentice:battlefield:1",
    ]);
  });

  it("uses replacement effects to move destroyed units to exile instead of the graveyard", () => {
    const state = keepBothOpeningHands();
    state.cardCatalog = {
      "reborn-sentinel": {
        abilities: [
          {
            id: "reborn-shroud",
            kind: "replacement",
            replace: {
              destination: "exile",
              kind: "moveInstead",
            },
            text: "If this would be destroyed, exile it instead.",
            watches: {
              event: "selfWouldBeDestroyed",
              kind: "event",
            },
          },
        ],
        cardId: "reborn-sentinel",
        cost: 2,
        kind: "unit",
        keywords: [],
        name: "Reborn Sentinel",
        stats: {
          power: 2,
          toughness: 2,
        },
      },
    };
    state.seats["seat-0"].battlefield = [
      "seat-0:reborn-sentinel:battlefield:1",
    ];
    state.stack = [
      {
        abilityId: "self-destruct",
        cardId: "reborn-sentinel",
        controllerSeat: "seat-0",
        destinationZone: null,
        effects: [
          {
            kind: "destroy",
            target: "self",
          },
        ],
        kind: "activatedAbility",
        label: "Reborn Sentinel self-destruct",
        originZone: "battlefield",
        sourceInstanceId: "seat-0:reborn-sentinel:battlefield:1",
        stackId: "stack_replacement_001",
        status: "pending",
        targetIds: [],
      },
    ];
    state.shell.prioritySeat = "seat-0";

    const firstPass = applyGameplayIntent(state, {
      intentId: "intent_replacement_pass_001",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: state.shell.version,
    });
    const secondPass = applyGameplayIntent(firstPass.nextState, {
      intentId: "intent_replacement_pass_002",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: firstPass.nextState.shell.version,
    });

    expect(secondPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
      "stackObjectResolved",
      "cardMoved",
    ]);
    expect(secondPass.nextState.seats["seat-0"]?.battlefield).toEqual([]);
    expect(secondPass.nextState.seats["seat-0"]?.graveyard).toEqual([]);
    expect(secondPass.nextState.seats["seat-0"]?.exile).toEqual([
      "seat-0:reborn-sentinel:battlefield:1",
    ]);
    expect(secondPass.events[2]?.kind).toBe("cardMoved");
    if (secondPass.events[2]?.kind === "cardMoved") {
      expect(secondPass.events[2].payload.toZone).toBe("exile");
    }
  });

  it("applies attacker, blocker, and combat damage intents through the same authoritative flow", () => {
    const state = keepBothOpeningHands();
    state.shell.activeSeat = "seat-0";
    state.shell.phase = "attack";
    state.shell.prioritySeat = "seat-0";
    state.shell.turnNumber = 3;
    state.seats["seat-0"].battlefield = ["seat-0:ember-summoner:battlefield:1"];
    state.seats["seat-1"].battlefield = ["seat-1:ember-summoner:battlefield:1"];

    const attackers = applyGameplayIntent(state, {
      intentId: "intent_attackers_001",
      kind: "declareAttackers",
      matchId: state.shell.id,
      payload: {
        attackers: [
          {
            attackerId: "seat-0:ember-summoner:battlefield:1",
            defenderSeat: "seat-1",
            laneId: null,
          },
        ],
      },
      seat: "seat-0",
      stateVersion: state.shell.version,
    });

    expect(attackers.events.map((event) => event.kind)).toEqual([
      "attackersDeclared",
      "phaseAdvanced",
    ]);
    expect(attackers.nextState.shell.phase).toBe("block");
    expect(attackers.nextState.combat.attackers).toEqual([
      {
        attackerId: "seat-0:ember-summoner:battlefield:1",
        defenderSeat: "seat-1",
        laneId: null,
      },
    ]);

    const blockers = applyGameplayIntent(attackers.nextState, {
      intentId: "intent_blockers_001",
      kind: "declareBlockers",
      matchId: state.shell.id,
      payload: {
        blocks: [
          {
            attackerId: "seat-0:ember-summoner:battlefield:1",
            blockerId: "seat-1:ember-summoner:battlefield:1",
          },
        ],
      },
      seat: "seat-1",
      stateVersion: attackers.nextState.shell.version,
    });

    expect(blockers.events.map((event) => event.kind)).toEqual([
      "blockersDeclared",
      "phaseAdvanced",
    ]);
    expect(blockers.nextState.shell.phase).toBe("damage");
    expect(blockers.nextState.combat.blocks).toEqual([
      {
        attackerId: "seat-0:ember-summoner:battlefield:1",
        blockerId: "seat-1:ember-summoner:battlefield:1",
      },
    ]);

    const damage = applyGameplayIntent(blockers.nextState, {
      intentId: "intent_damage_001",
      kind: "assignCombatDamage",
      matchId: state.shell.id,
      payload: {
        assignments: [
          {
            amount: 2,
            sourceId: "seat-0:ember-summoner:battlefield:1",
            targetId: "seat-1:ember-summoner:battlefield:1",
          },
          {
            amount: 2,
            sourceId: "seat-1:ember-summoner:battlefield:1",
            targetId: "seat-0:ember-summoner:battlefield:1",
          },
        ],
      },
      seat: "seat-0",
      stateVersion: blockers.nextState.shell.version,
    });

    expect(damage.events.map((event) => event.kind)).toEqual([
      "combatDamageAssigned",
      "cardMoved",
      "cardMoved",
      "phaseAdvanced",
    ]);
    expect(damage.nextState.shell.phase).toBe("main2");
    expect(damage.nextState.combat.attackers).toEqual([]);
    expect(damage.nextState.combat.blocks).toEqual([]);
    expect(damage.nextState.seats["seat-0"]?.battlefield).toEqual([]);
    expect(damage.nextState.seats["seat-1"]?.battlefield).toEqual([]);
  });

  it("auto-resolves deterministic combat damage after both seats pass in the damage step", () => {
    const state = keepBothOpeningHands();
    state.shell.activeSeat = "seat-0";
    state.shell.phase = "damage";
    state.shell.prioritySeat = "seat-0";
    state.shell.turnNumber = 3;
    state.seats["seat-0"].battlefield = ["seat-0:ember-summoner:battlefield:1"];
    state.seats["seat-1"].battlefield = [];
    state.combat.attackers = [
      {
        attackerId: "seat-0:ember-summoner:battlefield:1",
        defenderSeat: "seat-1",
        laneId: null,
      },
    ];

    const firstPass = applyGameplayIntent(state, {
      intentId: "intent_combat_pass_001",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: state.shell.version,
    });
    const secondPass = applyGameplayIntent(firstPass.nextState, {
      intentId: "intent_combat_pass_002",
      kind: "passPriority",
      matchId: state.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: firstPass.nextState.shell.version,
    });

    expect(secondPass.events.map((event) => event.kind)).toEqual([
      "priorityPassed",
      "combatDamageAssigned",
      "lifeTotalChanged",
      "phaseAdvanced",
    ]);
    expect(secondPass.nextState.seats["seat-1"]?.lifeTotal).toBe(18);
    expect(secondPass.nextState.shell.phase).toBe("main2");
    expect(secondPass.nextState.combat.attackers).toEqual([]);
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

  it.each([
    {
      expectedReason: "staleStateVersion",
      intent: (state: ReturnType<typeof keepBothOpeningHands>) => ({
        intentId: "intent_invalid_001",
        kind: "playCard" as const,
        matchId: state.shell.id,
        payload: {
          alternativeCostId: null,
          cardInstanceId: "seat-0:tidecall-apprentice:deck:1",
          sourceZone: "hand" as const,
          targetSlotId: null,
        },
        seat: "seat-0" as const,
        stateVersion: -1,
      }),
      label: "stale state versions before applying a card play",
    },
    {
      expectedReason: "notPriorityOwner",
      intent: (state: ReturnType<typeof keepBothOpeningHands>) => ({
        intentId: "intent_invalid_002",
        kind: "activateAbility" as const,
        matchId: state.shell.id,
        payload: {
          abilityId: "study-bolt",
          sourceInstanceId: "seat-0:archive-apprentice:battlefield:1",
        },
        seat: "seat-1" as const,
        stateVersion: state.shell.version,
      }),
      label: "ability activations from a seat without priority",
      mutate: (state: ReturnType<typeof keepBothOpeningHands>) => {
        state.seats["seat-0"].battlefield.push(
          "seat-0:archive-apprentice:battlefield:1",
        );
      },
    },
  ])("rejects %s", ({ expectedReason, intent, label: _label, mutate }) => {
    const state = keepBothOpeningHands();
    mutate?.(state);

    const transition = applyGameplayIntent(state, intent(state));

    expect(transition.outcome).toBe("rejected");
    expect(transition.reason).toBe(expectedReason);
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
