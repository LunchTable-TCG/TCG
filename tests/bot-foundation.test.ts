import {
  createCatalogEntriesForFormat,
  starterFormat,
} from "@lunchtable/card-content";
import type { MatchSeatView } from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";
import {
  createDecisionFrame,
  createExternalDecisionEnvelope,
  createExternalDecisionPrompt,
  createAgentMatchContext,
  getCatalogForFormat,
  listLegalBotActions,
  planBaselineIntent,
  resolveExternalDecisionResponse,
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

function createTargetingSeatView(): MatchSeatView {
  const view = createPrioritySeatView();

  return {
    ...view,
    zones: view.zones.map((zone) => {
      if (zone.ownerSeat === "seat-1" && zone.zone === "battlefield") {
        return {
          ...zone,
          cardCount: 3,
          cards: [
            {
              annotations: [],
              cardId: "field-marshal-cadet",
              controllerSeat: "seat-1",
              counters: {},
              instanceId: "seat-1:field-marshal-cadet:battlefield:1",
              isTapped: false,
              keywords: [],
              name: "Field Marshal Cadet",
              ownerSeat: "seat-1",
              slotId: null,
              statLine: { power: 2, toughness: 2 },
              visibility: "public",
              zone: "battlefield",
            },
            {
              annotations: [],
              cardId: "tidecall-apprentice",
              controllerSeat: "seat-1",
              counters: {},
              instanceId: "seat-1:tidecall-apprentice:battlefield:1",
              isTapped: false,
              keywords: [],
              name: "Tidecall Apprentice",
              ownerSeat: "seat-1",
              slotId: null,
              statLine: { power: 1, toughness: 2 },
              visibility: "public",
              zone: "battlefield",
            },
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

    expect(plan?.actionId).toBe("bot:seat-1:0:keep:prompt:seat-1:mulligan");
    expect(frame.context.legalActions[0]?.kind).toBe("keepOpeningHand");
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

  it("builds a stable external decision envelope for external runtimes", () => {
    const frame = createDecisionFrame({
      catalog: createCatalogEntriesForFormat(starterFormat),
      receivedAt: Date.UTC(2026, 3, 3, 12, 1, 0),
      view: createPrioritySeatView(),
    });
    const envelope = createExternalDecisionEnvelope(frame);

    expect(envelope.seat).toBe("seat-1");
    expect(envelope.legalActions[0]?.actionId).toBe(
      envelope.legalActions[0]?.intent.intentId,
    );
    expect(envelope.prompt).toContain("Choose exactly one provided actionId");
    expect(createExternalDecisionPrompt(frame)).toContain("Legal actions:");
  });

  it("resolves external action selections back into validated intents", () => {
    const frame = createDecisionFrame({
      catalog: createCatalogEntriesForFormat(starterFormat),
      receivedAt: Date.UTC(2026, 3, 3, 12, 1, 0),
      view: createPrioritySeatView(),
    });
    const topAction = createExternalDecisionEnvelope(frame).legalActions[0];
    if (!topAction) {
      throw new Error("Expected at least one legal action");
    }

    const plan = resolveExternalDecisionResponse({
      frame,
      response: {
        actionId: topAction.actionId,
        confidence: 0.91,
      },
    });

    expect(plan).toEqual({
      actionId: topAction.actionId,
      confidence: 0.91,
      intent: topAction.intent,
      requestedAt: frame.receivedAt,
      seat: "seat-1",
    });

    expect(
      resolveExternalDecisionResponse({
        frame,
        response: {
          actionId: null,
        },
      }),
    ).toBeNull();

    expect(
      resolveExternalDecisionResponse({
        frame,
        response: topAction.actionId,
      }),
    ).toEqual({
      actionId: topAction.actionId,
      confidence: 0.5,
      intent: topAction.intent,
      requestedAt: frame.receivedAt,
      seat: "seat-1",
    });

    expect(() =>
      resolveExternalDecisionResponse({
        frame,
        response: {
          actionId: "not-a-real-action",
        },
      }),
    ).toThrow("External agent returned an unknown actionId");
  });

  it("builds a structured agent match context with visible card metadata", () => {
    const view = createPrioritySeatView();
    const catalog = createCatalogEntriesForFormat(starterFormat);
    const context = createAgentMatchContext({
      catalog,
      receivedAt: Date.UTC(2026, 3, 3, 12, 1, 0),
      view,
    });

    expect(context.version).toBe("v1");
    expect(context.viewerSeat).toBe("seat-1");
    expect(context.legalActions.length).toBeGreaterThan(0);
    expect(
      context.visibleCards.find((card) => card.card.cardId === "ember-summoner")
        ?.card.reasoning.effectKinds,
    ).toContain("dealDamage");
  });

  it("enumerates targeted activated abilities as concrete legal actions", () => {
    const frame = createDecisionFrame({
      catalog: getCatalogForFormat(starterFormat.formatId),
      receivedAt: Date.UTC(2026, 3, 3, 12, 1, 0),
      view: createTargetingSeatView(),
    });

    const actions = listLegalBotActions(frame).filter(
      (action) =>
        action.kind === "activateAbility" &&
        action.intent.kind === "activateAbility" &&
        action.intent.payload.abilityId === "battlefield-orders",
    );

    expect(actions).toHaveLength(3);
    expect(
      actions.map((action) =>
        action.intent.kind === "activateAbility"
          ? action.intent.payload.targetIds
          : null,
      ),
    ).toEqual([
      ["seat-1:archive-apprentice:battlefield:1"],
      ["seat-1:field-marshal-cadet:battlefield:1"],
      ["seat-1:tidecall-apprentice:battlefield:1"],
    ]);
  });

  it("waits instead of conceding when only passive controls remain", () => {
    const frame = createDecisionFrame({
      catalog: createCatalogEntriesForFormat(starterFormat),
      receivedAt: Date.UTC(2026, 3, 3, 12, 1, 30),
      view: {
        ...createPrioritySeatView(),
        availableIntents: ["toggleAutoPass", "concede"],
      },
    });

    expect(listLegalBotActions(frame).map((action) => action.kind)).toEqual([
      "concede",
      "toggleAutoPass",
    ]);
    expect(planBaselineIntent(frame)).toBeNull();
  });
});
