import type {
  AgentToolDescriptor,
  AgentToolName,
  LegalActionDescriptor,
} from "@lunchtable/games-ai";
import type {
  GameTransition,
  GameTransitionOutcome,
} from "@lunchtable/games-core";

export type AgentApiHttpMethod = "GET" | "POST";
export type AgentApiProtocol = "lunchtable-agent-http";
export type AgentApiProtocolVersion = "0.1.0";
export type AgentApiRouteToolName = AgentToolName | "agentManifest" | string;

export type AgentApiJsonPrimitive = boolean | null | number | string;
export type AgentApiJsonArray = AgentApiJsonValue[];
export type AgentApiJsonObject = { [key: string]: AgentApiJsonValue };
export type AgentApiJsonValue =
  | AgentApiJsonArray
  | AgentApiJsonObject
  | AgentApiJsonPrimitive;

export interface AgentApiRoute {
  method: AgentApiHttpMethod;
  path: string;
  toolName: AgentApiRouteToolName;
}

export interface AgentApiManifest {
  displayName: string;
  gameId: string;
  protocol: AgentApiProtocol;
  protocolVersion: AgentApiProtocolVersion;
  routes: AgentApiRoute[];
  rulesetId: string;
  tools: AgentToolDescriptor[];
}

export interface CreateAgentApiManifestInput {
  displayName: string;
  gameId: string;
  routes: readonly AgentApiRoute[];
  rulesetId: string;
  tools: readonly AgentToolDescriptor[];
}

export type AgentApiFetch = (request: Request) => Promise<Response>;

export interface CreateAgentApiClientInput {
  baseUrl: string;
  fetch?: AgentApiFetch;
}

export interface SubmitActionApiRequest {
  actionId: string;
  seat: string;
  stateVersion: number;
}

export interface AgentApiClient {
  getManifest: () => Promise<AgentApiJsonValue>;
  getObjective: (seat: string | null) => Promise<AgentApiJsonValue>;
  getReplay: () => Promise<AgentApiJsonValue>;
  getRules: () => Promise<AgentApiJsonValue>;
  joinSeat: (requestedSeat: string | null) => Promise<AgentApiJsonValue>;
  listLegalActions: (seat: string) => Promise<AgentApiJsonValue>;
  observe: (seat: string) => Promise<AgentApiJsonValue>;
  passPriority: (
    seat: string,
    stateVersion: number,
  ) => Promise<AgentApiJsonValue>;
  request: (
    method: AgentApiHttpMethod,
    path: string,
    body?: AgentApiJsonObject,
  ) => Promise<AgentApiJsonValue>;
  runSelfPlay: (turns: number | null) => Promise<AgentApiJsonValue>;
  submitAction: (input: SubmitActionApiRequest) => Promise<AgentApiJsonValue>;
}

export interface CreateSubmitActionResultInput<
  TState,
  TIntent extends { kind: string },
  TEvent,
  TAction extends LegalActionDescriptor<TIntent>,
> {
  actionId: string;
  applyIntent: (
    state: TState,
    intent: TIntent,
  ) => GameTransition<TState, TEvent>;
  legalActions: readonly TAction[];
  readStateVersion?: (state: TState) => number;
  seat: string;
  state: TState;
  stateVersion: number;
  version: number;
}

export interface SubmitActionAccepted<
  TState,
  TIntent extends { kind: string },
  TEvent,
  TAction extends LegalActionDescriptor<TIntent>,
> {
  action: TAction;
  actionId: string;
  events: TEvent[];
  nextState: TState;
  ok: true;
  outcome: GameTransitionOutcome;
  seat: string;
  stateVersion: number;
}

export interface SubmitActionRejected {
  actionId: string;
  error: string;
  ok: false;
  seat: string;
  stateVersion: number;
}

export type SubmitActionResult<
  TState,
  TIntent extends { kind: string },
  TEvent,
  TAction extends LegalActionDescriptor<TIntent>,
> =
  | SubmitActionAccepted<TState, TIntent, TEvent, TAction>
  | SubmitActionRejected;

export function createDefaultAgentApiRoutes(): AgentApiRoute[] {
  return [
    { method: "GET", path: "/api/agent/manifest", toolName: "agentManifest" },
    { method: "POST", path: "/api/seats/join", toolName: "joinGameSeat" },
    { method: "POST", path: "/api/observe", toolName: "observeGame" },
    {
      method: "POST",
      path: "/api/legal-actions",
      toolName: "listLegalActions",
    },
    {
      method: "POST",
      path: "/api/actions/submit",
      toolName: "submitAction",
    },
    { method: "POST", path: "/api/priority/pass", toolName: "passPriority" },
    { method: "GET", path: "/api/rules", toolName: "getRules" },
    { method: "POST", path: "/api/objective", toolName: "getObjective" },
    { method: "GET", path: "/api/replay", toolName: "getReplay" },
    { method: "POST", path: "/api/self-play", toolName: "runSelfPlay" },
  ];
}

