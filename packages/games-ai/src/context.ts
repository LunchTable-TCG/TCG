import type { LegalActionDescriptor } from "./actions";
import type { AgentObservationFrame } from "./agent";

export type AgentContextRulesSummary = {
  legalActionKinds: string[];
  objective: string | null;
  phase: string;
};

export interface AgentContextEventCursor {
  eventSequence: number;
  stateVersion: number;
}

export interface AgentContextEnvelope<
  TView,
  TAction extends LegalActionDescriptor,
> {
  contextId: string;
  createdAt: number;
  deadlineAt: number | null;
  eventCursor: AgentContextEventCursor;
  gameId: string;
  legalActions: TAction[];
  receivedAt: number;
  rulesetId: string;
  rulesSummary: AgentContextRulesSummary;
  seat: string;
  stateVersion: number;
  transport: AgentObservationFrame<TView, TAction>["transport"];
  view: TView;
}

export interface CreateAgentContextEnvelopeInput<
  TView,
  TAction extends LegalActionDescriptor,
> {
  createdAt: number;
  eventCursor: AgentContextEventCursor;
  frame: AgentObservationFrame<TView, TAction>;
  rulesSummary: AgentContextRulesSummary;
}

export type AgentSseEventName =
  | "context"
  | "error"
  | "events"
  | "heartbeat"
  | "legalActions"
  | "stateChanged";

export type AgentSseJsonPrimitive = boolean | null | number | string;
export type AgentSseJsonArray = AgentSseJsonValue[];
export type AgentSseJsonObject = { [key: string]: AgentSseJsonValue };
export type AgentSseJsonValue =
  | AgentSseJsonArray
  | AgentSseJsonObject
  | AgentSseJsonPrimitive;

export type AgentSseEventData = AgentSseJsonValue;

export interface AgentSseEvent<
  TName extends AgentSseEventName = AgentSseEventName,
  TData = AgentSseEventData,
> {
  data: TData;
  event: TName;
  id: string;
  retryMs?: number;
}

export function createAgentContextEnvelope<
  TView,
  TAction extends LegalActionDescriptor,
>(
  input: CreateAgentContextEnvelopeInput<TView, TAction>,
): AgentContextEnvelope<TView, TAction> {
  return {
    contextId: createContextId(input.frame, input.eventCursor),
    createdAt: input.createdAt,
    deadlineAt: input.frame.deadlineAt,
    eventCursor: { ...input.eventCursor },
    gameId: input.frame.gameId,
    legalActions: [...input.frame.legalActions],
    receivedAt: input.frame.receivedAt,
    rulesetId: input.frame.rulesetId,
    rulesSummary: {
      legalActionKinds: [...input.rulesSummary.legalActionKinds],
      objective: input.rulesSummary.objective,
      phase: input.rulesSummary.phase,
    },
    seat: input.frame.seat,
    stateVersion: input.frame.stateVersion,
    transport: input.frame.transport,
    view: input.frame.view,
  };
}

export function createAgentSseEvent<TName extends AgentSseEventName, TData>(
  event: AgentSseEvent<TName, TData>,
): AgentSseEvent<TName, TData> {
  return {
    ...event,
  };
}

export function createAgentSseHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  };
}

export function encodeAgentSseEvent<TName extends AgentSseEventName, TData>(
  event: AgentSseEvent<TName, TData>,
): string {
  const lines = [`id: ${event.id}`, `event: ${event.event}`];
  if (event.retryMs !== undefined) {
    lines.push(`retry: ${event.retryMs}`);
  }
  lines.push(`data: ${JSON.stringify(event.data)}`);
  return `${lines.join("\n")}\n\n`;
}

export function decodeAgentSseStream(
  stream: string,
): Array<AgentSseEvent<AgentSseEventName, AgentSseJsonValue>> {
  const chunks = stream
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  return chunks.map(decodeAgentSseEvent);
}

function decodeAgentSseEvent(
  chunk: string,
): AgentSseEvent<AgentSseEventName, AgentSseJsonValue> {
  let data: string | null = null;
  let event: AgentSseEventName | null = null;
  let id: string | null = null;
  let retryMs: number | undefined;

  for (const line of chunk.split("\n")) {
    if (line.startsWith("id: ")) {
      id = line.slice("id: ".length);
      continue;
    }

    if (line.startsWith("event: ")) {
      event = parseAgentSseEventName(line.slice("event: ".length));
      continue;
    }

    if (line.startsWith("retry: ")) {
      retryMs = parseRetryMs(line.slice("retry: ".length));
      continue;
    }

    if (line.startsWith("data: ")) {
      data = line.slice("data: ".length);
    }
  }

  if (id === null || event === null || data === null) {
    throw new Error("SSE event requires id, event, and data fields");
  }

  return {
    data: JSON.parse(data),
    event,
    id,
    ...(retryMs === undefined ? {} : { retryMs }),
  };
}

function createContextId<TView, TAction extends LegalActionDescriptor>(
  frame: AgentObservationFrame<TView, TAction>,
  cursor: AgentContextEventCursor,
): string {
  return `${frame.gameId}:${frame.seat}:${frame.stateVersion}:${cursor.eventSequence}`;
}

function parseAgentSseEventName(value: string): AgentSseEventName {
  if (
    value === "context" ||
    value === "error" ||
    value === "events" ||
    value === "heartbeat" ||
    value === "legalActions" ||
    value === "stateChanged"
  ) {
    return value;
  }

  throw new Error(`Unsupported agent SSE event: ${value}`);
}

function parseRetryMs(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid SSE retry value: ${value}`);
  }
  return parsed;
}
