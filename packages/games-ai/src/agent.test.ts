import { describe, expect, it } from "vitest";

import type { LegalActionDescriptor } from "./actions";
import {
  createActionIdPolicy,
  createAgentCapabilityManifest,
  createAgentObservationFrame,
  createAgentToolManifest,
  createFirstLegalActionPolicy,
  createLegalActionDescriptors,
  createLunchTableA2aAgentCard,
  createMcpToolManifest,
  runAgentTurn,
} from "./agent";

interface TestState {
  position: Record<string, number>;
  secrets: Record<string, string>;
  version: number;
}

type TestIntent =
  | { delta: number; kind: "move"; seatId: string }
  | { kind: "pass"; seatId: string };

type TestEvent =
  | { kind: "moved"; seatId: string }
  | { kind: "passed"; seatId: string };

interface TestSeatView {
  ownSecret: string;
  position: number;
  visibleSeats: string[];
}

const ruleset = {
  applyIntent(state: TestState, intent: TestIntent) {
    if (intent.kind === "move") {
      return {
        events: [
          { kind: "moved", seatId: intent.seatId },
        ] satisfies TestEvent[],
        nextState: {
          ...state,
          position: {
            ...state.position,
            [intent.seatId]: state.position[intent.seatId] + intent.delta,
          },
          version: state.version + 1,
        },
        outcome: "applied" as const,
      };
    }

    return {
      events: [{ kind: "passed", seatId: intent.seatId }] satisfies TestEvent[],
      nextState: {
        ...state,
        version: state.version + 1,
      },
      outcome: "applied" as const,
    };
  },
  deriveSeatView(state: TestState, seatId: string): TestSeatView {
    return {
      ownSecret: state.secrets[seatId],
      position: state.position[seatId],
      visibleSeats: Object.keys(state.position),
    };
  },
  listLegalIntents(_state: TestState, seatId: string): TestIntent[] {
    return [
      { delta: 1, kind: "move", seatId },
      { kind: "pass", seatId },
    ];
  },
};

const state: TestState = {
  position: {
    "seat-0": 0,
    "seat-1": 10,
  },
  secrets: {
    "seat-0": "private-seat-0",
    "seat-1": "private-seat-1",
  },
  version: 4,
};

describe("agent-native gameplay primitives", () => {
  it("builds canonical tools for game-playing agents", () => {
    expect(createAgentToolManifest().map((tool) => tool.name)).toEqual([
      "joinGameSeat",
      "observeGame",
      "listLegalActions",
      "submitAction",
      "passPriority",
      "getRules",
      "getObjective",
      "getReplay",
      "subscribeEvents",
      "runSelfPlay",
      "evaluateAgent",
    ]);
  });

  it("describes MCP and A2A surfaces without granting extra game powers", () => {
    const manifest = createAgentCapabilityManifest({
      agentId: "baseline-agent",
      displayName: "Baseline Agent",
      supportedTransports: ["local", "external-http", "mcp", "a2a"],
    });
    const mcpTools = createMcpToolManifest(manifest);
    const card = createLunchTableA2aAgentCard(manifest, {
      endpointUrl: "https://agents.example.test/lunchtable",
      providerName: "Lunch Table Games",
    });

    expect(
      manifest.tools.find((tool) => tool.name === "submitAction"),
    ).toMatchObject({
      authority: "intent-submit",
    });
    expect(mcpTools.tools.map((tool) => tool.name)).toContain(
      "listLegalActions",
    );
    expect(card.skills.map((skill) => skill.id)).toEqual([
      "join-game-seat",
      "play-legal-action",
      "run-self-play",
    ]);
  });

  it("creates observation frames from scoped views and legal actions", () => {
    const legalActions = createLegalActionDescriptors(
      ruleset.listLegalIntents(state, "seat-1"),
      { actionIdPrefix: "seat-1" },
    );
    const frame = createAgentObservationFrame({
      deadlineAt: null,
      gameId: "game-test",
      legalActions,
      receivedAt: 1777739000000,
      rulesetId: "test-ruleset",
      seat: "seat-1",
      stateVersion: state.version,
      transport: "local",
      view: ruleset.deriveSeatView(state, "seat-1"),
    });

    expect(frame.view).toEqual({
      ownSecret: "private-seat-1",
      position: 10,
      visibleSeats: ["seat-0", "seat-1"],
    });
    expect(frame.legalActions.map((action) => action.actionId)).toEqual([
      "seat-1:move:0",
      "seat-1:pass:1",
    ]);
  });

  it("runs an agent action through the same authoritative ruleset path", async () => {
    const result = await runAgentTurn<
      TestState,
      TestIntent,
      TestEvent,
      TestSeatView,
      LegalActionDescriptor<TestIntent>
    >({
      createLegalActions: (intents) =>
        createLegalActionDescriptors(intents, { actionIdPrefix: "seat-1" }),
      deadlineAt: null,
      gameId: "game-test",
      policy: createFirstLegalActionPolicy(),
      receivedAt: 1777739000000,
      ruleset,
      rulesetId: "test-ruleset",
      seat: "seat-1",
      state,
      stateVersion: state.version,
      transport: "local",
    });

    expect(result.action?.actionId).toBe("seat-1:move:0");
    expect(result.frame.view.ownSecret).toBe("private-seat-1");
    expect(result.transition?.nextState.position["seat-1"]).toBe(11);
    expect(result.transition?.outcome).toBe("applied");
  });

  it("rejects agent decisions that do not match the legal action catalog", async () => {
    await expect(
      runAgentTurn<
        TestState,
        TestIntent,
        TestEvent,
        TestSeatView,
        LegalActionDescriptor<TestIntent>
      >({
        createLegalActions: (intents) =>
          createLegalActionDescriptors(intents, { actionIdPrefix: "seat-1" }),
        deadlineAt: null,
        gameId: "game-test",
        policy: createActionIdPolicy("seat-1:invented-action"),
        receivedAt: 1777739000000,
        ruleset,
        rulesetId: "test-ruleset",
        seat: "seat-1",
        state,
        stateVersion: state.version,
        transport: "local",
      }),
    ).rejects.toThrow("External agent returned an unrecognized actionId");
  });
});
