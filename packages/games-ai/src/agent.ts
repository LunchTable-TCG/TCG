import type { LegalActionDescriptor } from "./actions";
import { resolveExternalActionId } from "./external";

export type AgentTransportKind = "a2a" | "external-http" | "local" | "mcp";

export type AgentToolAuthority = "intent-submit" | "read" | "simulation";

export type AgentToolName =
  | "evaluateAgent"
  | "getObjective"
  | "getReplay"
  | "getRules"
  | "joinGameSeat"
  | "listLegalActions"
  | "observeGame"
  | "passPriority"
  | "runSelfPlay"
  | "submitAction"
  | "subscribeEvents";

export type AgentToolSchemaValueType =
  | "array"
  | "boolean"
  | "integer"
  | "number"
  | "object"
  | "string";

export interface AgentToolSchemaProperty {
  description: string;
  type: AgentToolSchemaValueType;
}

export interface AgentToolSchema {
  properties: Record<string, AgentToolSchemaProperty>;
  required: string[];
  type: "object";
}

export interface AgentToolDescriptor {
  authority: AgentToolAuthority;
  description: string;
  inputSchema: AgentToolSchema;
  name: AgentToolName;
  outputSchema: AgentToolSchema;
}

export interface AgentCapabilityManifest {
  agentId: string;
  displayName: string;
  description: string;
  supportedTransports: AgentTransportKind[];
  tools: AgentToolDescriptor[];
}

export interface CreateAgentCapabilityManifestInput {
  agentId: string;
  description?: string;
  displayName: string;
  supportedTransports: AgentTransportKind[];
  tools?: AgentToolDescriptor[];
}

export interface AgentJoinRequest {
  agentId: string;
  gameId: string;
  requestedSeat: string | null;
  transport: AgentTransportKind;
}

export interface AgentSeat {
  agentId: string;
  displayName: string;
  seat: string;
  transport: AgentTransportKind;
}

export interface AgentObservationFrame<
  TView,
  TAction extends LegalActionDescriptor,
> {
  deadlineAt: number | null;
  gameId: string;
  legalActions: TAction[];
  receivedAt: number;
  rulesetId: string;
  seat: string;
  stateVersion: number;
  transport: AgentTransportKind;
  view: TView;
}

export interface CreateAgentObservationFrameInput<
  TView,
  TAction extends LegalActionDescriptor,
> {
  deadlineAt: number | null;
  gameId: string;
  legalActions: TAction[];
  receivedAt: number;
  rulesetId: string;
  seat: string;
  stateVersion: number;
  transport: AgentTransportKind;
  view: TView;
}

export interface AgentDecision {
  actionId: string | null;
  reason: string;
}

export interface AgentPolicy<TView, TAction extends LegalActionDescriptor> {
  decide: (
    frame: AgentObservationFrame<TView, TAction>,
  ) => AgentDecision | Promise<AgentDecision>;
  policyId: string;
}

export interface AgentGameTransition<TState, TEvent> {
  events: TEvent[];
  nextState: TState;
  outcome: string;
  reason?: string;
}

export interface AgentPlayableRuleset<TState, TIntent, TEvent, TSeatView> {
  applyIntent: (
    state: TState,
    intent: TIntent,
  ) => AgentGameTransition<TState, TEvent>;
  deriveSeatView: (state: TState, seat: string) => TSeatView;
  listLegalIntents: (state: TState, seat: string) => TIntent[];
}

export interface RunAgentTurnInput<
  TState,
  TIntent extends { kind: string },
  TEvent,
  TSeatView,
  TAction extends LegalActionDescriptor<TIntent>,
> {
  createLegalActions: (intents: TIntent[]) => TAction[];
  deadlineAt: number | null;
  gameId: string;
  policy: AgentPolicy<TSeatView, TAction>;
  receivedAt: number;
  ruleset: AgentPlayableRuleset<TState, TIntent, TEvent, TSeatView>;
  rulesetId: string;
  seat: string;
  state: TState;
  stateVersion: number;
  transport: AgentTransportKind;
}

export interface AgentTurnResult<
  TState,
  TIntent extends { kind: string },
  TEvent,
  TSeatView,
  TAction extends LegalActionDescriptor<TIntent>,
> {
  action: TAction | null;
  decision: AgentDecision;
  frame: AgentObservationFrame<TSeatView, TAction>;
  outcome: "no-action" | "submitted";
  transition: AgentGameTransition<TState, TEvent> | null;
}

