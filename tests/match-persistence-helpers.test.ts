import { starterFormat } from "@lunchtable/card-content";
import type { UserId } from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";

import {
  buildPracticeMatchBundle,
  deserializeMatchEvent,
  deserializeMatchShell,
  deserializeMatchState,
  deserializeSeatView,
  deserializeSpectatorView,
  serializeMatchEvent,
  serializeMatchShell,
  serializeMatchState,
  serializeMatchView,
} from "../convex/lib/matches";
import { buildStarterDeck } from "./helpers/starterDeck";

const starterDeck = buildStarterDeck();

function requireFirstEvent() {
  const bundle = buildPracticeMatchBundle({
    createdAt: 123,
    format: starterFormat,
    matchId: "match_123",
    player: {
      userId: "user_123" as UserId,
      username: "tablemage",
      walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    },
    primaryDeck: starterDeck,
  });
  const firstEvent = bundle.events[0];
  const firstView = bundle.views[0]?.view;
  if (!firstEvent || !firstView) {
    throw new Error(
      "Expected practice match bundle to include initial projections.",
    );
  }

  return {
    bundle,
    firstEvent,
    firstView,
  };
}

describe("match persistence helpers", () => {
  it("builds an initial practice match shell with cached views", () => {
    const bundle = buildPracticeMatchBundle({
      createdAt: 123,
      format: starterFormat,
      matchId: "match_123",
      player: {
        userId: "user_123" as UserId,
        username: "tablemage",
        walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      },
      primaryDeck: starterDeck,
    });

    expect(bundle.shell.id).toBe("match_123");
    expect(bundle.shell.lastEventNumber).toBe(3);
    expect(bundle.events).toHaveLength(3);
    expect(bundle.events[0]?.kind).toBe("matchCreated");
    expect(bundle.events.slice(1).map((event) => event.kind)).toEqual([
      "promptOpened",
      "promptOpened",
    ]);
    expect(bundle.views).toHaveLength(2);
    expect(bundle.spectatorView.kind).toBe("spectator");
  });

  it("keeps deck order private in spectator projections", () => {
    const bundle = buildPracticeMatchBundle({
      createdAt: 123,
      format: starterFormat,
      matchId: "match_123",
      player: {
        userId: "user_123" as UserId,
        username: "tablemage",
        walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      },
      primaryDeck: starterDeck,
    });

    const seatView = bundle.views.find(
      (view) => view.viewerSeat === "seat-0",
    )?.view;
    const seatDeck = seatView?.zones.find(
      (zone) => zone.ownerSeat === "seat-0" && zone.zone === "deck",
    );
    const spectatorDeck = bundle.spectatorView.zones.find(
      (zone) => zone.ownerSeat === "seat-0" && zone.zone === "deck",
    );

    expect(seatView?.viewerSeat).toBe("seat-0");
    expect(seatDeck?.cards).toHaveLength(41);
    expect(spectatorDeck?.cards).toHaveLength(0);
    expect(spectatorDeck?.cardCount).toBe(41);
  });

  it("compiles keyword-generated abilities into the persisted runtime card catalog", () => {
    const bundle = buildPracticeMatchBundle({
      createdAt: 123,
      format: starterFormat,
      matchId: "match_123",
      player: {
        userId: "user_123" as UserId,
        username: "tablemage",
        walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      },
      primaryDeck: starterDeck,
    });

    const flyingScout = bundle.state.cardCatalog["sky-patrol-scout"];
    const wardUnit = bundle.state.cardCatalog["mirror-warden"];

    expect(
      flyingScout?.abilities.some(
        (ability) => ability.kind === "static" && ability.id.endsWith(":haste"),
      ),
    ).toBe(true);
    expect(
      wardUnit?.abilities.some(
        (ability) =>
          ability.kind === "replacement" && ability.id.endsWith(":ward1"),
      ),
    ).toBe(true);
  });

  it("round-trips persisted match JSON through typed deserializers", () => {
    const { bundle, firstEvent, firstView } = requireFirstEvent();

    expect(deserializeMatchShell(serializeMatchShell(bundle.shell))).toEqual(
      bundle.shell,
    );
    expect(deserializeMatchState(serializeMatchState(bundle.state))).toEqual(
      bundle.state,
    );
    expect(deserializeMatchEvent(serializeMatchEvent(firstEvent))).toEqual(
      firstEvent,
    );
    expect(deserializeSeatView(serializeMatchView(firstView))).toEqual(
      firstView,
    );
    expect(
      deserializeSpectatorView(serializeMatchView(bundle.spectatorView)),
    ).toEqual(bundle.spectatorView);
  });

  it("rejects malformed persisted match JSON", () => {
    expect(() =>
      deserializeMatchShell(JSON.stringify({ id: "match_123" })),
    ).toThrow(/activeSeat/);
    expect(() => deserializeSeatView(JSON.stringify({ kind: "seat" }))).toThrow(
      /availableIntents/,
    );
  });
});
