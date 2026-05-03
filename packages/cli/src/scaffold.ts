import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export type ScaffoldTemplateId =
  | "dice"
  | "shooter-3d"
  | "side-scroller"
  | "tcg";

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

export interface ScaffoldTemplate {
  description: string;
  id: ScaffoldTemplateId;
  name: string;
}

export interface ParsedInitArgs {
  command: "eval" | "help" | "init" | "list-templates" | "validate";
  force: boolean;
  json: boolean;
  packageManager: PackageManager;
  targetDirectory: string | null;
  templateId: ScaffoldTemplateId | null;
  yes: boolean;
}

export interface ScaffoldProjectInput {
  force: boolean;
  packageManager: PackageManager;
  targetDirectory: string;
  templateId: ScaffoldTemplateId;
}

export interface ScaffoldProjectResult {
  files: string[];
  packageName: string;
  targetDirectory: string;
  templateId: ScaffoldTemplateId;
}

interface ScaffoldFileInput {
  packageManager: PackageManager;
  packageName: string;
  template: ScaffoldTemplate;
}

type ScaffoldFileFactory = (input: ScaffoldFileInput) => string;

interface InternalScaffoldTemplate extends ScaffoldTemplate {
  files: Array<{
    content: ScaffoldFileFactory;
    path: string;
  }>;
}

const templates: InternalScaffoldTemplate[] = [
  {
    description: "Rules-authoritative card duel using tabletop zones.",
    files: createTemplateFiles("tcg"),
    id: "tcg",
    name: "Trading card game",
  },
  {
    description: "Dice and board game with deterministic rolls.",
    files: createTemplateFiles("dice"),
    id: "dice",
    name: "Dice tabletop game",
  },
  {
    description: "Side-scroller ruleset shell with 2.5D camera hints.",
    files: createTemplateFiles("side-scroller"),
    id: "side-scroller",
    name: "Side-scroller game",
  },
  {
    description: "First-person arena ruleset shell with 3D camera hints.",
    files: createTemplateFiles("shooter-3d"),
    id: "shooter-3d",
    name: "3D shooter game",
  },
];

export function listScaffoldTemplates(): ScaffoldTemplate[] {
  return templates.map((template) => ({
    description: template.description,
    id: template.id,
    name: template.name,
  }));
}

export function getScaffoldTemplate(
  templateId: ScaffoldTemplateId,
): ScaffoldTemplate {
  return getInternalScaffoldTemplate(templateId);
}

export function parseInitArgs(args: string[]): ParsedInitArgs {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return createParsedArgs("help");
  }

  if (args[0] === "templates" || args[0] === "list-templates") {
    return createParsedArgs("list-templates");
  }

  if (args[0] === "validate" || args[0] === "eval") {
    return parsePathCommandArgs(args);
  }

  if (args[0] !== "init") {
    throw new Error(`Unknown command: ${args[0]}`);
  }

  const parsed = createParsedArgs("init");
  let index = 1;

  while (index < args.length) {
    const arg = args[index];

    if (arg === "--yes" || arg === "-y") {
      parsed.yes = true;
      index += 1;
      continue;
    }

    if (arg === "--force") {
      parsed.force = true;
      index += 1;
      continue;
    }

    if (arg === "--template") {
      const templateId = args[index + 1];
      if (templateId === undefined || !isScaffoldTemplateId(templateId)) {
        throw new Error(
          "Expected --template to be one of: tcg, dice, side-scroller, shooter-3d",
        );
      }
      parsed.templateId = templateId;
      index += 2;
      continue;
    }

    if (arg === "--package-manager") {
      const packageManager = args[index + 1];
      if (packageManager === undefined || !isPackageManager(packageManager)) {
        throw new Error(
          "Expected --package-manager to be one of: bun, npm, pnpm, yarn",
        );
      }
      parsed.packageManager = packageManager;
      index += 2;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (parsed.targetDirectory !== null) {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }

    parsed.targetDirectory = arg;
    index += 1;
  }

  return parsed;
}

