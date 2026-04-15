import { createMatchSkeleton } from "@lunchtable/game-core";
import type {
  GameplayIntent,
  MatchEvent,
  MatchSeatView,
  MatchTelemetryEvent,
} from "@lunchtable/shared-types";
import {
  AUTHORITATIVE_INTENT_KINDS,
  MATCH_EVENT_KINDS,
  MATCH_PHASES,
  MATCH_TELEMETRY_EVENT_NAMES,
  assertMatchSeatId,
} from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";

describe("shared domain types", () => {
  it("exports the default gameplay contract constants", () => {
    expect(MATCH_PHASES).toContain("mulligan");
    expect(AUTHORITATIVE_INTENT_KINDS).toContain("playCard");
    expect(MATCH_EVENT_KINDS).toContain("matchCompleted");
    expect(MATCH_TELEMETRY_EVENT_NAMES).toContain("match.intent.accepted");
  });

  it("supports a seat-scoped view, gameplay intent, and event envelope", () => {
    const match = createMatchSkeleton();
    const seatView: MatchSeatView = {
      availableIntents: ["passPriority", "toggleAutoPass"],
      kind: "seat",
      match: {
        ...match,
        phase: "main1",
        prioritySeat: "seat-0",
        startedAt: 10,
        status: "active",
        turnNumber: 1,
      },
      prompt: null,
      recentEvents: [
        {
          kind: "phaseAdvanced",
          label: "Advanced to main phase",
          seat: null,
          sequence: 1,
        },
      ],
      seats: [
        {
          actorType: "human",
          autoPassEnabled: false,
          deckCount: 30,
          graveyardCount: 0,
          handCount: 7,
          hasPriority: true,
          isActiveTurn: true,
          lifeTotal: 20,
          resources: [
            {
              current: 1,
              label: "Mana",
              maximum: 1,
              resourceId: "mana",
            },
          ],
          seat: "seat-0",
          status: "active",
          username: "tablemage",
        },
        {
          actorType: "bot",
          autoPassEnabled: true,
          deckCount: 30,
          graveyardCount: 0,
          handCount: 7,
          hasPriority: false,
          isActiveTurn: false,
          lifeTotal: 20,
          resources: [],
          seat: "seat-1",
          status: "active",
          username: "sparring-bot",
        },
      ],
      stack: [],
      viewerSeat: "seat-0",
      zones: [],
    };

    const intent: GameplayIntent = {
      intentId: "intent_001",
      kind: "passPriority",
      matchId: seatView.match.id,
      payload: {},
      seat: seatView.viewerSeat,
      stateVersion: seatView.match.version,
    };

    const event: MatchEvent = {
      at: 100,
      eventId: "event_001",
      kind: "phaseAdvanced",
      matchId: seatView.match.id,
      payload: {
        from: "mulligan",
        to: "ready",
      },
      sequence: 1,
      stateVersion: seatView.match.version + 1,
    };

    const telemetryEvent: MatchTelemetryEvent = {
      at: 101,
      matchId: seatView.match.id,
      metrics: {
        latencyMs: 4,
      },
      name: "match.intent.accepted",
      seat: seatView.viewerSeat,
      tags: {
        surface: "unit-test",
      },
      userId: null,
    };

    expect(seatView.availableIntents).toEqual([
      "passPriority",
      "toggleAutoPass",
    ]);
    expect(intent.kind).toBe("passPriority");
    expect(event.payload.to).toBe("ready");
    expect(telemetryEvent.metrics?.latencyMs).toBe(4);
  });

  it("accepts only gameplay seat ids", () => {
    expect(assertMatchSeatId("seat-0")).toBe("seat-0");
    expect(assertMatchSeatId("seat-1")).toBe("seat-1");
    expect(() => assertMatchSeatId("seat-2")).toThrow(
      "Unsupported match seat: seat-2",
    );
  });
});