export function createAgentApiManifest(
  input: CreateAgentApiManifestInput,
): AgentApiManifest {
  return {
    displayName: input.displayName,
    gameId: input.gameId,
    protocol: "lunchtable-agent-http",
    protocolVersion: "0.1.0",
    routes: input.routes.map((route) => ({ ...route })),
    rulesetId: input.rulesetId,
    tools: input.tools.map((tool) => ({ ...tool })),
  };
}

export function createAgentApiClient(
  input: CreateAgentApiClientInput,
): AgentApiClient {
  const baseUrl = input.baseUrl.endsWith("/")
    ? input.baseUrl
    : `${input.baseUrl}/`;
  const fetcher = input.fetch ?? globalThis.fetch;
  if (typeof fetcher !== "function") {
    throw new Error("Agent API client requires a fetch implementation");
  }

  async function request(
    method: AgentApiHttpMethod,
    path: string,
    body?: AgentApiJsonObject,
  ): Promise<AgentApiJsonValue> {
    const requestUrl = new URL(path.replace(/^\//, ""), baseUrl);
    const response = await fetcher(
      new Request(requestUrl, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers:
          body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        method,
      }),
    );
    if (!response.ok) {
      throw new Error(
        `Agent API request failed with status ${response.status}`,
      );
    }

    const parsed: AgentApiJsonValue = await response.json();
    return parsed;
  }

  return {
    getManifest: () => request("GET", "/api/agent/manifest"),
    getObjective: (seat) =>
      request("POST", "/api/objective", seat === null ? {} : { seat }),
    getReplay: () => request("GET", "/api/replay"),
    getRules: () => request("GET", "/api/rules"),
    joinSeat: (requestedSeat) =>
      request(
        "POST",
        "/api/seats/join",
        requestedSeat === null ? {} : { requestedSeat },
      ),
    listLegalActions: (seat) => request("POST", "/api/legal-actions", { seat }),
    observe: (seat) => request("POST", "/api/observe", { seat }),
    passPriority: (seat, stateVersion) =>
      request("POST", "/api/priority/pass", { seat, stateVersion }),
    request,
    runSelfPlay: (turns) =>
      request("POST", "/api/self-play", turns === null ? {} : { turns }),
    submitAction: (submitRequest) =>
      request("POST", "/api/actions/submit", {
        actionId: submitRequest.actionId,
        seat: submitRequest.seat,
        stateVersion: submitRequest.stateVersion,
      }),
  };
}

export async function parseAgentApiJsonObject(
  request: Request,
): Promise<AgentApiJsonObject> {
  const body = await request.text();
  if (body.trim().length === 0) {
    return {};
  }

  const parsed: AgentApiJsonValue = JSON.parse(body);
  if (!isAgentApiJsonObject(parsed)) {
    throw new Error("API request body must be a JSON object");
  }
  return parsed;
}

export function createAgentApiResponse(
  value: AgentApiJsonValue,
  status = 200,
): Response {
  return new Response(JSON.stringify(value, null, 2), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

export function createSubmitActionResult<
  TState,
  TIntent extends { kind: string },
  TEvent,
  TAction extends LegalActionDescriptor<TIntent>,
>(
  input: CreateSubmitActionResultInput<TState, TIntent, TEvent, TAction>,
): SubmitActionResult<TState, TIntent, TEvent, TAction> {
  if (input.stateVersion !== input.version) {
    return {
      actionId: input.actionId,
      error: `State version mismatch. Expected ${input.version} but received ${input.stateVersion}`,
      ok: false,
      seat: input.seat,
      stateVersion: input.version,
    };
  }

  const action = input.legalActions.find(
    (candidate) => candidate.actionId === input.actionId,
  );
  if (action === undefined) {
    return {
      actionId: input.actionId,
      error: `Unknown or illegal actionId: ${input.actionId}`,
      ok: false,
      seat: input.seat,
      stateVersion: input.version,
    };
  }

  const transition = input.applyIntent(input.state, action.intent);
  const nextStateVersion =
    input.readStateVersion?.(transition.nextState) ?? input.version + 1;

  return {
    action,
    actionId: input.actionId,
    events: [...transition.events],
    nextState: transition.nextState,
    ok: true,
    outcome: transition.outcome,
    seat: input.seat,
    stateVersion: nextStateVersion,
  };
}

export function requireAgentApiString(
  args: AgentApiJsonObject,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

export function optionalAgentApiString(
  args: AgentApiJsonObject,
  key: string,
): string | null {
  const value = args[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }
  return value;
}

export function requireAgentApiInteger(
  args: AgentApiJsonObject,
  key: string,
): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }
  return value;
}

export function optionalAgentApiInteger(
  args: AgentApiJsonObject,
  key: string,
): number | null {
  const value = args[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }
  return value;
}

export function isAgentApiJsonObject(
  value: AgentApiJsonValue | undefined,
): value is AgentApiJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toAgentApiJsonValue(value: object): AgentApiJsonValue {
  return JSON.parse(JSON.stringify(value));
}