export async function createScaffoldProject(
  input: ScaffoldProjectInput,
): Promise<ScaffoldProjectResult> {
  const template = getInternalScaffoldTemplate(input.templateId);
  const packageName = createPackageName(input.targetDirectory);

  await mkdir(input.targetDirectory, { recursive: true });

  const existingEntries = await readdir(input.targetDirectory);
  if (existingEntries.length > 0 && !input.force) {
    throw new Error(
      `${input.targetDirectory} is not empty. Re-run with --force to write into it.`,
    );
  }

  for (const file of template.files) {
    const destination = join(input.targetDirectory, file.path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(
      destination,
      file.content({
        packageManager: input.packageManager,
        packageName,
        template,
      }),
      "utf8",
    );
  }

  return {
    files: template.files.map((file) => file.path),
    packageName,
    targetDirectory: input.targetDirectory,
    templateId: template.id,
  };
}

function createParsedArgs(command: ParsedInitArgs["command"]): ParsedInitArgs {
  return {
    command,
    force: false,
    json: false,
    packageManager: "bun",
    targetDirectory: null,
    templateId: null,
    yes: false,
  };
}

function parsePathCommandArgs(args: string[]): ParsedInitArgs {
  const command = args[0] === "validate" ? "validate" : "eval";
  const parsed = createParsedArgs(command);
  let index = 1;

  while (index < args.length) {
    const arg = args[index];

    if (arg === "--json") {
      parsed.json = true;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (parsed.targetDirectory !== null) {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }

    parsed.targetDirectory = arg;
    index += 1;
  }

  return parsed;
}

function isScaffoldTemplateId(value: string): value is ScaffoldTemplateId {
  return templates.some((template) => template.id === value);
}

function isPackageManager(value: string): value is PackageManager {
  return (
    value === "bun" || value === "npm" || value === "pnpm" || value === "yarn"
  );
}

function getInternalScaffoldTemplate(
  templateId: ScaffoldTemplateId,
): InternalScaffoldTemplate {
  const template = templates.find((candidate) => candidate.id === templateId);
  if (template === undefined) {
    throw new Error(`Unknown scaffold template: ${templateId}`);
  }
  return template;
}

function createPackageName(targetDirectory: string): string {
  const baseName = basename(targetDirectory)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (baseName.length === 0) {
    throw new Error(`Cannot derive a package name from ${targetDirectory}`);
  }

  return baseName;
}

function createTemplateFiles(templateId: ScaffoldTemplateId) {
  return [
    {
      content: () => "node_modules\ndist\n.env.local\n",
      path: ".gitignore",
    },
    {
      content: createBuildGameSkill,
      path: ".agents/skills/build-lunchtable-game/SKILL.md",
    },
    {
      content: createEvaluateAgentSkill,
      path: ".agents/skills/evaluate-lunchtable-agent/SKILL.md",
    },
    {
      content: createPlayGameSkill,
      path: ".agents/skills/play-lunchtable-game/SKILL.md",
    },
    {
      content: createReadme,
      path: "README.md",
    },
    {
      content: createGameJson(templateId),
      path: "game.json",
    },
    {
      content: createLlmsFullTxt,
      path: "llms-full.txt",
    },
    {
      content: createLlmsTxt,
      path: "llms.txt",
    },
    {
      content: createObjectsJson(templateId),
      path: "objects.json",
    },
    {
      content: createPackageJson,
      path: "package.json",
    },
    {
      content: createRulesetJson(templateId),
      path: "ruleset.json",
    },
    {
      content: createA2aAgentSource,
      path: "src/agents/a2a.ts",
    },
    {
      content: createBaselineAgentSource(templateId),
      path: "src/agents/baseline.ts",
    },
    {
      content: createExternalHttpAgentSource,
      path: "src/agents/external-http.ts",
    },
    {
      content: createMcpAgentSource,
      path: "src/agents/mcp.ts",
    },
    {
      content: createSelfPlaySource,
      path: "src/agents/self-play.ts",
    },
    {
      content: createGameSource(templateId),
      path: "src/game.ts",
    },
    {
      content: createAgentParityTestSource(templateId),
      path: "tests/agent-parity.test.ts",
    },
    {
      content: createGameTestSource(templateId),
      path: "tests/game.test.ts",
    },
    {
      content: createMcpServerSource(templateId),
      path: "src/mcp/server.ts",
    },
    {
      content: createMcpServerTestSource(templateId),
      path: "tests/mcp-server.test.ts",
    },
    {
      content: createSelfPlayTestSource(templateId),
      path: "tests/self-play.test.ts",
    },
    {
      content: createTsconfig,
      path: "tsconfig.json",
    },
  ];
}

function createReadme(input: ScaffoldFileInput): string {
  return `# ${input.template.name}

${input.template.description}

This starter is agent-native. Human players and AI agents share the same seat,
view, legal action, and authoritative intent path from day one.

## Development

\`\`\`bash
${input.packageManager} install
${input.packageManager} run test
bun run --silent mcp:stdio
\`\`\`
`;
}

function createGameJson(templateId: ScaffoldTemplateId): ScaffoldFileFactory {
  return (input) =>
    `${JSON.stringify(
      {
        description: input.template.description,
        extensionLevel: 1,
        genre: getPackGenre(templateId),
        id: `${input.packageName}-${templateId}`,
        name: input.template.name,
        runtime: "lunchtable",
        runtimeVersion: "0.1.1",
        version: "0.1.0",
      },
      null,
      2,
    )}\n`;
}

function createObjectsJson(
  templateId: ScaffoldTemplateId,
): ScaffoldFileFactory {
  return () =>
    `${JSON.stringify(
      {
        objects: createPackObjects(templateId),
        seats: [
          createPackSeat("seat-0", "human"),
          createPackSeat("seat-1", "ai"),
        ],
        zones: [
          createPackZone("table", "board", "Shared Table", null, "public"),
          createPackZone(
            "seat-0-private",
            "hand",
            "Seat 0 Private",
            "seat-0",
            "private-owner",
          ),
          createPackZone(
            "seat-1-private",
            "hand",
            "Seat 1 Private",
            "seat-1",
            "private-owner",
          ),
          createPackZone(
            "discard",
            "discard",
            "Shared Discard",
            null,
            "public",
          ),
        ],
      },
      null,
      2,
    )}\n`;
}

function createRulesetJson(
  templateId: ScaffoldTemplateId,
): ScaffoldFileFactory {
  return () =>
    `${JSON.stringify(
      {
        legalIntents: createPackLegalIntents(templateId),
        phases: createPackPhases(templateId),
        victory: createPackVictory(templateId),
      },
      null,
      2,
    )}\n`;
}

function getPackGenre(templateId: ScaffoldTemplateId): string {
  if (templateId === "tcg") {
    return "card-tabletop";
  }

  if (templateId === "dice") {
    return "dice-tabletop";
  }

  if (templateId === "side-scroller") {
    return "side-scroller";
  }

  return "arena-shooter-3d";
}

function createPackObjects(templateId: ScaffoldTemplateId) {
  if (templateId === "tcg") {
    return [
      createPackObject("board:table", "Duel Table", "table", null),
      createPackObject(
        "card:starter",
        "Starter Card",
        "seat-0-private",
        "seat-0",
      ),
    ];
  }

  if (templateId === "dice") {
    return [
      createPackObject("board:felt", "Felt Board", "table", null),
      createPackObject("die:attack", "Attack Die", "table", null),
    ];
  }

  if (templateId === "side-scroller") {
    return [
      createPackObject("board:level-1", "Level 1", "table", null),
      createPackObject(
        "platform:ground",
        "Ground",
        "table",
        null,
        "public",
        "board",
      ),
      createPackObject(
        "platform:ledge-1",
        "Ledge 1",
        "table",
        null,
        "public",
        "board",
      ),
      createPackObject(
        "piece:runner-seat-0",
        "Runner 0",
        "table",
        "seat-0",
        "public",
      ),
      createPackObject(
        "piece:runner-seat-1",
        "Runner 1",
        "table",
        "seat-1",
        "public",
      ),
      createPackObject("token:goal", "Goal", "table", null),
      createPackObject("token:hazard-1", "Hazard", "table", null),
      createPackObject("token:collectible-1", "Collectible", "table", null),
    ];
  }

  return [
    createPackObject("board:arena", "Arena", "table", null),
    createPackObject("piece:player", "Player", "table", "seat-0"),
  ];
}

function createPackObject(
  id: string,
  name: string,
  zoneId: string,
  ownerSeat: string | null,
  visibility: "private-owner" | "public" = ownerSeat === null
    ? "public"
    : "private-owner",
  kind = id.split(":")[0],
) {
  return {
    id,
    kind,
    name,
    ownerSeat,
    state: "ready",
    visibility,
    zoneId,
  };
}

function createPackSeat(id: string, actorType: "ai" | "human") {
  return {
    actorType,
    id,
    name: id === "seat-0" ? "Seat 0" : "Seat 1",
    permissions: ["submitIntent"],
    status: "ready",
  };
}

function createPackZone(
  id: string,
  kind: "board" | "discard" | "hand",
  name: string,
  ownerSeat: string | null,
  visibility: "private-owner" | "public",
) {
  return {
    id,
    kind,
    name,
    ordering: kind === "board" ? "unordered" : "ordered",
    ownerSeat,
    visibility,
  };
}

function createPackLegalIntents(templateId: ScaffoldTemplateId) {
  if (templateId === "tcg") {
    return [{ kind: "playCard" }, { kind: "pass" }];
  }

  if (templateId === "dice") {
    return [{ kind: "roll" }, { kind: "pass" }];
  }

  if (templateId === "side-scroller") {
    return [
      { kind: "moveLeft" },
      { kind: "moveRight" },
      { kind: "dash" },
      { kind: "jump" },
      { kind: "wait" },
      { kind: "attack" },
    ];
  }

  return [{ kind: "fire" }, { kind: "reload" }];
}

function createPackPhases(templateId: ScaffoldTemplateId) {
  if (templateId === "tcg") {
    return ["main", "combat", "end"];
  }

  if (templateId === "dice") {
    return ["roll", "score"];
  }

  if (templateId === "side-scroller") {
    return ["run"];
  }

  return ["combat"];
}

function createPackVictory(templateId: ScaffoldTemplateId) {
  if (templateId === "side-scroller") {
    return { kind: "reach-goal" };
  }

  if (templateId === "shooter-3d") {
    return { kind: "score-limit" };
  }

  return { kind: "last-seat-standing" };
}

function createLlmsTxt(input: ScaffoldFileInput): string {
  return `# ${input.template.name}

> Agent-native Lunch Table Games starter for ${input.template.description} Human players and AI agents share scoped views, legal action ids, and the same authoritative ruleset path.

## Core Files

- [README.md](README.md): Human setup and development commands.
- [llms-full.txt](llms-full.txt): Full LLM context for agents working in this starter.
- [src/game.ts](src/game.ts): Deterministic ruleset, state, legal intents, components, and render hints.
- [src/agents/baseline.ts](src/agents/baseline.ts): Local baseline agent and observation-frame helpers.
- [src/agents/external-http.ts](src/agents/external-http.ts): External agent envelope and response resolver.
- [src/agents/mcp.ts](src/agents/mcp.ts): MCP tool manifest for gameplay agents.
- [src/agents/a2a.ts](src/agents/a2a.ts): A2A agent card helper.
- [src/agents/self-play.ts](src/agents/self-play.ts): Deterministic self-play runner.
- [src/mcp/server.ts](src/mcp/server.ts): Runnable stdio MCP server for local clients and agent tooling.

## Agent Skills

- [.agents/skills/play-lunchtable-game/SKILL.md](.agents/skills/play-lunchtable-game/SKILL.md): Join, observe, choose legal actions, and submit turns.
- [.agents/skills/build-lunchtable-game/SKILL.md](.agents/skills/build-lunchtable-game/SKILL.md): Extend this starter while preserving deterministic authority.
- [.agents/skills/evaluate-lunchtable-agent/SKILL.md](.agents/skills/evaluate-lunchtable-agent/SKILL.md): Run self-play, parity, and legality checks.

## Verification

- [tests/game.test.ts](tests/game.test.ts): Starter construction smoke test.
- [tests/agent-parity.test.ts](tests/agent-parity.test.ts): Agent legal-action parity and protocol-surface checks.
- [tests/mcp-server.test.ts](tests/mcp-server.test.ts): MCP initialize, resource, and legal-action tool checks.
- [tests/self-play.test.ts](tests/self-play.test.ts): Agent-vs-agent deterministic smoke test.
`;
}

function createLlmsFullTxt(input: ScaffoldFileInput): string {
  return `# ${input.template.name} Full LLM Context

> Complete agent-readable context for a ${input.template.id} Lunch Table Games starter.

## Authority Model

Agents submit legal action ids, never arbitrary state mutations. The runtime resolves each chosen action id against the current legal action catalog and submits the associated intent through the ruleset.

Rules:

- Derive a scoped seat view before asking an agent to decide.
- Build legal actions from \`ruleset.listLegalIntents(state, seat)\`.
- Reject any external response that does not match a known \`actionId\`.
- Apply actions only through \`ruleset.applyIntent(state, intent)\`.
- Renderers and agents read projections; they do not mutate state directly.

## Starter Shape

- Template id: \`${input.template.id}\`
- Package name: \`${input.packageName}\`
- Package manager: \`${input.packageManager}\`
- Description: ${input.template.description}

## Agent Entrypoints

- \`createStarterDecisionFrame\` creates a scoped observation frame.
- \`runBaselineAgentTurn\` runs a local agent through the authoritative path.
- \`createExternalAgentRequest\` builds a hosted-agent envelope.
- \`resolveExternalAgentResponse\` rejects invented action ids.
- \`createStarterMcpToolManifest\` exposes tool metadata.
- \`runStarterMcpStdioServer\` exposes a connectable MCP stdio server.
- \`createStarterA2aAgentCard\` exposes discovery metadata.
- \`runStarterSelfPlay\` proves two agent seats can participate immediately.

## Skills

Use \`.agents/skills/play-lunchtable-game/SKILL.md\` when playing the game, \`.agents/skills/build-lunchtable-game/SKILL.md\` when extending the ruleset, and \`.agents/skills/evaluate-lunchtable-agent/SKILL.md\` when testing agent behavior.

## Done Criteria

- \`${input.packageManager} run typecheck\` passes.
- \`${input.packageManager} run test\` passes.
- Agents only choose from legal action ids.
- Hidden or private state is exposed only through scoped seat views.
`;
}

function createPlayGameSkill(): string {
  return `---
name: play-lunchtable-game
description: Use when an agent needs to join, observe, or play a Lunch Table Games scaffold through legal actions.
---

# Play Lunch Table Game

Use when an agent needs to join a game seat, inspect the current scoped view, choose one legal action, or submit a turn.

## Workflow

1. Read \`llms.txt\` and \`llms-full.txt\`.
2. Use \`createStarterDecisionFrame\` to get scoped view and legal actions.
3. Choose one \`actionId\` from \`frame.legalActions\`, or choose \`null\`.
4. Resolve external choices through \`resolveExternalAgentResponse\`.
5. Submit through \`runBaselineAgentTurn\` or the equivalent authoritative runtime path.
6. Use \`bun run --silent mcp:stdio\` when a local MCP client needs to connect.
7. Run \`bun run test -- tests/agent-parity.test.ts tests/mcp-server.test.ts tests/self-play.test.ts\` after changing agent behavior.

## Rules

- Never invent an intent payload.
- Never mutate game state directly.
- Never read hidden information outside the current seat view.
- Treat humans and agents as equal seats.
`;
}

function createBuildGameSkill(): string {
  return `---
name: build-lunchtable-game
description: Use when extending a Lunch Table Games scaffold with new rules, objects, legal actions, scenes, or generated game content.
---

# Build Lunch Table Game

Use this skill when changing the ruleset, state shape, tabletop components, render scene, or game content.

## Workflow

1. Read \`src/game.ts\`, \`llms-full.txt\`, and the tests under \`tests/\`.
2. Add or update tests for state, legal intents, agent parity, and self-play.
3. Keep all authoritative changes in the ruleset contract.
4. Keep agents on legal action ids and scoped views.
5. Keep \`src/mcp/server.ts\` wired through the same legal-action runtime.
6. Run \`bun run typecheck\` and \`bun run test\`.

## Rules

- Do not add renderer-only state to the authority model.
- Do not leak private zones into spectator or opponent views.
- Do not let MCP, A2A, or HTTP adapters bypass \`applyIntent\`.
- Keep generated-game content data-driven unless a custom ruleset plugin is required.
`;
}

function createEvaluateAgentSkill(): string {
  return `---
name: evaluate-lunchtable-agent
description: Use when testing or comparing agents in a Lunch Table Games scaffold.
---

# Evaluate Lunch Table Agent

Use this skill when validating that an agent can play fairly and deterministically.

## Workflow

1. Run \`bun run test -- tests/agent-parity.test.ts\`.
2. Run \`bun run test -- tests/mcp-server.test.ts\`.
3. Run \`bun run test -- tests/self-play.test.ts\`.
4. Check that every selected \`actionId\` exists in the current legal action catalog.
5. Check that state version increases only after applied transitions.
6. Compare self-play results after rules or policy changes.

## Rules

- A stronger model may reason better, but it does not get more game authority.
- Invalid external action ids must fail loudly.
- Evaluation fixtures should use deterministic seeds and stable timestamps.
`;
}

function createBaselineAgentSource(
  templateId: ScaffoldTemplateId,
): ScaffoldFileFactory {
  const functionName = getFactoryName(templateId);
  return () => `import {
  createAgentCapabilityManifest,
  createAgentObservationFrame,
  createFirstLegalActionPolicy,
  createLegalActionDescriptors,
  runAgentTurn,
  type AgentTransportKind,
  type LegalActionDescriptor,
} from "@lunchtable/games-ai";

import { ${functionName} } from "../game";

type StarterGame = ReturnType<typeof ${functionName}>;
type StarterState = ReturnType<StarterGame["ruleset"]["createInitialState"]>;
type StarterIntent = ReturnType<StarterGame["ruleset"]["listLegalIntents"]>[number];
type StarterTransition = ReturnType<StarterGame["ruleset"]["applyIntent"]>;
type StarterEvent = StarterTransition["events"][number];
export type StarterSeatView = ReturnType<StarterGame["ruleset"]["deriveSeatView"]>;
export type StarterAction = LegalActionDescriptor<StarterIntent>;

export const baselineAgentManifest = createAgentCapabilityManifest({
  agentId: "baseline-agent",
  displayName: "Baseline Agent",
  supportedTransports: ["local", "external-http", "mcp", "a2a"],
});

export function createStarterInitialState(): StarterState {
  const game = ${functionName}();
  return game.ruleset.createInitialState(game.config);
}

export function createStarterDecisionFrame(input: {
  receivedAt: number;
  seat: string;
  state: StarterState;
  transport: AgentTransportKind;
}) {
  const game = ${functionName}();
  const legalActions = createLegalActionDescriptors(
    game.ruleset.listLegalIntents(input.state, input.seat),
    { actionIdPrefix: input.seat },
  );

  return createAgentObservationFrame({
    deadlineAt: null,
    gameId: game.manifest.title,
    legalActions,
    receivedAt: input.receivedAt,
    rulesetId: game.manifest.title,
    seat: input.seat,
    stateVersion: input.state.shell.version,
    transport: input.transport,
    view: game.ruleset.deriveSeatView(input.state, input.seat),
  });
}

export function createBaselineAgentPolicy() {
  return createFirstLegalActionPolicy<StarterSeatView, StarterAction>();
}

export async function runBaselineAgentTurn(input: {
  receivedAt: number;
  seat: string;
  state: StarterState;
}) {
  const game = ${functionName}();

  return runAgentTurn<
    StarterState,
    StarterIntent,
    StarterEvent,
    StarterSeatView,
    StarterAction
  >({
    createLegalActions: (intents) =>
      createLegalActionDescriptors(intents, { actionIdPrefix: input.seat }),
    deadlineAt: null,
    gameId: game.manifest.title,
    policy: createBaselineAgentPolicy(),
    receivedAt: input.receivedAt,
    ruleset: game.ruleset,
    rulesetId: game.manifest.title,
    seat: input.seat,
    state: input.state,
    stateVersion: input.state.shell.version,
    transport: "local",
  });
}
`;
}

function createExternalHttpAgentSource(): string {
  return `import {
  createExternalDecisionEnvelope,
  resolveExternalActionId,
} from "@lunchtable/games-ai";

import {
  createStarterDecisionFrame,
  type StarterAction,
  type StarterSeatView,
} from "./baseline";

export interface ExternalAgentResponse {
  actionId: string | null;
}

export function createExternalAgentRequest(input: {
  gameId: string;
  receivedAt: number;
  requestId: string;
  rulesetId: string;
  seat: string;
  state: Parameters<typeof createStarterDecisionFrame>[0]["state"];
}) {
  const frame = createStarterDecisionFrame({
    receivedAt: input.receivedAt,
    seat: input.seat,
    state: input.state,
    transport: "external-http",
  });

  return createExternalDecisionEnvelope<StarterSeatView, StarterAction>(frame, {
    gameId: input.gameId,
    requestId: input.requestId,
    rulesetId: input.rulesetId,
  });
}

export function resolveExternalAgentResponse(
  frame: ReturnType<typeof createStarterDecisionFrame>,
  response: ExternalAgentResponse,
) {
  return resolveExternalActionId(frame.legalActions, response.actionId);
}
`;
}

function createMcpAgentSource(): string {
  return `import { createMcpToolManifest } from "@lunchtable/games-ai";

import { baselineAgentManifest } from "./baseline";

export function createStarterMcpToolManifest() {
  return createMcpToolManifest(baselineAgentManifest);
}
`;
}

function createA2aAgentSource(): string {
  return `import { createLunchTableA2aAgentCard } from "@lunchtable/games-ai";

import { baselineAgentManifest } from "./baseline";

export function createStarterA2aAgentCard(endpointUrl: string) {
  return createLunchTableA2aAgentCard(baselineAgentManifest, {
    endpointUrl,
    providerName: "Lunch Table Games",
  });
}
`;
}

function createSelfPlaySource(): string {
  return `import { createStarterInitialState, runBaselineAgentTurn } from "./baseline";

export interface SelfPlayStep {
  actionId: string | null;
  outcome: string;
  seat: string;
}

export async function runStarterSelfPlay(input: {
  receivedAt: number;
  turns: number;
}) {
  let state = createStarterInitialState();
  const seats = ["seat-0", "seat-1"] as const;
  const steps: SelfPlayStep[] = [];

  for (let turn = 0; turn < input.turns; turn += 1) {
    const seat = seats[turn % seats.length];
    const result = await runBaselineAgentTurn({
      receivedAt: input.receivedAt + turn,
      seat,
      state,
    });

    if (result.transition !== null) {
      state = result.transition.nextState;
    }

    steps.push({
      actionId: result.action === null ? null : result.action.actionId,
      outcome: result.outcome,
      seat,
    });
  }

  return {
    state,
    steps,
  };
}
`;
}

function createMcpServerSource(
  templateId: ScaffoldTemplateId,
): ScaffoldFileFactory {
  const functionName = getFactoryName(templateId);

  return () => `import { argv, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { createStarterDecisionFrame } from "../agents/baseline";
import { createStarterMcpToolManifest } from "../agents/mcp";
import { runStarterSelfPlay } from "../agents/self-play";
import { ${functionName} } from "../game";

export const MCP_PROTOCOL_VERSION = "2025-11-25";

type StarterGame = ReturnType<typeof ${functionName}>;
type StarterState = ReturnType<StarterGame["ruleset"]["createInitialState"]>;
type StarterEvent = ReturnType<StarterGame["ruleset"]["applyIntent"]>["events"][number];

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
type JsonRpcId = null | number | string;

interface JsonRpcRequest {
  id?: JsonRpcId;
  jsonrpc: "2.0";
  method: string;
  params?: JsonValue;
}

interface JsonRpcSuccessResponse {
  id: JsonRpcId;
  jsonrpc: "2.0";
  result: JsonValue;
}

interface JsonRpcErrorResponse {
  error: {
    code: number;
    message: string;
  };
  id: JsonRpcId;
  jsonrpc: "2.0";
}

type JsonRpcResponse = JsonRpcErrorResponse | JsonRpcSuccessResponse;

export interface StarterMcpEventLogEntry {
  actionId: string | null;
  at: number;
  events: StarterEvent[];
  outcome: string;
  seat: string;
  stateVersion: number;
}

export interface StarterMcpRuntime {
  eventLog: StarterMcpEventLogEntry[];
  game: StarterGame;
  state: StarterState;
}

const serverInfo = {
  description: "Lunch Table Games starter MCP server",
  name: "lunchtable-starter",
  title: "Lunch Table Games Starter",
  version: "0.1.0",
};

const resources = [
  {
    description: "Starter game manifest and runtime metadata.",
    mimeType: "application/json",
    name: "game-manifest",
    title: "Game Manifest",
    uri: "lunchtable://game/manifest",
  },
  {
    description: "Public rules, legal intent kinds, and render components.",
    mimeType: "application/json",
    name: "rules",
    title: "Rules Summary",
    uri: "lunchtable://game/rules",
  },
  {
    description: "Current process-local authoritative starter state.",
    mimeType: "application/json",
    name: "runtime-state",
    title: "Runtime State",
    uri: "lunchtable://runtime/state",
  },
  {
    description: "Applied MCP action events in this server process.",
    mimeType: "application/json",
    name: "event-log",
    title: "Event Log",
    uri: "lunchtable://runtime/events",
  },
] as const;

export function createStarterMcpServerRuntime(): StarterMcpRuntime {
  const game = ${functionName}();

  return {
    eventLog: [],
    game,
    state: game.ruleset.createInitialState(game.config),
  };
}

export async function handleStarterMcpRequest(
  runtime: StarterMcpRuntime,
  request: JsonValue,
): Promise<JsonRpcResponse | null> {
  if (!isJsonObject(request)) {
    return createErrorResponse(null, -32600, "MCP request must be a JSON object");
  }

  const id = getJsonRpcId(request.id);
  const method = request.method;
  if (request.jsonrpc !== "2.0" || typeof method !== "string") {
    return createErrorResponse(id, -32600, "Invalid JSON-RPC request");
  }

  if (request.id === undefined && method === "notifications/initialized") {
    return null;
  }

  try {
    if (method === "initialize") {
      return createSuccessResponse(id, {
        capabilities: {
          resources: { listChanged: false },
          tools: { listChanged: false },
        },
        instructions:
          "Use listLegalActions before submitAction. Submit only action ids returned for the same seat and stateVersion.",
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo,
      });
    }

    if (method === "ping") {
      return createSuccessResponse(id, {});
    }

    if (method === "tools/list") {
      return createSuccessResponse(id, {
        tools: createStarterMcpToolDefinitions(),
      });
    }

    if (method === "tools/call") {
      return createSuccessResponse(
        id,
        await callStarterMcpTool(runtime, request.params),
      );
    }

    if (method === "resources/list") {
      return createSuccessResponse(id, {
        resources: resources.map((resource) => ({ ...resource })),
      });
    }

    if (method === "resources/read") {
      return createSuccessResponse(
        id,
        readStarterMcpResource(runtime, request.params),
      );
    }

    return createErrorResponse(id, -32601, \`Unsupported MCP method: \${method}\`);
  } catch (error) {
    if (error instanceof Error && error.message.length > 0) {
      return createErrorResponse(id, -32603, error.message);
    }
    return createErrorResponse(id, -32603, "MCP request failed");
  }
}

export async function runStarterMcpStdioServer(
  runtime = createStarterMcpServerRuntime(),
): Promise<void> {
  const lines = createInterface({ input: stdin });

  for await (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }

    let parsed: JsonValue;
    try {
      parsed = JSON.parse(line);
    } catch {
      stdout.write(
        \`\${JSON.stringify(createErrorResponse(null, -32700, "Parse error"))}\\n\`,
      );
      continue;
    }

    const response = await handleStarterMcpRequest(runtime, parsed);
    if (response !== null) {
      stdout.write(\`\${JSON.stringify(response)}\\n\`);
    }
  }
}

function createStarterMcpToolDefinitions(): JsonValue[] {
  return createStarterMcpToolManifest().tools.map((tool) =>
    toJsonValue({
      description: tool.description,
      inputSchema: tool.inputSchema,
      name: tool.name,
      title: createToolTitle(tool.name),
    }),
  );
}

async function callStarterMcpTool(
  runtime: StarterMcpRuntime,
  params: JsonValue | undefined,
): Promise<JsonObject> {
  if (!isJsonObject(params) || typeof params.name !== "string") {
    return createToolError("MCP tools/call requires a string tool name");
  }

  const args = isJsonObject(params.arguments) ? params.arguments : {};

  switch (params.name) {
    case "joinGameSeat":
      return createToolResult({
        gameId: runtime.game.manifest.title,
        seat: optionalString(args, "requestedSeat") ?? "seat-0",
        transport: "mcp",
      });
    case "observeGame": {
      const seat = requireString(args, "seat");
      return createToolResult(createObservation(runtime, seat));
    }
    case "listLegalActions": {
      const seat = requireString(args, "seat");
      const frame = createDecisionFrame(runtime, seat);
      return createToolResult({
        legalActions: toJsonValue(frame.legalActions),
        seat,
        stateVersion: runtime.state.shell.version,
      });
    }
    case "submitAction":
      return submitAction(runtime, args);
    case "passPriority": {
      const seat = requireString(args, "seat");
      const frame = createDecisionFrame(runtime, seat);
      const action = frame.legalActions.find(
        (candidate) => String(candidate.kind) === "pass",
      );
      if (action === undefined) {
        return createToolError(\`Pass is not legal for seat \${seat}\`);
      }
      return submitAction(runtime, {
        actionId: action.actionId,
        seat,
        stateVersion: runtime.state.shell.version,
      });
    }
    case "getRules":
      return createToolResult(createRulesSummary(runtime));
    case "getObjective":
      return createToolResult({
        activeSeatId: runtime.state.shell.activeSeatId,
        phase: runtime.state.shell.phase,
        seat: optionalString(args, "seat") ?? null,
        status: runtime.state.shell.status,
      });
    case "getReplay":
    case "subscribeEvents":
      return createToolResult({
        events: toJsonValue(runtime.eventLog),
        stateVersion: runtime.state.shell.version,
      });
    case "runSelfPlay": {
      const turns = optionalNumber(args, "turns") ?? 2;
      return createToolResult(
        toJsonValue(await runStarterSelfPlay({
          receivedAt: 1777739000000,
          turns,
        })),
      );
    }
    case "evaluateAgent": {
      const result = await runStarterSelfPlay({
        receivedAt: 1777739000000,
        turns: 2,
      });
      return createToolResult({
        ok: result.steps.every((step) => step.outcome === "submitted"),
        steps: toJsonValue(result.steps),
      });
    }
    default:
      return createToolError(\`Unsupported MCP tool: \${params.name}\`);
  }
}

function submitAction(
  runtime: StarterMcpRuntime,
  args: JsonObject,
): JsonObject {
  const seat = requireString(args, "seat");
  const actionId = requireString(args, "actionId");
  const stateVersion = requireNumber(args, "stateVersion");

  if (stateVersion !== runtime.state.shell.version) {
    return createToolError(
      \`State version mismatch. Expected \${runtime.state.shell.version} but received \${stateVersion}\`,
    );
  }

  const frame = createDecisionFrame(runtime, seat);
  const action = frame.legalActions.find(
    (candidate) => candidate.actionId === actionId,
  );
  if (action === undefined) {
    return createToolError(\`Unknown or illegal actionId: \${actionId}\`);
  }

  const transition = runtime.game.ruleset.applyIntent(runtime.state, action.intent);
  runtime.state = transition.nextState;
  runtime.eventLog.push({
    actionId,
    at: Date.now(),
    events: transition.events,
    outcome: transition.outcome,
    seat,
    stateVersion: runtime.state.shell.version,
  });

  return createToolResult({
    actionId,
    events: toJsonValue(transition.events),
    outcome: transition.outcome,
    seat,
    stateVersion: runtime.state.shell.version,
  });
}

function createDecisionFrame(runtime: StarterMcpRuntime, seat: string) {
  return createStarterDecisionFrame({
    receivedAt: Date.now(),
    seat,
    state: runtime.state,
    transport: "mcp",
  });
}

function createObservation(runtime: StarterMcpRuntime, seat: string): JsonObject {
  return {
    seat,
    stateVersion: runtime.state.shell.version,
    view: toJsonValue(runtime.game.ruleset.deriveSeatView(runtime.state, seat)),
  };
}

function createRulesSummary(runtime: StarterMcpRuntime): JsonObject {
  return {
    components: toJsonValue(runtime.game.components),
    manifest: toJsonValue(runtime.game.manifest),
    renderScene: toJsonValue(
      runtime.game.ruleset.deriveRenderScene(runtime.state, {
        height: 720,
        width: 1280,
      }),
    ),
    sampleLegalActions: toJsonValue(
      createDecisionFrame(runtime, "seat-0").legalActions,
    ),
  };
}

function readStarterMcpResource(
  runtime: StarterMcpRuntime,
  params: JsonValue | undefined,
): JsonObject {
  if (!isJsonObject(params) || typeof params.uri !== "string") {
    throw new Error("resources/read requires a URI");
  }

  const uri = params.uri;
  let payload: JsonValue;
  if (uri === "lunchtable://game/manifest") {
    payload = toJsonValue(runtime.game.manifest);
  } else if (uri === "lunchtable://game/rules") {
    payload = createRulesSummary(runtime);
  } else if (uri === "lunchtable://runtime/state") {
    payload = toJsonValue(runtime.state);
  } else if (uri === "lunchtable://runtime/events") {
    payload = toJsonValue(runtime.eventLog);
  } else {
    throw new Error(\`Unknown MCP resource: \${uri}\`);
  }

  return {
    contents: [
      {
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
        uri,
      },
    ],
  };
}

function createToolResult(structuredContent: JsonValue): JsonObject {
  return {
    content: [
      {
        text: JSON.stringify(structuredContent, null, 2),
        type: "text",
      },
    ],
    isError: false,
    structuredContent,
  };
}

function createToolError(message: string): JsonObject {
  return {
    content: [{ text: message, type: "text" }],
    isError: true,
  };
}

function createSuccessResponse(
  id: JsonRpcId,
  result: JsonValue,
): JsonRpcSuccessResponse {
  return {
    id,
    jsonrpc: "2.0",
    result,
  };
}

function createErrorResponse(
  id: JsonRpcId,
  code: number,
  message: string,
): JsonRpcErrorResponse {
  return {
    error: { code, message },
    id,
    jsonrpc: "2.0",
  };
}

function requireString(args: JsonObject, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(\`\${key} must be a non-empty string\`);
  }
  return value;
}

function optionalString(args: JsonObject, key: string): string | null {
  const value = args[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(\`\${key} must be a string\`);
  }
  return value;
}

function requireNumber(args: JsonObject, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(\`\${key} must be an integer\`);
  }
  return value;
}

function optionalNumber(args: JsonObject, key: string): number | null {
  const value = args[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(\`\${key} must be an integer\`);
  }
  return value;
}

function getJsonRpcId(value: JsonValue | undefined): JsonRpcId {
  if (typeof value === "number" || typeof value === "string" || value === null) {
    return value;
  }
  return null;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonValue(value: object): JsonValue {
  return JSON.parse(JSON.stringify(value));
}

function createToolTitle(name: string): string {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (letter) =>
    letter.toUpperCase(),
  );
}

if (argv[1]?.endsWith("src/mcp/server.ts")) {
  await runStarterMcpStdioServer();
}
`;
}

function createPackageJson(input: ScaffoldFileInput): string {
  const dependencies: Record<string, string> = {
    "@lunchtable/games-ai": "latest",
    "@lunchtable/games-core": "latest",
    "@lunchtable/games-render": "latest",
    "@lunchtable/games-tabletop": "latest",
  };
  if (input.template.id === "side-scroller") {
    dependencies["@lunchtable/games-side-scroller"] = "latest";
  }

  return `${JSON.stringify(
    {
      name: input.packageName,
      private: true,
      scripts: {
        "mcp:stdio": "bun src/mcp/server.ts",
        test: "vitest run",
        typecheck: "tsc --noEmit",
      },
      type: "module",
      dependencies,
      devDependencies: {
        "@types/node": "^24.6.1",
        typescript: "^5.9.3",
        vitest: "^3.2.4",
      },
    },
    null,
    2,
  )}\n`;
}

function createTsconfig(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        lib: ["ES2022", "DOM"],
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: true,
        strict: true,
        target: "ES2022",
        types: ["node"],
      },
      include: ["src/**/*.ts", "tests/**/*.ts"],
    },
    null,
    2,
  )}\n`;
}

function createGameSource(templateId: ScaffoldTemplateId): ScaffoldFileFactory {
  if (templateId === "tcg") {
    return createTcgGameSource;
  }

  if (templateId === "dice") {
    return createDiceGameSource;
  }

  if (templateId === "side-scroller") {
    return createSideScrollerGameSource;
  }

  return createShooterGameSource;
}

function createGameTestSource(
  templateId: ScaffoldTemplateId,
): ScaffoldFileFactory {
  const functionName = getFactoryName(templateId);
  if (templateId === "side-scroller") {
    return () => `import { describe, expect, it } from "vitest";

