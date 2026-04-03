import type {
  CardCatalogEntry,
  MatchSeatView,
  MatchSpectatorView,
} from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";

import {
  getZoneView,
  listActivatedAbilityActions,
  resolveRenderableView,
} from "../apps/web/src/components/match/model";

function createSeatView(): MatchSeatView {
  return {
    availableIntents: ["activateAbility", "concede", "toggleAutoPass"],
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
      id: "match_ui",
      lastEventNumber: 1,
      phase: "main1",
      prioritySeat: "seat-0",
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
      turnNumber: 1,
      version: 3,
      winnerSeat: null,
    },
    prompt: null,
    recentEvents: [],
    seats: [
      {
        actorType: "human",
        autoPassEnabled: false,
        deckCount: 40,
        graveyardCount: 0,
        handCount: 5,
        hasPriority: true,
        isActiveTurn: true,
        lifeTotal: 20,
        resources: [],
        seat: "seat-0",
        status: "active",
        username: "alpha",
      },
    ],
    stack: [],
    viewerSeat: "seat-0",
    zones: [
      {
        cards: [
          {
            annotations: [],
            cardId: "archive-apprentice",
            controllerSeat: "seat-0",
            counters: {},
            instanceId: "seat-0:archive-apprentice:battlefield:1",
            isTapped: false,
            keywords: [],
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
    ],
  };
}

function createSpectatorView(): MatchSpectatorView {
  return {
    availableIntents: [],
    kind: "spectator",
    match: createSeatView().match,
    prompt: null,
    recentEvents: [],
    seats: [],
    stack: [],
    zones: [],
  };
}

describe("web match model helpers", () => {
  it("falls back to spectator mode when a seat projection is unavailable", () => {
    const spectatorView = createSpectatorView();

    const resolved = resolveRenderableView({
      preferredMode: "seat",
      seatView: null,
      spectatorView,
    });

    expect(resolved.mode).toBe("spectator");
    expect(resolved.view).toBe(spectatorView);
  });

  it("lists only activated abilities for cards on the viewer battlefield", () => {
    const view = createSeatView();
    const catalog: CardCatalogEntry[] = [
      {
        abilities: [
          {
            id: "study-bolt",
            kind: "activated",
            requiresTargets: false,
            resourceCost: 1,
            speed: "slow",
            text: "Pay 1 mana: Draw a card.",
          },
          {
            id: "entry-spark",
            kind: "triggered",
            requiresTargets: false,
            resourceCost: null,
            speed: null,
            text: "When this enters, deal 2 damage.",
          },
        ],
        cardId: "archive-apprentice",
        cost: 2,
        formatId: "core-demo",
        isBanned: false,
        keywords: [],
        kind: "unit",
        name: "Archive Apprentice",
        rarity: "common",
        rulesText: [],
        setId: "core-alpha",
        stats: {
          power: 1,
          toughness: 3,
        },
      },
    ];

    expect(listActivatedAbilityActions(catalog, view)).toEqual([
      {
        abilityId: "study-bolt",
        cardName: "Archive Apprentice",
        instanceId: "seat-0:archive-apprentice:battlefield:1",
        text: "Pay 1 mana: Draw a card.",
      },
    ]);
    expect(getZoneView(view, "seat-0", "battlefield")?.cardCount).toBe(1);
  });
});
