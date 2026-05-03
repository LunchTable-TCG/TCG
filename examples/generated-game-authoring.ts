import { createElizaCloudHostedGameplayOrchestration } from "@lunchtable/games-ai";
import {
  createDefaultRendererAdapters,
  createRendererAdapterPlan,
  createRendererAdapterRegistry,
} from "@lunchtable/games-render";
import {
  createGeneratedGameAuthoringWorkflow,
  evaluateGeneratedGameReadiness,
} from "@lunchtable/games-tabletop";

export const sideScrollerAuthoringExample = {
  eliza: createElizaCloudHostedGameplayOrchestration({
    agentId: "agent-side-runner",
    gameId: "example-side-runner",
    mcpServerCommand: "bun run --silent mcp:stdio",
    seat: "seat-1",
  }),
  readiness: evaluateGeneratedGameReadiness({
    agentParity: "passed",
    docsContext: "passed",
    mcpConnectivity: "passed",
    packValidation: "passed",
    rendererScene: "passed",
    simulation: "passed",
  }),
  rendererPlan: createRendererAdapterPlan(
    {
      camera: {
        mode: "side-scroller",
        target: { x: 320, y: 180, z: 0 },
        zoom: 1,
      },
      cue: null,
      interactions: [
        { affordance: "move", objectId: "runner", seatId: "seat-0" },
      ],
      objects: [
        {
          id: "runner",
          interactive: true,
          label: "Runner",
          position: { x: 320, y: 180, z: 0 },
          size: { height: 64, width: 48 },
        },
      ],
      viewport: { height: 720, width: 1280 },
    },
    createRendererAdapterRegistry(createDefaultRendererAdapters()),
  ),
  workflow: createGeneratedGameAuthoringWorkflow({
    brief: {
      genre: "side-scroller",
      playerCount: 2,
      title: "Example Side Runner",
      viewMode: "side-scroller",
      winCondition: "Reach the goal while collecting the highest score.",
    },
    packId: "example-side-runner",
  }),
};