import { ${functionName} } from "../src/game";

describe("${templateId} scaffold", () => {
  it("creates a valid Lunch Table Games starter", () => {
    const game = ${functionName}();

    expect(game.manifest.runtime).toBe("lunchtable");
    expect(game.components.length).toBeGreaterThan(0);
    expect(game.ruleset.createInitialState(game.config).shell.status).toBe("playing");
  });

  it("advances both runners through legal side-scroller actions", () => {
    const game = ${functionName}();
    let state = game.ruleset.createInitialState(game.config);
    const seat0Actions = game.ruleset.listLegalIntents(state, "seat-0");
    const moveRight = seat0Actions.find((intent) => intent.kind === "moveRight");
    const dash = seat0Actions.find((intent) => intent.kind === "dash");

    expect(moveRight).toBeDefined();
    expect(dash).toBeDefined();
    if (moveRight === undefined) {
      throw new Error("moveRight should be legal");
    }

    state = game.ruleset.applyIntent(state, moveRight).nextState;
    const seat1Actions = game.ruleset.listLegalIntents(state, "seat-1");
    const wait = seat1Actions.find((intent) => intent.kind === "wait");

    expect(wait).toBeDefined();
    if (wait === undefined) {
      throw new Error("wait should be legal");
    }

    state = game.ruleset.applyIntent(state, wait).nextState;

    expect(state.runners["seat-0"].x).toBeGreaterThan(0);
    expect(state.runners["seat-1"].x).toBe(0);
    expect(state.shell.version).toBe(2);
  });

  it("renders runners, hazards, collectibles, and the goal", () => {
    const game = ${functionName}();
    const state = game.ruleset.createInitialState(game.config);
    const scene = game.ruleset.deriveRenderScene(state, {
      height: 720,
      width: 1280,
    });
    const objectIds = scene.objects.map((object) => object.id);

    expect(scene.camera?.mode).toBe("side-scroller");
    expect(objectIds).toContain("platform:ground");
    expect(objectIds).toContain("platform:ledge-1");
    expect(objectIds).toContain("piece:runner-seat-0");
    expect(objectIds).toContain("piece:runner-seat-1");
    expect(objectIds).toContain("token:hazard-1");
    expect(objectIds).toContain("token:collectible-1");
    expect(objectIds).toContain("token:goal");
  });
});
`;
  }

  return () => `import { describe, expect, it } from "vitest";

