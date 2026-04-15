import { starterFormat } from "@lunchtable/card-content";
import { describe, expect, it } from "vitest";

import { buildPersistedMatchBundle } from "../convex/lib/matches";
import {
  compareQueueOrder,
  deriveLobbyCode,
  deriveLobbyStatus,
  isActiveLobbyStatus,
  isActiveMatchStatus,
  normalizeLobbyCode,
  pickQueueOpponent,
} from "../convex/lib/play";
import { buildStarterDeck } from "./helpers/starterDeck";

describe("lobby and matchmaking helpers", () => {
  it("normalizes and derives deterministic lobby codes", () => {
    expect(normalizeLobbyCode(" abc123 ")).toBe("ABC123");
    expect(deriveLobbyCode("kd72qzhyek5pe2chn25z7mxyrd84572k")).toBe("KD72QZ");
  });

  it("derives lobby status from participation and match state", () => {
    expect(
      deriveLobbyStatus({
        cancelled: false,
        guestReady: undefined,
        guestUserId: undefined,
        hostReady: false,
        matchId: undefined,
      }),
    ).toBe("open");
    expect(
      deriveLobbyStatus({
        cancelled: false,
        guestReady: false,
        guestUserId: "guest_1",
        hostReady: true,
        matchId: undefined,
      }),
    ).toBe("readyCheck");
    expect(
      deriveLobbyStatus({
        cancelled: false,
        guestReady: true,
        guestUserId: "guest_1",
        hostReady: true,
        matchId: "match_1",
      }),
    ).toBe("matched");
    expect(
      deriveLobbyStatus({
        cancelled: true,
        guestReady: true,
        guestUserId: "guest_1",
        hostReady: true,
        matchId: "match_1",
      }),
    ).toBe("cancelled");
  });

  it("treats only open-ready lobbies and pending-active matches as blocking", () => {
    expect(isActiveLobbyStatus("open")).toBe(true);
    expect(isActiveLobbyStatus("readyCheck")).toBe(true);
    expect(isActiveLobbyStatus("matched")).toBe(false);
    expect(isActiveLobbyStatus("cancelled")).toBe(false);

    expect(isActiveMatchStatus("pending")).toBe(true);
    expect(isActiveMatchStatus("active")).toBe(true);
    expect(isActiveMatchStatus("complete")).toBe(false);
    expect(isActiveMatchStatus("cancelled")).toBe(false);
  });

  it("picks the oldest queued opponent from another user", () => {
    const entries = [
      {
        _id: "entry_c",
        createdAt: 30,
        status: "queued",
        userId: "user_self",
      },
      {
        _id: "entry_b",
        createdAt: 20,
        status: "queued",
        userId: "user_two",
      },
      {
        _id: "entry_a",
        createdAt: 20,
        status: "queued",
        userId: "user_one",
      },
    ] as never[];

    expect(compareQueueOrder(entries[1], entries[2])).toBeGreaterThan(0);
    expect(pickQueueOpponent(entries, "user_self")?._id).toBe("entry_a");
  });

  it("builds an active human mirror match bundle with deterministic opening hands", () => {
    const bundle = buildPersistedMatchBundle({
      activeSeat: "seat-0",
      createdAt: Date.UTC(2026, 3, 3, 12, 0, 0),
      format: starterFormat,
      matchId: "match_queue_1",
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

    expect(bundle.shell.status).toBe("active");
    expect(bundle.shell.phase).toBe("mulligan");
    expect(bundle.shell.activeSeat).toBe("seat-0");
    expect(bundle.shell.turnNumber).toBe(1);
    expect(bundle.views).toHaveLength(2);
    expect(bundle.events.map((event) => event.kind)).toEqual([
      "matchCreated",
      "promptOpened",
      "promptOpened",
    ]);
    expect(bundle.views[0]?.view.prompt?.kind).toBe("mulligan");
    expect(bundle.views[1]?.view.prompt?.kind).toBe("mulligan");
    expect(bundle.views[0]?.view.availableIntents).toEqual([
      "keepOpeningHand",
      "takeMulligan",
      "toggleAutoPass",
      "concede",
    ]);
    expect(bundle.views[0]?.view.seats[0]?.handCount).toBe(7);
    expect(bundle.views[1]?.view.seats[1]?.handCount).toBe(7);
    expect(bundle.views[0]?.view.seats[0]?.deckCount).toBe(41);
    expect(bundle.views[1]?.view.seats[1]?.deckCount).toBe(41);
    expect(bundle.spectatorView.availableIntents).toHaveLength(0);
  });
});
