import {
  createCatalogEntriesForFormat,
  starterFormat,
} from "@lunchtable/card-content";
import type { MatchSeatView } from "@lunchtable/shared-types";
import { describe, expect, it, vi } from "vitest";

import {
  createDecisionPlanner,
  loadDecisionPolicyConfig,
} from "../apps/bot-runner/src/policy";
import { buildPersistedMatchBundle } from "../convex/lib/matches";
import { createDecisionFrame } from "../packages/bot-sdk/src/index";
import { buildStarterDeck } from "./helpers/starterDeck";

function createPrioritySeatView() {
  const bundle = buildPersistedMatchBundle({
    activeSeat: "seat-0",
    createdAt: Date.UTC(2026, 3, 3, 12, 0, 0),
    format: starterFormat,
    matchId: "match_policy_test",
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
        username: "Milady Seat",
      },
    ],
    startedAt: Date.UTC(2026, 3, 3, 12, 0, 0),
    status: "active",
    turnNumber: 1,
  });

  const seatView = bundle.views.find(
    (entry) => entry.viewerSeat === "seat-1",
  )?.view;
  if (!seatView) {
    throw new Error("Expected bot seat view");
  }
  const availableIntents: MatchSeatView["availableIntents"] = ["passPriority"];

  return {
    ...seatView,
    availableIntents,
  };
}

describe("bot runner policy selection", () => {
  it("loads baseline mode by default", () => {
    expect(loadDecisionPolicyConfig({})).toEqual({
      authToken: null,
      decisionUrl: null,
      key: "baseline-v2-legal-actions",
      mode: "baseline",
      timeoutMs: 6000,
    });
  });

  it("requires a decision URL for external-http mode", () => {
    expect(() =>
      loadDecisionPolicyConfig({
        BOT_POLICY_MODE: "external-http",
      }),
    ).toThrow(
      "BOT_EXTERNAL_DECISION_URL is required when BOT_POLICY_MODE=external-http",
    );
  });

  it("accepts validated external action choices over HTTP", async () => {
    const frame = createDecisionFrame({
      catalog: createCatalogEntriesForFormat(starterFormat),
      receivedAt: Date.UTC(2026, 3, 3, 12, 2, 0),
      view: createPrioritySeatView(),
    });
    const planner = createDecisionPlanner(
      loadDecisionPolicyConfig({
        BOT_EXTERNAL_DECISION_URL: "https://milady.local/decide",
        BOT_POLICY_MODE: "external-http",
      }),
      vi.fn(async (_url, init) => {
        const payload = JSON.parse(String(init?.body)) as {
          legalActions: Array<{ actionId: string }>;
        };

        return new Response(
          JSON.stringify({
            actionId: payload.legalActions[0]?.actionId ?? null,
            confidence: 0.88,
          }),
          {
            status: 200,
          },
        );
      }),
    );

    const plan = await planner.decide(frame);

    expect(plan?.intent.kind).toBe("passPriority");
    expect(plan?.confidence).toBe(0.88);
  });

  it("surfaces non-JSON external responses as endpoint errors", async () => {
    const frame = createDecisionFrame({
      catalog: createCatalogEntriesForFormat(starterFormat),
      receivedAt: Date.UTC(2026, 3, 3, 12, 2, 0),
      view: createPrioritySeatView(),
    });
    const planner = createDecisionPlanner(
      loadDecisionPolicyConfig({
        BOT_EXTERNAL_DECISION_URL: "https://milady.local/decide",
        BOT_POLICY_MODE: "external-http",
      }),
      vi.fn(async () => new Response("not-json", { status: 200 })),
    );

    await expect(planner.decide(frame)).rejects.toThrow(
      "External decision endpoint returned non-JSON body: not-json",
    );
  });
});