import { ${functionName} } from "../src/game";

describe("${templateId} scaffold", () => {
  it("creates a valid Lunch Table Games starter", () => {
    const game = ${functionName}();

    expect(game.manifest.runtime).toBe("lunchtable");
    expect(game.components.length).toBeGreaterThan(0);
    expect(game.ruleset.createInitialState(game.config).shell.status).toBe("playing");
  });
});
`;
}

function createAgentParityTestSource(
  templateId: ScaffoldTemplateId,
): ScaffoldFileFactory {
  return () => `import { describe, expect, it } from "vitest";

import {
  createStarterDecisionFrame,
  createStarterInitialState,
  runBaselineAgentTurn,
} from "../src/agents/baseline";
import { resolveExternalAgentResponse } from "../src/agents/external-http";
import { createStarterA2aAgentCard } from "../src/agents/a2a";
import { createStarterMcpToolManifest } from "../src/agents/mcp";

describe("${templateId} agent parity", () => {
  it("chooses from legal actions and submits through the ruleset", async () => {
    const state = createStarterInitialState();
    const frame = createStarterDecisionFrame({
      receivedAt: 1777739000000,
      seat: "seat-0",
      state,
      transport: "local",
    });
    const result = await runBaselineAgentTurn({
      receivedAt: 1777739000000,
      seat: "seat-0",
      state,
    });

    expect(frame.legalActions.length).toBeGreaterThan(0);
    expect(frame.legalActions.map((action) => action.actionId)).toContain(
      result.action?.actionId,
    );
    expect(result.transition?.outcome).toBe("applied");
  });

  it("rejects invented external action ids", () => {
    const state = createStarterInitialState();
    const frame = createStarterDecisionFrame({
      receivedAt: 1777739000000,
      seat: "seat-0",
      state,
      transport: "external-http",
    });

    expect(() =>
      resolveExternalAgentResponse(frame, { actionId: "invented-action" }),
    ).toThrow("External agent returned an unrecognized actionId");
  });

  it("ships MCP tools and an A2A agent card", () => {
    expect(createStarterMcpToolManifest().tools.map((tool) => tool.name)).toContain(
      "submitAction",
    );
    expect(
      createStarterA2aAgentCard("https://agents.example.test/lunchtable").skills.map(
        (skill) => skill.id,
      ),
    ).toContain("play-legal-action");
  });
});
`;
}

function createSelfPlayTestSource(
  templateId: ScaffoldTemplateId,
): ScaffoldFileFactory {
  return () => `import { describe, expect, it } from "vitest";

