import {
  createCatalogEntriesForFormat,
  starterFormat,
} from "@lunchtable/card-content";
import type { MatchSeatView } from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";
import {
  createDecisionFrame,
  getCatalogForFormat,
  listLegalBotActions,
  planBaselineIntent,
} from "../packages/bot-sdk/src/index";

import {
  buildBotEmail,
  buildBotUsernameNormalized,
  deriveBotAssignmentStatus,
  normalizeBotSlug,
} from "../convex/lib/agents";
import {
  buildPersistedIntentResult,
  buildPersistedMatchBundle,
} from "../convex/lib/matches";
import { buildStarterDeck } from "./helpers/starterDeck";

function createMulliganSeatView(): MatchSeatView {
  const bundle = buildPersistedMatchBundle({
    activeSeat: "seat-0",
    createdAt: Date.UTC(2026, 3, 3, 12, 0, 0),
    format: starterFormat,
    matchId: "match_bot_mulligan",
    participants: [
      {
        actorType: "human",
        deck: buildStarterDeck(),
        seat: "seat-0",
        userId: "user_human" as never,
        username: "human",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        actorType: "bot",
        deck: buildStarterDeck(),
        seat: "seat-1",
        userId: "user_bot" as never,
        username: "Table Bot",
      },
    ],
    startedAt: Date.UTC(2026, 3, 3, 12, 0, 0),
    status: "active",
    turnNumber: 1,
  });

  const seatView = bundle.views.find(
    (view) => view.viewerSeat === "seat-1",
  )?.view;
  if (!seatView) {
    throw new Error("Expected seat-1 view");
  }
  return seatView;
}

function createPrioritySeatView(): MatchSeatView {
  const mulliganView = createMulliganSeatView();
  const bundle = buildPersistedMatchBundle({
    activeSeat: "seat-0",
    createdAt: mulliganView.match.createdAt,
    format: starterFormat,
    matchId: mulliganView.match.id,
    participants: [
      {
        actorType: "human",
        deck: buildStarterDeck(),
        seat: "seat-0",
        userId: "user_human" as never,
        username: "human",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        actorType: "bot",
        deck: buildStarterDeck(),
        seat: "seat-1",
        userId: "user_bot" as never,
        username: "Table Bot",
      },
    ],
    startedAt: mulliganView.match.startedAt ?? mulliganView.match.createdAt,
    status: "active",
    turnNumber: 1,
  });

  const keepSeat0 = buildPersistedIntentResult({
    events: bundle.events,
    intent: {
      intentId: "intent_keep_human",
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
      intentId: "intent_keep_bot",
      kind: "keepOpeningHand",
      matchId: bundle.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: keepSeat0.state.shell.version,
    },
    state: keepSeat0.state,
  });

  const view = keepSeat1.views.find(
    (entry) => entry.viewerSeat === "seat-1",
  )?.view;
  if (!view) {
    throw new Error("Expected active seat-1 view");
  }

  return {
    ...view,
    availableIntents: [
      "playCard",
      "activateAbility",
      "passPriority",
      "toggleAutoPass",
      "concede",
    ],
    seats: view.seats.map((seat) =>
      seat.seat === "seat-1"
        ? {
            ...seat,
            resources: [
              {
                current: 3,
                label: "Mana",
                maximum: 3,
                resourceId: "mana",
              },
            ],
          }
        : seat,
    ),
    zones: view.zones.map((zone) => {
      if (zone.ownerSeat === "seat-1" && zone.zone === "hand") {
        return {
          ...zone,
          cardCount: 2,
          cards: [
            {
              annotations: [],
              cardId: "tidecall-apprentice",
              controllerSeat: "seat-1",
              counters: {},
              instanceId: "seat-1:tidecall-apprentice:hand:1",
              isTapped: false,
              keywords: [],
              name: "Tidecall Apprentice",
              ownerSeat: "seat-1",
              slotId: null,
              statLine: { power: 1, toughness: 2 },
              visibility: "private-self",
              zone: "hand",
            },
            {
              annotations: [],
              cardId: "ember-summoner",
              controllerSeat: "seat-1",
              counters: {},
              instanceId: "seat-1:ember-summoner:hand:1",
              isTapped: false,
              keywords: [],
              name: "Ember Summoner",
              ownerSeat: "seat-1",
              slotId: null,
              statLine: { power: 2, toughness: 2 },
              visibility: "private-self",
              zone: "hand",
            },
          ],
        };
      }

      if (zone.ownerSeat === "seat-1" && zone.zone === "battlefield") {
        return {
          ...zone,
          cardCount: 1,
          cards: [
            {
              annotations: [],
              cardId: "archive-apprentice",
              controllerSeat: "seat-1",
              counters: {},
              instanceId: "seat-1:archive-apprentice:battlefield:1",
              isTapped: false,
              keywords: [],
              name: "Archive Apprentice",
              ownerSeat: "seat-1",
              slotId: null,
              statLine: { power: 1, toughness: 3 },
              visibility: "public",
              zone: "battlefield",
            },
          ],
        };
      }

      return zone;
    }),
  };
}

describe("bot foundation helpers", () => {
  it("normalizes bot identity fields and assignment status safely", () => {
    expect(normalizeBotSlug(" Table Bot ")).toBe("table-bot");
    expect(buildBotEmail("table-bot")).toBe("table-bot@bots.lunchtable.local");
    expect(buildBotUsernameNormalized("table-bot")).toBe("bot:table-bot");
    expect(deriveBotAssignmentStatus("pending")).toBe("pending");
    expect(deriveBotAssignmentStatus("active")).toBe("active");
    expect(deriveBotAssignmentStatus("complete")).toBe("complete");
    expect(deriveBotAssignmentStatus("cancelled")).toBe("cancelled");
  });

  it("keeps the opening hand on mulligan prompts", () => {
    const frame = createDecisionFrame({
      catalog: getCatalogForFormat(starterFormat.formatId),
      receivedAt: Date.UTC(2026, 3, 3, 12, 0, 5),
      view: createMulliganSeatView(),
    });

    const plan = planBaselineIntent(frame);

    expect(plan?.intent.kind).toBe("keepOpeningHand");
    expect(plan?.intent.seat).toBe("seat-1");
  });

  it("prefers direct-damage plays before lower-impact cards", () => {
    const view = createPrioritySeatView();
    const frame = createDecisionFrame({
      catalog: createCatalogEntriesForFormat(starterFormat),
      receivedAt: Date.UTC(2026, 3, 3, 12, 1, 0),
      view,
    });

    const actions = listLegalBotActions(frame);

    expect(actions[0]?.kind).toBe("playCard");
    expect(actions[0]?.intent.kind).toBe("playCard");
    if (actions[0]?.intent.kind !== "playCard") {
      throw new Error("Expected top legal action to be playCard");
    }
    expect(actions[0].intent.payload.cardInstanceId).toBe(
      "seat-1:ember-summoner:hand:1",
    );
  });
});
