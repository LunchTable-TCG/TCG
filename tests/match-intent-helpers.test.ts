import { starterFormat } from "@lunchtable/card-content";
import { describe, expect, it } from "vitest";

import {
  buildPersistedIntentResult,
  buildPersistedMatchBundle,
} from "../convex/lib/matches";
import { buildStarterDeck } from "./helpers/starterDeck";

function createActiveBundle() {
  return buildPersistedMatchBundle({
    activeSeat: "seat-0",
    createdAt: Date.UTC(2026, 3, 3, 12, 0, 0),
    format: starterFormat,
    matchId: "match_intent_bundle",
    participants: [
      {
        actorType: "human",
        deck: buildStarterDeck(),
        seat: "seat-0",
        userId: "user_host" as never,
        username: "host",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        actorType: "human",
        deck: buildStarterDeck(),
        seat: "seat-1",
        userId: "user_guest" as never,
        username: "guest",
        walletAddress: "0x2222222222222222222222222222222222222222",
      },
    ],
    startedAt: Date.UTC(2026, 3, 3, 12, 0, 0),
    status: "active",
    turnNumber: 1,
  });
}

describe("persisted intent helpers", () => {
  it("rebuilds seat and spectator views after a successful intent", () => {
    const bundle = createActiveBundle();

    const keepSeat0 = buildPersistedIntentResult({
      events: bundle.events,
      intent: {
        intentId: "intent_keep_001",
        kind: "keepOpeningHand",
        matchId: bundle.shell.id,
        payload: {},
        seat: "seat-0",
        stateVersion: bundle.shell.version,
      },
      state: bundle.state,
    });

    expect(keepSeat0.transition.outcome).toBe("applied");
    expect(keepSeat0.allEvents.at(-1)?.kind).toBe("promptResolved");
    expect(
      keepSeat0.views.find((view) => view.viewerSeat === "seat-0")?.view.prompt,
    ).toBeNull();
    expect(
      keepSeat0.views.find((view) => view.viewerSeat === "seat-1")?.view.prompt
        ?.kind,
    ).toBe("mulligan");
    expect(keepSeat0.spectatorView.prompt).toBeNull();
  });

  it("returns a typed rejection without mutating the event stream", () => {
    const bundle = createActiveBundle();

    const rejected = buildPersistedIntentResult({
      events: bundle.events,
      intent: {
        intentId: "intent_bad_play_001",
        kind: "playCard",
        matchId: bundle.shell.id,
        payload: {
          alternativeCostId: null,
          cardInstanceId: "seat-0:archive-apprentice:deck:1",
          sourceZone: "hand",
          targetSlotId: null,
        },
        seat: "seat-0",
        stateVersion: bundle.shell.version,
      },
      state: bundle.state,
    });

    expect(rejected.transition.outcome).toBe("rejected");
    expect(rejected.transition.reason).toBe("invalidPhase");
    expect(rejected.allEvents).toHaveLength(bundle.events.length);
    expect(rejected.state).toEqual(bundle.state);
  });

  it("rebuilds the stack rail after a cast enters the response window", () => {
    const bundle = createActiveBundle();
    const keepSeat0 = buildPersistedIntentResult({
      events: bundle.events,
      intent: {
        intentId: "intent_keep_stack_001",
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
        intentId: "intent_keep_stack_002",
        kind: "keepOpeningHand",
        matchId: bundle.shell.id,
        payload: {},
        seat: "seat-1",
        stateVersion: keepSeat0.state.shell.version,
      },
      state: keepSeat0.state,
    });

    keepSeat1.state.seats["seat-0"].resources = [
      {
        current: 10,
        label: "Mana",
        maximum: 10,
        resourceId: "mana",
      },
    ];

    const cardInstanceId = keepSeat1.state.seats["seat-0"].hand[0];
    if (!cardInstanceId) {
      throw new Error("Expected opening hand to contain a card");
    }

    const castResult = buildPersistedIntentResult({
      events: keepSeat1.allEvents,
      intent: {
        intentId: "intent_stack_cast_001",
        kind: "playCard",
        matchId: bundle.shell.id,
        payload: {
          alternativeCostId: null,
          cardInstanceId,
          sourceZone: "hand",
          targetSlotId: null,
        },
        seat: "seat-0",
        stateVersion: keepSeat1.state.shell.version,
      },
      state: keepSeat1.state,
    });

    expect(castResult.transition.outcome).toBe("applied");
    expect(castResult.appendedEvents.map((event) => event.kind)).toEqual([
      "cardPlayed",
      "stackObjectCreated",
    ]);
    expect(
      castResult.views.find((view) => view.viewerSeat === "seat-0")?.view.stack,
    ).toHaveLength(1);
    expect(castResult.shell.prioritySeat).toBe("seat-1");
  });
});