import { runStarterSelfPlay } from "../src/agents/self-play";

describe("${templateId} agent self-play", () => {
  it("runs deterministic baseline agents from both seats", async () => {
    const result = await runStarterSelfPlay({
      receivedAt: 1777739000000,
      turns: 2,
    });

    expect(result.steps).toEqual([
      expect.objectContaining({ outcome: "submitted", seat: "seat-0" }),
      expect.objectContaining({ outcome: "submitted", seat: "seat-1" }),
    ]);
    expect(result.state.shell.version).toBe(2);
  });
});
`;
}

function createMcpServerTestSource(
  templateId: ScaffoldTemplateId,
): ScaffoldFileFactory {
  return () => `import { describe, expect, it } from "vitest";

import {
  createStarterMcpServerRuntime,
  handleStarterMcpRequest,
} from "../src/mcp/server";

type McpResponse = Awaited<ReturnType<typeof handleStarterMcpRequest>>;

interface ToolResultContent {
  text: string;
  type: "text";
}

interface LegalActionsPayload {
  legalActions: Array<{ actionId: string }>;
  stateVersion: number;
}

function readToolJson(response: McpResponse): LegalActionsPayload {
  if (response === null) {
    throw new Error("MCP tool response was null");
  }

  const parsedResponse: { result: { content: ToolResultContent[] } } =
    JSON.parse(JSON.stringify(response));
  const text = parsedResponse.result.content[0]?.text;
  if (text === undefined) {
    throw new Error("MCP tool response did not include text content");
  }

  const parsed: LegalActionsPayload = JSON.parse(text);
  return parsed;
}

