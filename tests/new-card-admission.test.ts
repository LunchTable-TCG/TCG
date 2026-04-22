import {
  createAgentMatchContext,
  createDecisionFrame,
  listLegalBotActions,
} from "@lunchtable/bot-sdk";
import {
  createCatalogEntriesForFormat,
  starterFormat,
  validateCardReasoningMetadata,
  validateDeckForFormat,
} from "@lunchtable/card-content";
import {
  type CardDefinition,
  type FormatDefinition,
  createMatchShellFromState,
  createSeatView,
} from "@lunchtable/game-core";
import { describe, expect, it } from "vitest";

import {
  buildPersistedIntentResult,
  buildPersistedMatchBundle,
} from "../convex/lib/matches";
import golden from "./fixtures/new-card-admission.standard-alpha.json";

const admissionCard: CardDefinition = {
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
      id: "rally-signal",
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
      text: "Pay 1 mana: Target friendly unit gains haste until end of turn.",
    },
  ],
  cost: 2,
  id: "signal-ace",
  keywords: ["haste"],
  kind: "unit",
  name: "Signal Ace",
  rarity: "common",
  rulesText: [
    "Haste",
    "Pay 1 mana: Target friendly unit gains haste until end of turn.",
  ],
  setId: "core-alpha",
  stats: {
    power: 2,
    toughness: 1,
  },
};

function createAdmissionFormat(): FormatDefinition {
  return {
    ...starterFormat,
    cardPool: [...starterFormat.cardPool, admissionCard],
  };
}

function createParticipantDeck(format: FormatDefinition) {
  return {
    mainboard: format.cardPool.map((card) => ({
      cardId: card.id,
      count: format.deckRules.maxCopies,
    })),
    sideboard: [],
  };
}

function createActiveState(format: FormatDefinition) {
  const bundle = buildPersistedMatchBundle({
    activeSeat: "seat-0",
    createdAt: Date.UTC(2026, 3, 3, 19, 0, 0),
    format,
    matchId: "match_new_card_admission",
    participants: [
      {
        actorType: "human",
        deck: createParticipantDeck(format),
        seat: "seat-0",
        userId: "user_human" as never,
        username: "human",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        actorType: "bot",
        deck: createParticipantDeck(format),
        seat: "seat-1",
        userId: "user_bot" as never,
        username: "Table Bot",
      },
    ],
    startedAt: Date.UTC(2026, 3, 3, 19, 0, 0),
    status: "active",
    turnNumber: 1,
  });

  const keepSeat0 = buildPersistedIntentResult({
    events: bundle.events,
    intent: {
      intentId: "intent_admission_keep_human",
      kind: "keepOpeningHand",
      matchId: bundle.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: bundle.shell.version,
    },
    state: bundle.state,
  });
  const keepSeat1 = buildPersistedIntentResult({
    events: keepSeat0.allEvents,
    intent: {
      intentId: "intent_admission_keep_bot",
      kind: "keepOpeningHand",
      matchId: bundle.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: keepSeat0.state.shell.version,
    },
    state: keepSeat0.state,
  });

  keepSeat1.state.shell.activeSeat = "seat-1";
  keepSeat1.state.shell.phase = "main1";
  keepSeat1.state.shell.prioritySeat = "seat-1";
  keepSeat1.state.shell.turnNumber = 2;
  keepSeat1.state.seats["seat-1"].resources = [
    {
      current: 3,
      label: "Mana",
      maximum: 3,
      resourceId: "mana",
    },
  ];

  return keepSeat1.state;
}

function createSeatContextView(
  format: FormatDefinition,
  configure: (
    state: ReturnType<typeof createActiveState>,
  ) => ReturnType<typeof createActiveState>,
) {
  const state = configure(createActiveState(format));
  state.shell = createMatchShellFromState(state);
  return createSeatView(state, "seat-1", []);
}

describe("new card admission", () => {
  it("validates metadata and deck legality for an added current-format card", () => {
    const format = createAdmissionFormat();
    const catalog = createCatalogEntriesForFormat(format);
    const collectionCounts = Object.fromEntries(
      format.cardPool.map((card) => [card.id, format.deckRules.maxCopies]),
    );
    const entry = catalog.find((card) => card.cardId === admissionCard.id);

    expect(validateCardReasoningMetadata(catalog)).toEqual([]);
    expect(entry).toMatchObject(golden.catalogEntry);
    expect(
      validateDeckForFormat({
        catalog,
        collectionCounts,
        format,
        mainboard: createParticipantDeck(format).mainboard,
        sideboard: [],
      }).isLegal,
    ).toBe(true);
  });

  it("passes admitted cards through agent context and legal-action generation", () => {
    const format = createAdmissionFormat();
    const catalog = createCatalogEntriesForFormat(format);

    const handView = createSeatContextView(format, (state) => {
      state.seats["seat-1"].hand = ["seat-1:signal-ace:hand:1"];
      state.seats["seat-1"].battlefield = [];
      return state;
    });
    const handFrame = createDecisionFrame({
      catalog,
      receivedAt: Date.UTC(2026, 3, 3, 19, 0, 5),
      view: handView,
    });
    const handContext = createAgentMatchContext({
      catalog,
      receivedAt: Date.UTC(2026, 3, 3, 19, 0, 5),
      view: handView,
    });

    expect(
      handContext.visibleCards.find((card) => card.card.cardId === "signal-ace")
        ?.card.reasoning,
    ).toMatchObject(golden.catalogEntry.reasoning);
    expect(
      listLegalBotActions(handFrame).map((action) => action.machineLabel),
    ).toContain(golden.playMachineLabel);

    const activationView = createSeatContextView(format, (state) => {
      state.seats["seat-1"].hand = [];
      state.seats["seat-1"].battlefield = [
        "seat-1:signal-ace:battlefield:1",
        "seat-1:tidecall-apprentice:battlefield:1",
      ];
      state.seats["seat-1"].resources = [
        {
          current: 1,
          label: "Mana",
          maximum: 1,
          resourceId: "mana",
        },
      ];
      return state;
    });
    const activationFrame = createDecisionFrame({
      catalog,
      receivedAt: Date.UTC(2026, 3, 3, 19, 0, 10),
      view: activationView,
    });

    expect(
      listLegalBotActions(activationFrame).map((action) => action.machineLabel),
    ).toContain(golden.activateMachineLabel);
  });
});