export interface CreateLegalActionDescriptorOptions {
  actionIdPrefix: string;
}

export interface McpToolManifest {
  tools: Array<{
    description: string;
    inputSchema: AgentToolSchema;
    name: AgentToolName;
  }>;
}

export interface LunchTableA2aAgentCard {
  capabilities: {
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
    streaming: boolean;
  };
  description: string;
  name: string;
  protocol: "a2a";
  protocolVersion: "0.3.0";
  provider: {
    organization: string;
  };
  skills: Array<{
    description: string;
    id: string;
    name: string;
    tags: string[];
  }>;
  url: string;
}

export interface CreateLunchTableA2aAgentCardInput {
  endpointUrl: string;
  providerName: string;
}

export function createAgentToolManifest(): AgentToolDescriptor[] {
  return [
    createTool(
      "joinGameSeat",
      "Join an available game seat.",
      "intent-submit",
      ["gameId"],
    ),
    createTool(
      "observeGame",
      "Read the scoped view for the active seat.",
      "read",
      ["gameId", "seat"],
    ),
    createTool(
      "listLegalActions",
      "List action ids currently legal for the active seat.",
      "read",
      ["gameId", "seat"],
    ),
    createTool(
      "submitAction",
      "Submit one legal action id through the authoritative intent path.",
      "intent-submit",
      ["gameId", "seat", "actionId", "stateVersion"],
    ),
    createTool(
      "passPriority",
      "Pass priority when pass is legal for the active seat.",
      "intent-submit",
      ["gameId", "seat", "stateVersion"],
    ),
    createTool("getRules", "Read the public rules summary.", "read", [
      "rulesetId",
    ]),
    createTool(
      "getObjective",
      "Read public objective and victory guidance.",
      "read",
      ["gameId", "seat"],
    ),
    createTool("getReplay", "Read replay metadata and public events.", "read", [
      "gameId",
    ]),
    createTool(
      "subscribeEvents",
      "Subscribe to scoped game events for one seat.",
      "read",
      ["gameId", "seat"],
    ),
    createTool(
      "runSelfPlay",
      "Run deterministic self-play using the same legal action contract.",
      "simulation",
      ["scenarioId"],
    ),
    createTool(
      "evaluateAgent",
      "Score agent behavior against deterministic replay and legality checks.",
      "simulation",
      ["replayId"],
    ),
  ];
}

export function createAgentCapabilityManifest(
  input: CreateAgentCapabilityManifestInput,
): AgentCapabilityManifest {
  const description =
    input.description === undefined
      ? "Lunch Table Games gameplay agent"
      : input.description;
  const tools =
    input.tools === undefined ? createAgentToolManifest() : input.tools;

  return {
    agentId: input.agentId,
    description,
    displayName: input.displayName,
    supportedTransports: [...input.supportedTransports],
    tools: [...tools],
  };
}

export function createAgentObservationFrame<
  TView,
  TAction extends LegalActionDescriptor,
>(
  input: CreateAgentObservationFrameInput<TView, TAction>,
): AgentObservationFrame<TView, TAction> {
  return {
    deadlineAt: input.deadlineAt,
    gameId: input.gameId,
    legalActions: [...input.legalActions],
    receivedAt: input.receivedAt,
    rulesetId: input.rulesetId,
    seat: input.seat,
    stateVersion: input.stateVersion,
    transport: input.transport,
    view: input.view,
  };
}

export function createLegalActionDescriptors<TIntent extends { kind: string }>(
  intents: TIntent[],
  options: CreateLegalActionDescriptorOptions,
): Array<LegalActionDescriptor<TIntent>> {
  return intents.map((intent, index) =>
    createLegalActionDescriptor(intent, index, options),
  );
}

export function createFirstLegalActionPolicy<
  TView,
  TAction extends LegalActionDescriptor,
>(): AgentPolicy<TView, TAction> {
  return {
    decide(frame) {
      const [firstAction] = frame.legalActions;
      if (firstAction === undefined) {
        return {
          actionId: null,
          reason: "No legal actions are available.",
        };
      }

      return {
        actionId: firstAction.actionId,
        reason: "Selected the highest priority legal action.",
      };
    },
    policyId: "first-legal-action",
  };
}

export function createActionIdPolicy<
  TView,
  TAction extends LegalActionDescriptor,
>(actionId: string): AgentPolicy<TView, TAction> {
  return {
    decide() {
      return {
        actionId,
        reason: "Selected a fixed action id.",
      };
    },
    policyId: "fixed-action-id",
  };
}