describe("${templateId} MCP server", () => {
  it("negotiates MCP capabilities and exposes tools/resources", async () => {
    const runtime = createStarterMcpServerRuntime();

    await expect(
      handleStarterMcpRequest(runtime, {
        id: 1,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.1.0" },
          protocolVersion: "2025-11-25",
        },
      }),
    ).resolves.toMatchObject({
      result: {
        capabilities: {
          resources: { listChanged: false },
          tools: { listChanged: false },
        },
        protocolVersion: "2025-11-25",
      },
    });

    await expect(
      handleStarterMcpRequest(runtime, {
        id: 2,
        jsonrpc: "2.0",
        method: "tools/list",
      }),
    ).resolves.toMatchObject({
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "listLegalActions" }),
          expect.objectContaining({ name: "submitAction" }),
        ]),
      },
    });

    await expect(
      handleStarterMcpRequest(runtime, {
        id: 3,
        jsonrpc: "2.0",
        method: "resources/list",
      }),
    ).resolves.toMatchObject({
      result: {
        resources: expect.arrayContaining([
          expect.objectContaining({ uri: "lunchtable://runtime/state" }),
        ]),
      },
    });
  });

  it("lists and submits legal actions through MCP tools", async () => {
    const runtime = createStarterMcpServerRuntime();
    const legalResponse = await handleStarterMcpRequest(runtime, {
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { gameId: "starter", seat: "seat-0" },
        name: "listLegalActions",
      },
    });
    const legalPayload = readToolJson(legalResponse);
    const actionId = legalPayload.legalActions[0]?.actionId;

    expect(actionId).toBeTypeOf("string");

    await expect(
      handleStarterMcpRequest(runtime, {
        id: 2,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: {
            actionId,
            gameId: "starter",
            seat: "seat-0",
            stateVersion: legalPayload.stateVersion,
          },
          name: "submitAction",
        },
      }),
    ).resolves.toMatchObject({
      result: {
        isError: false,
      },
    });
    expect(runtime.state.shell.version).toBe(1);
  });

  it("reads runtime resources for connected agent tooling", async () => {
    const runtime = createStarterMcpServerRuntime();

    await expect(
      handleStarterMcpRequest(runtime, {
        id: 1,
        jsonrpc: "2.0",
        method: "resources/read",
        params: { uri: "lunchtable://runtime/state" },
      }),
    ).resolves.toMatchObject({
      result: {
        contents: [
          expect.objectContaining({
            mimeType: "application/json",
            uri: "lunchtable://runtime/state",
          }),
        ],
      },
    });
  });
});
`;
}

function getFactoryName(templateId: ScaffoldTemplateId): string {
  if (templateId === "tcg") {
    return "createTradingCardGame";
  }

  if (templateId === "dice") {
    return "createDiceDuelGame";
  }

  if (templateId === "side-scroller") {
    return "createSideScrollerGame";
  }

  return "createShooter3dGame";
}

function createTcgGameSource(): string {
  return `import type { GameRuleset, GameShell } from "@lunchtable/games-core";
