import type {
  MatchSeatView,
  MatchSpectatorView,
} from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";

import { summarizeTableParity } from "../apps/web/src/components/match/MatchShell";

function createSeatView(): MatchSeatView {
  return {
    availableIntents: ["passPriority"],
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
      {
        actorType: "bot",
        autoPassEnabled: true,
        deckCount: 40,
        graveyardCount: 0,
        handCount: 5,
        hasPriority: false,
        isActiveTurn: false,
        lifeTotal: 20,
        resources: [],
        seat: "seat-1",
        status: "active",
        username: "milady-bot",
      },
    ],
    stack: [],
    viewerSeat: "seat-0",
    zones: [],
  };
}

function createSpectatorView(): MatchSpectatorView {
  return {
    availableIntents: [],
    kind: "spectator",
    match: createSeatView().match,
    prompt: null,
    recentEvents: [],
    seats: createSeatView().seats,
    stack: [],
    zones: [],
  };
}

describe("match shell table parity summary", () => {
  it("reports mixed human and agent seats for a live seat view", () => {
    expect(summarizeTableParity(createSeatView())).toEqual({
      accessSummary:
        "Controlling seat-0 through the same live intent rail every legal player seat uses.",
      agentSeats: 1,
      humanSeats: 1,
      paritySummary:
        "Human and agent seats share the same prompts, timers, and authoritative reducer.",
    });
  });

  it("reports spectator access as public-only", () => {
    expect(summarizeTableParity(createSpectatorView()).accessSummary).toBe(
      "Watching the public projection only. Spectator mode cannot submit gameplay intents.",
    );
  });
});
