import { describe, expect, it } from "vitest";

import type { LegalActionDescriptor } from "./actions";
import { createAgentObservationFrame } from "./agent";
import {
  createAgentContextEnvelope,
  createAgentSseEvent,
  createAgentSseHeaders,
  decodeAgentSseStream,
  encodeAgentSseEvent,
} from "./context";

type TestIntent = { kind: "wait"; seatId: string };

interface TestView {
  publicScore: number;
  seatSecret: string;
}

const legalActions: Array<LegalActionDescriptor<TestIntent>> = [
  {
    actionId: "seat-0:wait:0",
    humanLabel: "Wait",
    intent: { kind: "wait", seatId: "seat-0" },
    kind: "wait",
    machineLabel: "wait",
    priority: 100,
  },
];

describe("agent context and SSE primitives", () => {
  it("creates a first-class scoped context envelope for agents", () => {
    const frame = createAgentObservationFrame<
      TestView,
      LegalActionDescriptor<TestIntent>
    >({
      deadlineAt: null,
      gameId: "game-1",
      legalActions,
      receivedAt: 1777739000000,
      rulesetId: "test-ruleset",
      seat: "seat-0",
      stateVersion: 7,
      transport: "external-http",
      view: {
        publicScore: 3,
        seatSecret: "seat-0-only",
      },
    });

    const envelope = createAgentContextEnvelope({
      createdAt: 1777739000100,
      eventCursor: {
        eventSequence: 12,
        stateVersion: frame.stateVersion,
      },
      frame,
      rulesSummary: {
        legalActionKinds: ["wait"],
        objective: "Reach the goal.",
        phase: "run",
      },
    });

    expect(envelope).toEqual({
      contextId: "game-1:seat-0:7:12",
      createdAt: 1777739000100,
      deadlineAt: null,
      eventCursor: {
        eventSequence: 12,
        stateVersion: 7,
      },
      gameId: "game-1",
      legalActions,
      receivedAt: 1777739000000,
      rulesetId: "test-ruleset",
      rulesSummary: {
        legalActionKinds: ["wait"],
        objective: "Reach the goal.",
        phase: "run",
      },
      seat: "seat-0",
      stateVersion: 7,
      transport: "external-http",
      view: {
        publicScore: 3,
        seatSecret: "seat-0-only",
      },
    });
  });

  it("encodes and decodes typed SSE events for agent streams", () => {
    const event = createAgentSseEvent({
      data: {
        at: 1777739000200,
      },
      event: "heartbeat",
      id: "game-1:13",
    });

    expect(encodeAgentSseEvent(event)).toBe(
      'id: game-1:13\nevent: heartbeat\ndata: {"at":1777739000200}\n\n',
    );
    expect(decodeAgentSseStream(encodeAgentSseEvent(event))).toEqual([event]);
  });

  it("ships browser-ready SSE response headers", () => {
    expect(createAgentSseHeaders()).toEqual({
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    });
  });
});