import type { TabletopComponent, TabletopZone } from "@lunchtable/games-tabletop";
import type { RenderCameraHint, RenderSceneModel } from "@lunchtable/games-render";

interface TcgConfig {
  seed: string;
}

interface TcgState {
  shell: GameShell;
  hands: Record<string, string[]>;
}

type TcgIntent =
  | { kind: "pass"; seatId: string }
  | { cardId: string; kind: "playCard"; seatId: string };

interface TcgEvent {
  kind: "cardPlayed" | "priorityPassed";
  seatId: string;
}

const camera: RenderCameraHint = {
  mode: "isometric-2.5d",
  target: { x: 0, y: 0, z: 0 },
  zoom: 1,
};

const components: TabletopComponent[] = [
  {
    id: "board:table",
    kind: "board",
    name: "Duel Table",
    surface: { height: 900, shape: "rectangle", width: 1600 },
  },
  {
    id: "deck:seat-0",
    kind: "deck",
    name: "Seat 0 Deck",
    ordering: "randomized",
    zoneId: "seat-0-deck",
  },
];

const zones: TabletopZone[] = [
  {
    id: "seat-0-deck",
    kind: "deck",
    name: "Seat 0 Deck",
    ordering: "ordered",
    ownerSeat: "seat-0",
    visibility: "private-owner",
  },
];

const ruleset: GameRuleset<TcgConfig, TcgState, TcgIntent, TcgEvent, TcgState, TcgState, RenderSceneModel> = {
  applyIntent(state, intent) {
    if (intent.kind === "playCard") {
      const hand = state.hands[intent.seatId];
      if (hand === undefined || !hand.includes(intent.cardId)) {
        return {
          events: [],
          nextState: state,
          outcome: "rejected",
          reason: "cardNotInHand",
        };
      }

      return {
        events: [{ kind: "cardPlayed", seatId: intent.seatId }],
        nextState: {
          ...state,
          hands: {
            ...state.hands,
            [intent.seatId]: hand.filter((cardId) => cardId !== intent.cardId),
          },
          shell: { ...state.shell, version: state.shell.version + 1 },
        },
        outcome: "applied",
      };
    }

    return {
      events: [{ kind: "priorityPassed", seatId: intent.seatId }],
      nextState: {
        ...state,
        shell: { ...state.shell, version: state.shell.version + 1 },
      },
      outcome: "applied",
    };
  },
  createInitialState(config) {
    return {
      hands: {
        "seat-0": ["starter-card"],
        "seat-1": ["starter-card"],
      },
      shell: createShell("tcg-starter", config.seed),
    };
  },
  deriveRenderScene(state) {
    return {
      camera,
      cue: null,
      interactions: [],
      objects: [],
      viewport: { height: 900, width: 1600 },
    };
  },
  deriveSeatView(state) {
    return state;
  },
  deriveSpectatorView(state) {
    return state;
  },
  listLegalIntents(state, seatId) {
    const hand = state.hands[seatId];
    if (hand === undefined || hand.length === 0) {
      return [{ kind: "pass", seatId }];
    }

    return [{ cardId: hand[0], kind: "playCard", seatId }, { kind: "pass", seatId }];
  },
};

