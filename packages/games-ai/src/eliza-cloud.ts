import type { LegalActionDescriptor } from "./actions";
import type { AgentObservationFrame } from "./agent";
import { resolveExternalActionId } from "./external";

export interface ElizaCloudAgentProfileInput {
  bio: string;
  displayName: string;
  gameId: string;
  seat: string;
}

export interface ElizaCloudAgentProfile {
  bio: string;
  category: "gameplay";
  name: string;
  tags: string[];
}

export interface ElizaCloudDecisionRequestInput<
  TView,
  TAction extends LegalActionDescriptor,
> {
  agentId: string;
  endpointUrl: string;
  frame: AgentObservationFrame<TView, TAction>;
  model: string;
  requestId: string;
}

export interface ElizaCloudChatMessage {
  content: string;
  role: "system" | "user";
}

export interface ElizaCloudDecisionRequestBody {
  messages: ElizaCloudChatMessage[];
  metadata: {
    agentId: string;
    gameId: string;
    requestId: string;
    seat: string;
    stateVersion: number;
  };
  model: string;
  response_format: {
    type: "json_object";
  };
}

export interface ElizaCloudDecisionRequest {
  body: ElizaCloudDecisionRequestBody;
  headers: Record<string, string>;
  method: "POST";
  url: string;
}

export interface ElizaCloudDecisionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface ElizaCloudFetchResponse {
  json: () => Promise<ElizaCloudJsonObject>;
  ok: boolean;
  status: number;
}

export interface ElizaCloudFetchInit {
  body: string;
  headers: Record<string, string>;
  method: "POST";
}

export type ElizaCloudFetch = (
  url: string,
  init: ElizaCloudFetchInit,
) => Promise<ElizaCloudFetchResponse>;

export interface CreateElizaCloudHostedAgentClientInput {
  apiKey: string;
  apiUrl?: string;
  fetch: ElizaCloudFetch;
}

export interface ElizaCloudCreateAgentResponse {
  agent: {
    id: string;
  };
  success: boolean;
}

type ElizaCloudJsonPrimitive = boolean | null | number | string;
type ElizaCloudJsonValue =
  | ElizaCloudJsonPrimitive
  | ElizaCloudJsonValue[]
  | { [key: string]: ElizaCloudJsonValue };
type ElizaCloudJsonObject = { [key: string]: ElizaCloudJsonValue };

const defaultElizaCloudApiUrl = "https://elizacloud.ai";

export function createElizaCloudAgentProfile(
  input: ElizaCloudAgentProfileInput,
): ElizaCloudAgentProfile {
  return {
    bio: input.bio,
    category: "gameplay",
    name: input.displayName,
    tags: ["lunchtable", "gameplay", "legal-actions", input.seat],
  };
}

export function createElizaCloudDecisionRequest<
  TView,
  TAction extends LegalActionDescriptor,
>(
  input: ElizaCloudDecisionRequestInput<TView, TAction>,
): ElizaCloudDecisionRequest {
  return {
    body: {
      messages: [
        {
          content:
            "You are a Lunch Table Games hosted gameplay agent. Return only JSON with actionId set to one listed legal action id or null.",
          role: "system",
        },
        {
          content: JSON.stringify({
            deadlineAt: input.frame.deadlineAt,
            legalActions: input.frame.legalActions.map((action) => ({
              actionId: action.actionId,
              kind: action.kind,
              machineLabel: action.machineLabel,
              priority: action.priority,
            })),
            receivedAt: input.frame.receivedAt,
            seat: input.frame.seat,
            stateVersion: input.frame.stateVersion,
            view: input.frame.view,
          }),
          role: "user",
        },
      ],
      metadata: {
        agentId: input.agentId,
        gameId: input.frame.gameId,
        requestId: input.requestId,
        seat: input.frame.seat,
        stateVersion: input.frame.stateVersion,
      },
      model: input.model,
      response_format: {
        type: "json_object",
      },
    },
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    url: input.endpointUrl,
  };
}

export function resolveElizaCloudDecisionResponse<
  TAction extends LegalActionDescriptor,
>(actions: TAction[], response: ElizaCloudDecisionResponse): TAction | null {
  const content = response.choices[0]?.message.content;
  if (content === undefined) {
    throw new Error("elizaOS Cloud response did not include a message");
  }

  const parsed: ElizaCloudJsonValue = JSON.parse(content);
  if (!isElizaCloudJsonObject(parsed)) {
    throw new Error("elizaOS Cloud response must be a JSON object");
  }

  const actionId = parsed.actionId;
  if (actionId !== null && typeof actionId !== "string") {
    throw new Error("elizaOS Cloud actionId must be a string or null");
  }

  return resolveExternalActionId(actions, actionId);
}

export function createElizaCloudHostedAgentClient(
  input: CreateElizaCloudHostedAgentClientInput,
) {
  const apiUrl = input.apiUrl ?? defaultElizaCloudApiUrl;

  return {
    async createAgent(
      profile: ElizaCloudAgentProfile,
    ): Promise<ElizaCloudCreateAgentResponse> {
      const response = await input.fetch(`${apiUrl}/api/v1/app/agents`, {
        body: JSON.stringify({
          bio: profile.bio,
          name: profile.name,
        }),
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          `elizaOS Cloud agent create failed: ${response.status}`,
        );
      }

      return parseCreateAgentResponse(await response.json());
    },
  };
}

function parseCreateAgentResponse(
  value: ElizaCloudJsonObject,
): ElizaCloudCreateAgentResponse {
  const agent = value.agent;

  if (
    value.success !== true ||
    !isElizaCloudJsonObject(agent) ||
    typeof agent.id !== "string"
  ) {
    throw new Error("elizaOS Cloud create agent response was invalid");
  }

  return {
    agent: {
      id: agent.id,
    },
    success: true,
  };
}

function isElizaCloudJsonObject(
  value: ElizaCloudJsonValue,
): value is ElizaCloudJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
