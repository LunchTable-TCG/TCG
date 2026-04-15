import { starterFormat } from "@lunchtable/card-content";
import { describe, expect, it } from "vitest";

import {
  buildPersistedIntentResult,
  buildPersistedMatchBundle,
} from "../convex/lib/matches";
import {
  createReplayFrame,
  selectReplayAnchorEvent,
} from "../convex/lib/replays";
import replayGolden from "./fixtures/replay-golden.standard-alpha.json";

describe("replay golden", () => {
  it("matches the stable spectator-frame sequence for the standard alpha opening", () => {
    const bundle = buildPersistedMatchBundle({
      activeSeat: "seat-0",
      createdAt: Date.UTC(2026, 3, 3, 12, 0, 0),
      format: starterFormat,
      matchId: "match_replay_golden",
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

    const keepSeat0 = buildPersistedIntentResult({
      events: bundle.events,
      intent: {
        intentId: "golden_keep_0",
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
        intentId: "golden_keep_1",
        kind: "keepOpeningHand",
        matchId: bundle.shell.id,
        payload: {},
        seat: "seat-1",
        stateVersion: keepSeat0.state.shell.version,
      },
      state: keepSeat0.state,
    });
    const keepSeat0Anchor = selectReplayAnchorEvent(keepSeat0.appendedEvents);
    const keepSeat1Anchor = selectReplayAnchorEvent(keepSeat1.appendedEvents);
    const initialReplayEvent = bundle.events[0];
    if (!initialReplayEvent) {
      throw new Error("Expected the seeded replay bundle to include an event.");
    }

    const frames = [
      createReplayFrame({
        event: initialReplayEvent,
        frameIndex: 0,
        view: bundle.spectatorView,
      }),
      createReplayFrame({
        event: keepSeat0Anchor,
        frameIndex: 1,
        view: keepSeat0.spectatorView,
      }),
      createReplayFrame({
        event: keepSeat1Anchor,
        frameIndex: 2,
        view: keepSeat1.spectatorView,
      }),
    ];

    expect(frames).toEqual(replayGolden);
  });
});
