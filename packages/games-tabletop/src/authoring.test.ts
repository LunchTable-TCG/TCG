import { describe, expect, it } from "vitest";

import {
  createGeneratedGameAuthoringWorkflow,
  evaluateGeneratedGameReadiness,
} from "./authoring";

describe("generated game authoring workflows", () => {
  it("creates an ordered workflow with admission, agent, render, and docs gates", () => {
    const workflow = createGeneratedGameAuthoringWorkflow({
      brief: {
        genre: "side-scroller",
        playerCount: 2,
        title: "Neon Runner Duel",
        viewMode: "side-scroller",
        winCondition: "Reach the exit or outscore the rival runner.",
      },
      packId: "neon-runner-duel",
    });

    expect(workflow.packId).toBe("neon-runner-duel");
    expect(workflow.files.map((file) => file.path)).toEqual([
      "game.json",
      "ruleset.json",
      "objects.json",
      "content/scenarios/default.json",
      "tests/replay-golden.json",
      "tests/agent-parity.test.ts",
      "tests/mcp-server.test.ts",
      "llms.txt",
      "llms-full.txt",
      ".agents/skills/play-lunchtable-game/SKILL.md",
    ]);
    expect(workflow.gates.map((gate) => gate.id)).toEqual([
      "schema-validation",
      "deterministic-simulation",
      "agent-parity",
      "renderer-scene",
      "mcp-connectivity",
      "docs-context",
    ]);
    expect(workflow.stages.map((stage) => stage.id)).toEqual([
      "brief",
      "draft-pack",
      "admit-pack",
      "simulate",
      "wire-agents",
      "render",
      "publish",
    ]);
  });

  it("blocks publish readiness until every generated-game gate passes", () => {
    expect(
      evaluateGeneratedGameReadiness({
        agentParity: "passed",
        docsContext: "passed",
        mcpConnectivity: "passed",
        packValidation: "passed",
        rendererScene: "passed",
        simulation: "failed",
      }),
    ).toEqual({
      blockingGateIds: ["deterministic-simulation"],
      ready: false,
      status: "blocked",
    });

    expect(
      evaluateGeneratedGameReadiness({
        agentParity: "passed",
        docsContext: "passed",
        mcpConnectivity: "passed",
        packValidation: "passed",
        rendererScene: "passed",
        simulation: "passed",
      }),
    ).toEqual({
      blockingGateIds: [],
      ready: true,
      status: "publishable",
    });
  });
});