export async function runAgentTurn<
  TState,
  TIntent extends { kind: string },
  TEvent,
  TSeatView,
  TAction extends LegalActionDescriptor<TIntent>,
>(
  input: RunAgentTurnInput<TState, TIntent, TEvent, TSeatView, TAction>,
): Promise<AgentTurnResult<TState, TIntent, TEvent, TSeatView, TAction>> {
  const view = input.ruleset.deriveSeatView(input.state, input.seat);
  const legalIntents = input.ruleset.listLegalIntents(input.state, input.seat);
  const legalActions = input.createLegalActions(legalIntents);
  const frame = createAgentObservationFrame({
    deadlineAt: input.deadlineAt,
    gameId: input.gameId,
    legalActions,
    receivedAt: input.receivedAt,
    rulesetId: input.rulesetId,
    seat: input.seat,
    stateVersion: input.stateVersion,
    transport: input.transport,
    view,
  });
  const decision = await input.policy.decide(frame);
  const action =
    decision.actionId === null
      ? null
      : resolveExternalActionId(legalActions, decision.actionId);

  if (action === null) {
    return {
      action,
      decision,
      frame,
      outcome: "no-action",
      transition: null,
    };
  }

  return {
    action,
    decision,
    frame,
    outcome: "submitted",
    transition: input.ruleset.applyIntent(input.state, action.intent),
  };
}

function createLegalActionDescriptor<TIntent extends { kind: string }>(
  intent: TIntent,
  index: number,
  options: CreateLegalActionDescriptorOptions,
): LegalActionDescriptor<TIntent> {
  const actionId = `${options.actionIdPrefix}:${intent.kind}:${index}`;
  const kind: TIntent["kind"] = intent.kind;

  return {
    actionId,
    humanLabel: createHumanLabel(kind),
    intent,
    kind,
    machineLabel: createMachineLabel(kind),
    priority: 100 - index,
  } as LegalActionDescriptor<TIntent>;
}

export function createMcpToolManifest(
  manifest: AgentCapabilityManifest,
): McpToolManifest {
  return {
    tools: manifest.tools.map((tool) => ({
      description: tool.description,
      inputSchema: tool.inputSchema,
      name: tool.name,
    })),
  };
}

export function createLunchTableA2aAgentCard(
  manifest: AgentCapabilityManifest,
  input: CreateLunchTableA2aAgentCardInput,
): LunchTableA2aAgentCard {
  return {
    capabilities: {
      pushNotifications: false,
      stateTransitionHistory: true,
      streaming: true,
    },
    description: manifest.description,
    name: manifest.displayName,
    protocol: "a2a",
    protocolVersion: "0.3.0",
    provider: {
      organization: input.providerName,
    },
    skills: [
      {
        description: "Join a Lunch Table Games match as an AI-controlled seat.",
        id: "join-game-seat",
        name: "Join Game Seat",
        tags: ["lunchtable", "gameplay", "seat"],
      },
      {
        description:
          "Choose and submit legal actions through the game authority.",
        id: "play-legal-action",
        name: "Play Legal Action",
        tags: ["lunchtable", "gameplay", "actions"],
      },
      {
        description:
          "Run deterministic self-play for evaluation and smoke tests.",
        id: "run-self-play",
        name: "Run Self-Play",
        tags: ["lunchtable", "evaluation", "self-play"],
      },
    ],
    url: input.endpointUrl,
  };
}

function createTool(
  name: AgentToolName,
  description: string,
  authority: AgentToolAuthority,
  required: string[],
): AgentToolDescriptor {
  return {
    authority,
    description,
    inputSchema: createObjectSchema(required),
    name,
    outputSchema: createObjectSchema([]),
  };
}

function createObjectSchema(required: string[]): AgentToolSchema {
  return {
    properties: Object.fromEntries(
      required.map((property) => [
        property,
        {
          description: `${property} value`,
          type: property === "stateVersion" ? "integer" : "string",
        } satisfies AgentToolSchemaProperty,
      ]),
    ),
    required: [...required],
    type: "object",
  };
}

function createHumanLabel(kind: string): string {
  const spaced = kind.replace(/([a-z])([A-Z])/g, "$1 $2");
  return `${spaced.slice(0, 1).toUpperCase()}${spaced.slice(1)}`;
}

function createMachineLabel(kind: string): string {
  return kind.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}
