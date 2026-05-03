import type { GameGenre } from "./pack";

export type GeneratedGameViewMode =
  | "first-person"
  | "isometric-2.5d"
  | "orthographic-2d"
  | "perspective-3d"
  | "side-scroller";

export interface GeneratedGameBrief {
  genre: GameGenre;
  playerCount: number;
  title: string;
  viewMode: GeneratedGameViewMode;
  winCondition: string;
}

export type GeneratedGameAuthoringStageId =
  | "admit-pack"
  | "brief"
  | "draft-pack"
  | "publish"
  | "render"
  | "simulate"
  | "wire-agents";

export interface GeneratedGameAuthoringStage {
  id: GeneratedGameAuthoringStageId;
  label: string;
}

export type GeneratedGameGateId =
  | "agent-parity"
  | "deterministic-simulation"
  | "docs-context"
  | "mcp-connectivity"
  | "renderer-scene"
  | "schema-validation";

export interface GeneratedGameGate {
  id: GeneratedGameGateId;
  label: string;
}

export interface GeneratedGameAuthoringFile {
  path: string;
  purpose: string;
}

export interface CreateGeneratedGameAuthoringWorkflowInput {
  brief: GeneratedGameBrief;
  packId: string;
}

export interface GeneratedGameAuthoringWorkflow {
  brief: GeneratedGameBrief;
  files: GeneratedGameAuthoringFile[];
  gates: GeneratedGameGate[];
  packId: string;
  stages: GeneratedGameAuthoringStage[];
}

export type GeneratedGameGateStatus = "failed" | "passed" | "pending";

export interface GeneratedGameReadinessInput {
  agentParity: GeneratedGameGateStatus;
  docsContext: GeneratedGameGateStatus;
  mcpConnectivity: GeneratedGameGateStatus;
  packValidation: GeneratedGameGateStatus;
  rendererScene: GeneratedGameGateStatus;
  simulation: GeneratedGameGateStatus;
}

export interface GeneratedGameReadiness {
  blockingGateIds: GeneratedGameGateId[];
  ready: boolean;
  status: "blocked" | "publishable";
}

const authoringFiles: GeneratedGameAuthoringFile[] = [
  {
    path: "game.json",
    purpose: "Portable game manifest and runtime compatibility metadata.",
  },
  {
    path: "ruleset.json",
    purpose: "Phases, legal intents, permissions, and victory model.",
  },
  {
    path: "objects.json",
    purpose: "Seats, zones, pieces, cards, dice, boards, and tokens.",
  },
  {
    path: "content/scenarios/default.json",
    purpose: "Starter setup for deterministic simulation and browser preview.",
  },
  {
    path: "tests/replay-golden.json",
    purpose: "Replay fixture proving deterministic reconstruction.",
  },
  {
    path: "tests/agent-parity.test.ts",
    purpose: "Agent parity test for legal-action-only decisions.",
  },
  {
    path: "tests/mcp-server.test.ts",
    purpose: "MCP connectivity test for local and developer agents.",
  },
  {
    path: "llms.txt",
    purpose: "Short agent-readable integration map.",
  },
  {
    path: "llms-full.txt",
    purpose: "Complete agent-readable game and runtime context.",
  },
  {
    path: ".agents/skills/play-lunchtable-game/SKILL.md",
    purpose: "Agent skill for joining and playing through legal actions.",
  },
];

const authoringGates: GeneratedGameGate[] = [
  { id: "schema-validation", label: "Schema validation" },
  { id: "deterministic-simulation", label: "Deterministic simulation" },
  { id: "agent-parity", label: "Agent parity" },
  { id: "renderer-scene", label: "Renderer scene" },
  { id: "mcp-connectivity", label: "MCP connectivity" },
  { id: "docs-context", label: "Agent docs context" },
];

const authoringStages: GeneratedGameAuthoringStage[] = [
  { id: "brief", label: "Design brief" },
  { id: "draft-pack", label: "Draft portable pack" },
  { id: "admit-pack", label: "Validate and admit pack" },
  { id: "simulate", label: "Simulate with replay goldens" },
  { id: "wire-agents", label: "Wire agents and MCP" },
  { id: "render", label: "Render scene preview" },
  { id: "publish", label: "Publishable pack" },
];

export function createGeneratedGameAuthoringWorkflow(
  input: CreateGeneratedGameAuthoringWorkflowInput,
): GeneratedGameAuthoringWorkflow {
  return {
    brief: { ...input.brief },
    files: authoringFiles.map((file) => ({ ...file })),
    gates: authoringGates.map((gate) => ({ ...gate })),
    packId: input.packId,
    stages: authoringStages.map((stage) => ({ ...stage })),
  };
}

export function evaluateGeneratedGameReadiness(
  input: GeneratedGameReadinessInput,
): GeneratedGameReadiness {
  const gateStatuses: Array<{
    id: GeneratedGameGateId;
    status: GeneratedGameGateStatus;
  }> = [
    { id: "schema-validation", status: input.packValidation },
    { id: "deterministic-simulation", status: input.simulation },
    { id: "agent-parity", status: input.agentParity },
    { id: "renderer-scene", status: input.rendererScene },
    { id: "mcp-connectivity", status: input.mcpConnectivity },
    { id: "docs-context", status: input.docsContext },
  ];
  const blockingGateIds = gateStatuses
    .filter((gate) => gate.status !== "passed")
    .map((gate) => gate.id);

  return {
    blockingGateIds,
    ready: blockingGateIds.length === 0,
    status: blockingGateIds.length === 0 ? "publishable" : "blocked",
  };
}
