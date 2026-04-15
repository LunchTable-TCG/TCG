import { starterFormat } from "@lunchtable/card-content";
import { describe, expect, it } from "vitest";

import {
  buildPersistedMatchBundle,
  deserializeMatchEvent,
  deserializeMatchShell,
  deserializeMatchState,
  deserializeSeatView,
  deserializeSpectatorView,
} from "../convex/lib/matches";
import {
  createReplayFrame,
  deserializeReplayFrames,
} from "../convex/lib/replays";

function createBundle() {
  return buildPersistedMatchBundle({
    activeSeat: "seat-0",
    createdAt: Date.UTC(2026, 3, 3, 12, 0, 0),
    format: starterFormat,
    matchId: "match_deserialize_1",
    participants: [
      {
        actorType: "human",
        deck: {
          mainboard: starterFormat.cardPool.map((card) => ({
            cardId: card.id,
            count: starterFormat.deckRules.maxCopies,
          })),
          sideboard: [],
        },
        seat: "seat-0",
        userId: "user_host" as never,
        username: "host",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        actorType: "human",
        deck: {
          mainboard: starterFormat.cardPool.map((card) => ({
            cardId: card.id,
            count: starterFormat.deckRules.maxCopies,
          })),
          sideboard: [],
        },
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

function getInitialEvent(bundle: ReturnType<typeof createBundle>) {
  const event = bundle.events[0];
  if (!event) {
    throw new Error("Expected persisted test bundle to include an event.");
  }

  return event;
}

describe("persisted match deserializers", () => {
  it("round-trips valid persisted shapes", () => {
    const bundle = createBundle();
    const seatView = bundle.views[0];
    if (!seatView) {
      throw new Error("Expected a persisted seat view.");
    }

    expect(deserializeMatchShell(JSON.stringify(bundle.shell)).id).toBe(
      bundle.shell.id,
    );
    expect(deserializeMatchState(JSON.stringify(bundle.state)).shell.id).toBe(
      bundle.state.shell.id,
    );
    expect(
      deserializeMatchEvent(JSON.stringify(getInitialEvent(bundle))).kind,
    ).toBe("matchCreated");
    expect(deserializeSeatView(JSON.stringify(seatView.view)).viewerSeat).toBe(
      seatView.viewerSeat,
    );
    expect(
      deserializeSpectatorView(JSON.stringify(bundle.spectatorView)).kind,
    ).toBe("spectator");
  });

  it("rejects invalid persisted match payloads", () => {
    const bundle = createBundle();
    const invalidShell = {
      ...bundle.shell,
      status: "broken",
    };
    const invalidState = {
      ...bundle.state,
      random: {
        ...bundle.state.random,
        cursor: "bad",
      },
    };
    const invalidEvent = {
      ...getInitialEvent(bundle),
      payload: {
        shell: {
          ...bundle.shell,
          phase: "bogus",
        },
      },
    };

    expect(() => deserializeMatchShell(JSON.stringify(invalidShell))).toThrow(
      /Invalid match shell.status/,
    );
    expect(() => deserializeMatchState(JSON.stringify(invalidState))).toThrow(
      /Invalid match state.random.cursor/,
    );
    expect(() => deserializeMatchEvent(JSON.stringify(invalidEvent))).toThrow(
      /Invalid match event.payload.shell.phase/,
    );
  });

  it("rejects invalid replay frame payloads", () => {
    const bundle = createBundle();
    const frame = createReplayFrame({
      event: getInitialEvent(bundle),
      frameIndex: 0,
      view: bundle.spectatorView,
    });
    const invalidFrames = [
      {
        ...frame,
        eventKind: "not-an-event",
      },
    ];

    expect(deserializeReplayFrames(JSON.stringify([frame]))).toHaveLength(1);
    expect(() =>
      deserializeReplayFrames(JSON.stringify(invalidFrames)),
    ).toThrow(/Invalid replay frames\[0\].eventKind/);
  });
});
