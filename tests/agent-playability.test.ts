import {
  createCatalogEntriesForFormat,
  starterFormat,
} from "@lunchtable/card-content";
import type { MatchSeatView, SeatId } from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";

import {
  createDecisionFrame,
  listLegalBotActions,
  planBaselineIntent,
} from "../packages/bot-sdk/src";
import {
  buildPersistedIntentResult,
  buildPersistedMatchBundle,
} from "../convex/lib/matches";
import golden from "./fixtures/agent-playability.standard-alpha.json";

function createParticipantDeck() {
  return {
    mainboard: starterFormat.cardPool.map((card) => ({
      cardId: card.id,
      count: starterFormat.deckRules.maxCopies,
    })),
    sideboard: [],
  };
}

function createPracticeState() {
  const base = buildPersistedMatchBundle({
    activeSeat: "seat-0",
    createdAt: Date.UTC(2026, 3, 3, 16, 0, 0),
    format: starterFormat,
    matchId: "match_agent_playability",
    participants: [
      {
        actorType: "human",
        deck: createParticipantDeck(),
        seat: "seat-0",
        userId: "user_human" as never,
        username: "human",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        actorType: "bot",
        deck: createParticipantDeck(),
        seat: "seat-1",
        userId: "user_bot" as never,
        username: "Table Bot",
      },
    ],
    startedAt: Date.UTC(2026, 3, 3, 16, 0, 0),
    status: "active",
    turnNumber: 1,
  });

  const keepSeat0 = buildPersistedIntentResult({
    events: base.events,
    intent: {
      intentId: "agent_keep_human",
      kind: "keepOpeningHand",
      matchId: base.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: base.shell.version,
    },
    state: base.state,
  });
  const keepSeat1 = buildPersistedIntentResult({
    events: keepSeat0.allEvents,
    intent: {
      intentId: "agent_keep_bot",
      kind: "keepOpeningHand",
      matchId: base.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: keepSeat0.state.shell.version,
    },
    state: keepSeat0.state,
  });

  return keepSeat1;
}

function getSeatView(
  views: ReturnType<typeof buildPersistedIntentResult>["views"],
  seat: SeatId,
) {
  const view = views.find((candidate) => candidate.viewerSeat === seat)?.view;
  if (!view) {
    throw new Error(`Missing seat view for ${seat}`);
  }
  return view;
}

function chooseBotAction(view: MatchSeatView) {
  const frame = createDecisionFrame({
    catalog: createCatalogEntriesForFormat(starterFormat),
    receivedAt: Date.UTC(2026, 3, 3, 16, 0, 0),
    view,
  });
  const plan = planBaselineIntent(frame);
  if (!plan) {
    throw new Error("Expected baseline policy to choose a legal action");
  }
  const action = listLegalBotActions(frame).find(
    (candidate) => candidate.actionId === plan.actionId,
  );
  if (!action) {
    throw new Error(`Missing legal action ${plan.actionId}`);
  }

  return {
    action,
    plan,
  };
}

