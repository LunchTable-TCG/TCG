import type { MatchSeatView } from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";

import {
  createBoardSceneModel,
  deriveBoardCue,
} from "../packages/render-pixi/src";

function createSeatView(): MatchSeatView {
  return {
    availableIntents: ["activateAbility", "playCard", "passPriority"],
    combat: {
      attackers: [],
      blocks: [],
    },
    kind: "seat",
    match: {
      activeSeat: "seat-0",
      completedAt: null,
      createdAt: 0,
      format: {
        boardModel: "openBoard",
        deckRules: {
          maxCopies: 4,
          minCards: 40,
          sideboardSize: 15,
        },
        id: "core-demo",
        name: "Core Demo",
        resourceModel: "manaCurve",
        timingModel: "fullStack",
        turnModel: "alternating",
        version: "0.0.1",
        victoryModel: "lifeTotal",
      },
      id: "match_render",
      lastEventNumber: 4,
      phase: "attack",
      prioritySeat: "seat-1",
      seats: [],
      spectatorCount: 0,
      startedAt: 0,
      status: "active",
      timers: {
        activeDeadlineAt: null,
        ropeDeadlineAt: null,
        seatTimeRemainingMs: {},
        turnStartedAt: null,
      },
      turnNumber: 2,
      version: 7,
      winnerSeat: null,
    },
    prompt: null,
    recentEvents: [
      {
        kind: "cardPlayed",
        label: "Archive Apprentice entered the stack.",
        seat: "seat-0",
        sequence: 3,
      },
      {
        kind: "stackObjectCreated",
        label: "Archive Apprentice is waiting on the stack.",
        seat: "seat-0",
        sequence: 4,
      },
    ],
    seats: [
      {
        actorType: "human",
        autoPassEnabled: false,
        deckCount: 38,
        graveyardCount: 0,
        handCount: 4,
        hasPriority: false,
        isActiveTurn: false,
        lifeTotal: 17,
        resources: [
          {
            current: 2,
            label: "Mana",
            maximum: 2,
            resourceId: "mana",
          },
        ],
        seat: "seat-1",
        status: "active",
        username: "beta",
      },
      {
        actorType: "human",
        autoPassEnabled: false,
        deckCount: 35,
        graveyardCount: 1,
        handCount: 3,
        hasPriority: true,
        isActiveTurn: true,
        lifeTotal: 20,
        resources: [
          {
            current: 3,
            label: "Mana",
            maximum: 3,
            resourceId: "mana",
          },
        ],
        seat: "seat-0",
        status: "active",
        username: "alpha",
      },
    ],
    stack: [
      {
        controllerSeat: "seat-0",
        label: "Archive Apprentice",
        sourceInstanceId: "seat-0:archive-apprentice:stack:1",
        stackId: "stack_1",
        targetLabels: [],
      },
    ],
    viewerSeat: "seat-0",
    zones: [
      {
        cards: [
          {
            annotations: [],
            cardId: "mirror-warden",
            controllerSeat: "seat-1",
            counters: {},
            instanceId: "seat-1:mirror-warden:battlefield:1",
            isTapped: false,
            keywords: ["ward"],
            name: "Mirror Warden",
            ownerSeat: "seat-1",
            slotId: null,
            statLine: {
              power: 2,
              toughness: 4,
            },
            visibility: "public",
            zone: "battlefield",
          },
        ],
        cardCount: 1,
        ownerSeat: "seat-1",
        visibility: "public",
        zone: "battlefield",
      },
      {
        cards: [],
        cardCount: 4,
        ownerSeat: "seat-1",
        visibility: "count-only",
        zone: "hand",
      },
      {
        cards: [
          {
            annotations: [],
            cardId: "archive-apprentice",
            controllerSeat: "seat-0",
            counters: {},
            instanceId: "seat-0:archive-apprentice:battlefield:1",
            isTapped: false,
            keywords: ["haste"],
            name: "Archive Apprentice",
            ownerSeat: "seat-0",
            slotId: null,
            statLine: {
              power: 1,
              toughness: 3,
            },
            visibility: "public",
            zone: "battlefield",
          },
        ],
        cardCount: 1,
        ownerSeat: "seat-0",
        visibility: "public",
        zone: "battlefield",
      },
      {
        cards: [
          {
            annotations: [],
            cardId: "ember-scribe",
            controllerSeat: "seat-0",
            counters: {},
            instanceId: "seat-0:ember-scribe:hand:1",
            isTapped: false,
            keywords: [],
            name: "Ember Scribe",
            ownerSeat: "seat-0",
            slotId: null,
            statLine: {
              power: 2,
              toughness: 2,
            },
            visibility: "private-self",
            zone: "hand",
          },
        ],
        cardCount: 3,
        ownerSeat: "seat-0",
        visibility: "private-self",
        zone: "hand",
      },
    ],
  };
}

describe("match renderer model", () => {
  it("places the viewer seat on the home lane and preserves hidden opponent hands", () => {
    const view = createSeatView();

    const scene = createBoardSceneModel({
      selectedCardId: "seat-0:ember-scribe:hand:1",
      view,
      viewport: {
        height: 500,
        width: 900,
      },
    });

    expect(scene.homeSeat?.seat).toBe("seat-0");
    expect(
      scene.visibleCards.some(
        (card) => card.instanceId === "seat-0:ember-scribe:hand:1",
      ),
    ).toBe(true);
    expect(
      scene.visibleCards.filter(
        (card) =>
          card.controllerSeat === "seat-1" &&
          card.zone === "hand" &&
          card.label === "Hidden card",
      ),
    ).toHaveLength(4);
    expect(scene.stack).toHaveLength(1);
  });

  it("derives stack cues from the latest event summary", () => {
    const cue = deriveBoardCue(createSeatView().recentEvents, "main1");

    expect(cue).toEqual({
      accentSeat: "seat-0",
      eventSequence: 4,
      kind: "stack",
      label: "Archive Apprentice is waiting on the stack.",
    });
  });

  it("falls back to a combat cue when the board enters attack without a newer event", () => {
    const cue = deriveBoardCue([], "attack");

    expect(cue).toEqual({
      accentSeat: null,
      eventSequence: 0,
      kind: "combat",
      label: "Combat window · attack",
    });
  });
});