export function createTradingCardGame() {
  return {
    components,
    config: { seed: "seed:tcg" },
    manifest: {
      genre: "card-tabletop",
      runtime: "lunchtable",
      title: "Trading Card Starter",
      version: "0.1.0",
    },
    ruleset,
    zones,
  };
}

function createShell(id: string, rulesetId: string): GameShell {
  return {
    activeSeatId: "seat-0",
    format: { id, name: "Starter", rulesetId, version: "0.1.0" },
    id,
    phase: "main",
    prioritySeatId: "seat-0",
    round: 1,
    status: "playing",
    timers: [],
    version: 0,
  };
}
`;
}

function createDiceGameSource(): string {
  return `import {
  deriveDeterministicNumber,
  type GameRuleset,
  type GameShell,
} from "@lunchtable/games-core";
import type { TabletopComponent } from "@lunchtable/games-tabletop";
import type { RenderCameraHint, RenderSceneModel } from "@lunchtable/games-render";

interface DiceConfig {
  seed: string;
}

interface DiceState {
  cursor: number;
  lastRoll: number | null;
  seed: string;
  shell: GameShell;
}

type DiceIntent = { kind: "pass"; seatId: string } | { kind: "roll"; seatId: string };
type DiceEvent = { kind: "passed" | "rolled"; seatId: string; value: number | null };

const camera: RenderCameraHint = {
  mode: "orthographic-2d",
  target: { x: 0, y: 0, z: 0 },
  zoom: 1,
};

const components: TabletopComponent[] = [
  {
    faces: 6,
    id: "die:attack",
    kind: "die",
    name: "Attack Die",
    values: ["1", "2", "3", "4", "5", "6"],
  },
  {
    id: "board:felt",
    kind: "board",
    name: "Felt Board",
    surface: { height: 800, shape: "rectangle", width: 1200 },
  },
];

const ruleset: GameRuleset<DiceConfig, DiceState, DiceIntent, DiceEvent, DiceState, DiceState, RenderSceneModel> = {
  applyIntent(state, intent) {
    if (intent.kind === "pass") {
      return {
        events: [{ kind: "passed", seatId: intent.seatId, value: null }],
        nextState: {
          ...state,
          shell: { ...state.shell, version: state.shell.version + 1 },
        },
        outcome: "applied",
      };
    }

    const [randomValue, random] = deriveDeterministicNumber({
      cursor: state.cursor,
      seed: state.seed,
    });
    const roll = Math.floor(randomValue * 6) + 1;

    return {
      events: [{ kind: "rolled", seatId: intent.seatId, value: roll }],
      nextState: {
        cursor: random.cursor,
        lastRoll: roll,
        seed: state.seed,
        shell: { ...state.shell, version: state.shell.version + 1 },
      },
      outcome: "applied",
    };
  },
  createInitialState(config) {
    return {
      cursor: 0,
      lastRoll: null,
      seed: config.seed,
      shell: createShell("dice-duel", config.seed),
    };
  },
  deriveRenderScene() {
    return {
      camera,
      cue: null,
      interactions: [{ affordance: "activate", objectId: "die:attack", seatId: "seat-0" }],
      objects: [],
      viewport: { height: 800, width: 1200 },
    };
  },
  deriveSeatView(state) {
    return state;
  },
  deriveSpectatorView(state) {
    return state;
  },
  listLegalIntents(_state, seatId) {
    return [{ kind: "roll", seatId }, { kind: "pass", seatId }];
  },
};

export function createDiceDuelGame() {
  return {
    components,
    config: { seed: "seed:dice" },
    manifest: {
      genre: "dice-tabletop",
      runtime: "lunchtable",
      title: "Dice Duel Starter",
      version: "0.1.0",
    },
    ruleset,
  };
}

function createShell(id: string, rulesetId: string): GameShell {
  return {
    activeSeatId: "seat-0",
    format: { id, name: "Starter", rulesetId, version: "0.1.0" },
    id,
    phase: "roll",
    prioritySeatId: "seat-0",
    round: 1,
    status: "playing",
    timers: [],
    version: 0,
  };
}
`;
}

function createSideScrollerGameSource(): string {
  return `import {
  createSideScrollerComponents,
  createSideScrollerRuleset,
  sideScrollerStarterConfig,
} from "@lunchtable/games-side-scroller";

export function createSideScrollerGame() {
  return {
    components: createSideScrollerComponents(sideScrollerStarterConfig),
    config: { seed: "seed:side-scroller" },
    manifest: {
      genre: "side-scroller",
      runtime: "lunchtable",
      title: sideScrollerStarterConfig.title,
      version: sideScrollerStarterConfig.version,
    },
    ruleset: createSideScrollerRuleset(sideScrollerStarterConfig),
  };
}
`;
}

function createShooterGameSource(): string {
  return `import type { GameRuleset, GameShell } from "@lunchtable/games-core";
import type { TabletopComponent } from "@lunchtable/games-tabletop";
import type { RenderCameraHint, RenderSceneModel } from "@lunchtable/games-render";

interface ShooterConfig {
  seed: string;
}

interface ShooterState {
  ammo: number;
  shell: GameShell;
}

type ShooterIntent = { kind: "fire"; seatId: string } | { kind: "reload"; seatId: string };
type ShooterEvent = { kind: "fired" | "reloaded"; seatId: string };

const camera: RenderCameraHint = {
  mode: "first-person",
  target: { x: 0, y: 1.6, z: 0 },
  zoom: 1,
};

const components: TabletopComponent[] = [
  {
    id: "board:arena",
    kind: "board",
    name: "Arena",
    surface: { height: 1024, shape: "rectangle", width: 1024 },
  },
  {
    id: "piece:player",
    kind: "piece",
    movement: { axes: ["x", "y", "z"], grid: "continuous" },
    name: "Player",
  },
];

const ruleset: GameRuleset<ShooterConfig, ShooterState, ShooterIntent, ShooterEvent, ShooterState, ShooterState, RenderSceneModel> = {
  applyIntent(state, intent) {
    if (intent.kind === "reload") {
      return {
        events: [{ kind: "reloaded", seatId: intent.seatId }],
        nextState: { ammo: 6, shell: { ...state.shell, version: state.shell.version + 1 } },
        outcome: "applied",
      };
    }

    if (state.ammo <= 0) {
      return {
        events: [],
        nextState: state,
        outcome: "rejected",
        reason: "emptyMagazine",
      };
    }

    return {
      events: [{ kind: "fired", seatId: intent.seatId }],
      nextState: { ammo: state.ammo - 1, shell: { ...state.shell, version: state.shell.version + 1 } },
      outcome: "applied",
    };
  },
  createInitialState(config) {
    return { ammo: 6, shell: createShell("shooter-3d-starter", config.seed) };
  },
  deriveRenderScene() {
    return {
      camera,
      cue: null,
      interactions: [{ affordance: "activate", objectId: "piece:player", seatId: "seat-0" }],
      objects: [],
      viewport: { height: 720, width: 1280 },
    };
  },
  deriveSeatView(state) {
    return state;
  },
  deriveSpectatorView(state) {
    return state;
  },
  listLegalIntents(_state, seatId) {
    return [{ kind: "fire", seatId }, { kind: "reload", seatId }];
  },
};

export function createShooter3dGame() {
  return {
    components,
    config: { seed: "seed:shooter-3d" },
    manifest: {
      genre: "arena-shooter-3d",
      runtime: "lunchtable",
      title: "3D Shooter Starter",
      version: "0.1.0",
    },
    ruleset,
  };
}

function createShell(id: string, rulesetId: string): GameShell {
  return {
    activeSeatId: "seat-0",
    format: { id, name: "Starter", rulesetId, version: "0.1.0" },
    id,
    phase: "combat",
    prioritySeatId: "seat-0",
    round: 1,
    status: "playing",
    timers: [],
    version: 0,
  };
}
`;
}
