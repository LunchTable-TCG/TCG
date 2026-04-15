import { starterFormat } from "@lunchtable/card-content";
import { describe, expect, it } from "vitest";

import {
  buildCoachReply,
  buildCommentatorReply,
  createAgentReply,
  getAgentSessionTitle,
  nextSessionPreview,
} from "../convex/lib/agentLab";
import { buildPersistedMatchBundle } from "../convex/lib/matches";
import { buildStarterDeck } from "./helpers/starterDeck";

function createViews() {
  const bundle = buildPersistedMatchBundle({
    activeSeat: "seat-0",
    createdAt: Date.UTC(2026, 3, 3, 14, 0, 0),
    format: starterFormat,
    matchId: "match_agent_lab",
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
    startedAt: Date.UTC(2026, 3, 3, 14, 0, 0),
    status: "active",
    turnNumber: 1,
  });

  const seatView = bundle.views.find(
    (view) => view.viewerSeat === "seat-0",
  )?.view;
  if (!seatView) {
    throw new Error("Expected seat view");
  }

  return {
    seatView,
    spectatorView: bundle.spectatorView,
  };
}

describe("agent lab helper replies", () => {
  it("builds a coach reply from the owned seat view and legal actions", () => {
    const { seatView } = createViews();

    const reply = buildCoachReply({
      prompt: "What is my safest parity-safe line?",
      view: seatView,
    });

    expect(reply).toContain("Coach mode is advisory only");
    expect(reply).toContain("Legal actions now:");
    expect(reply).toContain("Keep opening hand");
    expect(reply).toContain(
      "Requested focus: What is my safest parity-safe line?",
    );
  });

  it("builds commentator text from spectator-safe state only", () => {
    const { spectatorView } = createViews();

    const reply = buildCommentatorReply({
      prompt: "Give me a short update",
      replaySummary: {
        totalFrames: 12,
      },
      view: spectatorView,
    });

    expect(reply).toContain("Commentator mode is public-state only");
    expect(reply).toContain("Replay coverage: 12 public frames");
    expect(reply).toContain("Requested focus: Give me a short update");
    expect(reply).not.toContain("private-self");
  });

  it("enforces the seat-view and spectator-view parity boundaries", () => {
    const { seatView, spectatorView } = createViews();

    expect(() =>
      createAgentReply({
        prompt: "",
        purpose: "coach",
        replaySummary: null,
        seatView: null,
        spectatorView,
      }),
    ).toThrow("Coach sessions require an owned seat view");

    expect(() =>
      createAgentReply({
        prompt: "",
        purpose: "commentator",
        replaySummary: null,
        seatView,
        spectatorView: null,
      }),
    ).toThrow("Commentator sessions require a public spectator view");
  });

  it("formats stable session titles and previews", () => {
    expect(
      getAgentSessionTitle({
        matchId: "match_123",
        purpose: "coach",
      }),
    ).toBe("Coach Thread · match_123");

    expect(nextSessionPreview("alpha ".repeat(60)).length).toBeLessThanOrEqual(
      180,
    );
  });
});
