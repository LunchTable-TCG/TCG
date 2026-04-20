import type { MatchEvent } from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";

import { createGameState } from "./engine";
import { createSeatView, createSpectatorView } from "./views";

function createMatchCreatedEvent(
  matchId: string,
): Extract<MatchEvent, { kind: "matchCreated" }> {
  return {
    at: 0,
    eventId: "event_1",
    kind: "matchCreated",
    matchId,
    payload: {
      shell: createGameState({ matchId }).shell,
    },
    sequence: 1,
    stateVersion: 1,
  };
}

describe("match view projections", () => {
  it("keeps private deck order visible only to the owning seat", () => {
    const state = createGameState({
      matchId: "match_test",
      seatActors: [
        {
          seat: "seat-0",
          username: "alpha",
        },
        {
          seat: "seat-1",
          username: "beta",
        },
      ],
    });

    state.seats["seat-0"].deck = [
      "seat-0:archive-apprentice:deck:1",
      "seat-0:ember-summoner:deck:2",
    ];
    state.seats["seat-1"].deck = ["seat-1:mirror-warden:deck:1"];
    state.shell.seats = state.shell.seats.map((seat) =>
      seat.seat === "seat-0"
        ? { ...seat, deckCount: 2, username: "alpha" }
        : { ...seat, deckCount: 1, username: "beta" },
    );

    const seatView = createSeatView(state, "seat-0", [
      createMatchCreatedEvent(state.shell.id),
    ]);
    const spectatorView = createSpectatorView(state, [
      createMatchCreatedEvent(state.shell.id),
    ]);

    const ownDeck = seatView.zones.find(
      (zone) => zone.ownerSeat === "seat-0" && zone.zone === "deck",
    );
    const opposingDeck = seatView.zones.find(
      (zone) => zone.ownerSeat === "seat-1" && zone.zone === "deck",
    );
    const spectatorDeck = spectatorView.zones.find(
      (zone) => zone.ownerSeat === "seat-0" && zone.zone === "deck",
    );

    expect(ownDeck?.cards).toHaveLength(2);
    expect(ownDeck?.cardCount).toBe(2);
    expect(opposingDeck?.cards).toHaveLength(0);
    expect(opposingDeck?.cardCount).toBe(1);
    expect(spectatorDeck?.cards).toHaveLength(0);
    expect(spectatorDeck?.cardCount).toBe(2);
  });

  it("limits spectator actions while preserving recent event summaries", () => {
    const state = createGameState({
      matchId: "match_test",
    });
    const spectatorView = createSpectatorView(state, [
      createMatchCreatedEvent(state.shell.id),
    ]);

    expect(spectatorView.availableIntents).toEqual([]);
    expect(spectatorView.prompt).toBeNull();
    expect(spectatorView.recentEvents).toEqual([
      {
        kind: "matchCreated",
        label: "Match created",
        seat: null,
        sequence: 1,
      },
    ]);
  });

  it("enriches recent event summaries with card context for UI hero moments", () => {
    const state = createGameState({
      matchId: "match_event_context",
    });

    state.cardCatalog = {
      "archive-apprentice": {
        abilities: [
          {
            costs: [],
            effect: [],
            id: "study-bolt",
            kind: "activated",
            speed: "fast",
            text: "Deal 1 damage.",
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
    };

    const seatView = createSeatView(state, "seat-0", [
      {
        at: 1,
        eventId: "event_play",
        kind: "cardPlayed",
        matchId: state.shell.id,
        payload: {
          cardInstanceId: "seat-0:archive-apprentice:hand:1",
          seat: "seat-0",
          toZone: "battlefield",
        },
        sequence: 2,
        stateVersion: 2,
      },
      {
        at: 2,
        eventId: "event_ability",
        kind: "abilityActivated",
        matchId: state.shell.id,
        payload: {
          abilityId: "study-bolt",
          seat: "seat-0",
          sourceInstanceId: "seat-0:archive-apprentice:battlefield:1",
        },
        sequence: 3,
        stateVersion: 3,
      },
    ]);

    expect(seatView.recentEvents).toEqual([
      {
        cardId: "archive-apprentice",
        cardName: "Archive Apprentice",
        focusInstanceId: "seat-0:archive-apprentice:hand:1",
        kind: "cardPlayed",
        label: "Played Archive Apprentice",
        seat: "seat-0",
        sequence: 2,
        toZone: "battlefield",
      },
      {
        abilityId: "study-bolt",
        cardId: "archive-apprentice",
        cardName: "Archive Apprentice",
        focusInstanceId: "seat-0:archive-apprentice:battlefield:1",
        kind: "abilityActivated",
        label: "Archive Apprentice activated study-bolt",
        seat: "seat-0",
        sequence: 3,
      },
    ]);
  });

  it("projects continuous stat modifiers onto battlefield card views", () => {
    const state = createGameState({
      matchId: "match_buffs",
    });

    state.cardCatalog = {
      "banner-captain": {
        abilities: [
          {
            effect: {
              kind: "modifyStats",
              modifier: {
                power: 1,
                toughness: 1,
              },
              target: "friendlyUnits",
            },
            id: "captains-aura",
            kind: "static",
            layer: "statModifiers",
            text: "Other friendly units get +1/+1.",
          },
        ],
        cardId: "banner-captain",
        cost: 3,
        kind: "unit",
        keywords: [],
        name: "Banner Captain",
        stats: {
          power: 2,
          toughness: 4,
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
    };
    state.seats["seat-0"].battlefield = [
      "seat-0:banner-captain:battlefield:1",
      "seat-0:tidecall-apprentice:battlefield:1",
    ];

    const seatView = createSeatView(state, "seat-0", []);
    const spectatorView = createSpectatorView(state, []);
    const seatCard = seatView.zones
      .find(
        (zone) => zone.ownerSeat === "seat-0" && zone.zone === "battlefield",
      )
      ?.cards.find((card) => card.cardId === "tidecall-apprentice");
    const spectatorCard = spectatorView.zones
      .find(
        (zone) => zone.ownerSeat === "seat-0" && zone.zone === "battlefield",
      )
      ?.cards.find((card) => card.cardId === "tidecall-apprentice");
    const captainCard = seatView.zones
      .find(
        (zone) => zone.ownerSeat === "seat-0" && zone.zone === "battlefield",
      )
      ?.cards.find((card) => card.cardId === "banner-captain");

    expect(seatCard?.statLine).toEqual({
      power: 2,
      toughness: 3,
    });
    expect(spectatorCard?.statLine).toEqual({
      power: 2,
      toughness: 3,
    });
    expect(captainCard?.statLine).toEqual({
      power: 2,
      toughness: 4,
    });
  });

  it("treats exile as a public zone for both seats and spectators", () => {
    const state = createGameState({
      matchId: "match_exile",
    });

    state.cardCatalog = {
      "mirror-warden": {
        abilities: [],
        cardId: "mirror-warden",
        cost: 3,
        kind: "unit",
        keywords: ["ward1"],
        name: "Mirror Warden",
        stats: {
          power: 2,
          toughness: 3,
        },
      },
    };
    state.seats["seat-0"].exile = ["seat-0:mirror-warden:battlefield:1"];

    const seatView = createSeatView(state, "seat-1", []);
    const spectatorView = createSpectatorView(state, []);
    const seatExile = seatView.zones.find(
      (zone) => zone.ownerSeat === "seat-0" && zone.zone === "exile",
    );
    const spectatorExile = spectatorView.zones.find(
      (zone) => zone.ownerSeat === "seat-0" && zone.zone === "exile",
    );

    expect(seatExile?.cardCount).toBe(1);
    expect(seatExile?.cards).toHaveLength(1);
    expect(spectatorExile?.cardCount).toBe(1);
    expect(spectatorExile?.cards).toHaveLength(1);
  });
});