describe("agent playability", () => {
  it("selects stable legal action ids for mulligan and main-phase contexts", () => {
    const base = buildPersistedMatchBundle({
      activeSeat: "seat-0",
      createdAt: Date.UTC(2026, 3, 3, 16, 0, 0),
      format: starterFormat,
      matchId: "match_agent_playability_mulligan",
      participants: [
        {
          actorType: "human",
          deck: createParticipantDeck(),
          seat: "seat-0",
          userId: "user_human" as never,
          username: "human",
          walletAddress: "0x1111111111111111111111111111111111111111",
        },
        {
          actorType: "bot",
          deck: createParticipantDeck(),
          seat: "seat-1",
          userId: "user_bot" as never,
          username: "Table Bot",
        },
      ],
      startedAt: Date.UTC(2026, 3, 3, 16, 0, 0),
      status: "active",
      turnNumber: 1,
    });
    const kept = createPracticeState();
    const botMulliganView = getSeatView(base.views, "seat-1");
    const mulliganSelection = chooseBotAction(botMulliganView);

    kept.state.shell.activeSeat = "seat-1";
    kept.state.shell.phase = "main1";
    kept.state.shell.prioritySeat = "seat-1";
    kept.state.shell.turnNumber = 2;
    kept.state.seats["seat-1"].resources = [
      {
        current: 3,
        label: "Mana",
        maximum: 3,
        resourceId: "mana",
      },
    ];
    kept.state.seats["seat-1"].hand = [
      "seat-1:ember-summoner:hand:1",
      "seat-1:tidecall-apprentice:hand:1",
    ];
    const mainPhaseView = getSeatView(
      buildPersistedIntentResult({
        events: kept.allEvents,
        intent: {
          intentId: "noop_for_view_refresh",
          kind: "toggleAutoPass",
          matchId: kept.shell.id,
          payload: {
            enabled: false,
          },
          seat: "seat-1",
          stateVersion: kept.state.shell.version,
        },
        state: kept.state,
      }).views,
      "seat-1",
    );
    const mainPhaseSelection = chooseBotAction(mainPhaseView);

    expect({
      mainPhaseActionId: mainPhaseSelection.plan.actionId,
      mainPhaseKind: mainPhaseSelection.action.kind,
      mulliganActionId: mulliganSelection.plan.actionId,
      mulliganKind: mulliganSelection.action.kind,
    }).toEqual(golden.selectedActions);
  });

  it("finishes a deterministic current-format match with a scripted human and a legal-action bot", () => {
    let current = createPracticeState();

    current.state.shell.activeSeat = "seat-0";
    current.state.shell.phase = "main1";
    current.state.shell.prioritySeat = "seat-0";
    current.state.shell.turnNumber = 10;
    current.state.seats["seat-0"].battlefield = [];
    current.state.seats["seat-0"].deck = [];
    current.state.seats["seat-0"].graveyard = [];
    current.state.seats["seat-0"].hand = [
      "seat-0:ember-summoner:hand:1",
      "seat-0:ember-summoner:hand:2",
      "seat-0:ember-summoner:hand:3",
      "seat-0:ember-summoner:hand:4",
      "seat-0:ember-summoner:hand:5",
    ];
    current.state.seats["seat-0"].lifeTotal = 20;
    current.state.seats["seat-0"].resources = [
      {
        current: 10,
        label: "Mana",
        maximum: 10,
        resourceId: "mana",
      },
    ];
    current.state.seats["seat-1"].battlefield = [];
    current.state.seats["seat-1"].deck = [];
    current.state.seats["seat-1"].graveyard = [];
    current.state.seats["seat-1"].hand = [];
    current.state.seats["seat-1"].lifeTotal = 10;
    current.state.seats["seat-1"].resources = [
      {
        current: 0,
        label: "Mana",
        maximum: 0,
        resourceId: "mana",
      },
    ];

    const passBotPriority = () => {
      const botView = getSeatView(current.views, "seat-1");
      const botSelection = chooseBotAction(botView);
      current = buildPersistedIntentResult({
        events: current.allEvents,
        intent: botSelection.action.intent,
        state: current.state,
      });
      expect(current.transition.outcome).toBe("applied");
      expect(botSelection.action.kind).toBe("passPriority");
    };

    const passHumanPriority = () => {
      current = buildPersistedIntentResult({
        events: current.allEvents,
        intent: {
          intentId: `human-pass:${current.state.shell.version}`,
          kind: "passPriority",
          matchId: current.shell.id,
          payload: {},
          seat: "seat-0",
          stateVersion: current.state.shell.version,
        },
        state: current.state,
      });
      expect(current.transition.outcome).toBe("applied");
    };

    for (let copyIndex = 1; copyIndex <= 5; copyIndex += 1) {
      current = buildPersistedIntentResult({
        events: current.allEvents,
        intent: {
          intentId: `human-play:${copyIndex}`,
          kind: "playCard",
          matchId: current.shell.id,
          payload: {
            alternativeCostId: null,
            cardInstanceId: `seat-0:ember-summoner:hand:${copyIndex}`,
            sourceZone: "hand",
            targetSlotId: null,
          },
          seat: "seat-0",
          stateVersion: current.state.shell.version,
        },
        state: current.state,
      });
      expect(current.transition.outcome).toBe("applied");

      passBotPriority();
      passHumanPriority();
      passHumanPriority();
      passBotPriority();
    }

    const seat0 = current.state.seats["seat-0"];
    const seat1 = current.state.seats["seat-1"];

    expect({
      seat0BattlefieldCount: seat0.battlefield.length,
      seat0LifeTotal: seat0.lifeTotal,
      seat1LifeTotal: seat1.lifeTotal,
      status: current.state.shell.status,
      turnNumber: current.state.shell.turnNumber,
      winnerSeat: current.state.shell.winnerSeat,
    }).toEqual(golden.fullMatch);
  });
});
