import { describe, expect, it } from "vitest";

import type { LegalActionDescriptor } from "@lunchtable/games-ai";

import {
  createAgentApiClient,
  createAgentApiManifest,
  createAgentApiResponse,
  createDefaultAgentApiRoutes,
  createSubmitActionResult,
  parseAgentApiJsonObject,
} from "./http";

interface TestState {
  version: number;
}

interface TestIntent {
  kind: "wait";
}

interface TestEvent {
  kind: "waited";
}

type TestAction = LegalActionDescriptor<TestIntent>;

describe("agent HTTP API primitives", () => {
  it("creates a stable route manifest for agent transports", () => {
    const manifest = createAgentApiManifest({
      displayName: "Side Runner",
      gameId: "game-1",
      routes: createDefaultAgentApiRoutes(),
      rulesetId: "side-scroller",
      tools: [
        {
          authority: "intent-submit",
          description: "Submit one legal action.",
          inputSchema: {
            properties: {},
            required: [],
            type: "object",
          },
          name: "submitAction",
          outputSchema: {
            properties: {},
            required: [],
            type: "object",
          },
        },
      ],
    });

    expect(manifest).toMatchObject({
      displayName: "Side Runner",
      gameId: "game-1",
      protocol: "lunchtable-agent-http",
      protocolVersion: "0.1.0",
      rulesetId: "side-scroller",
    });
    expect(manifest.routes.map((route) => route.path)).toContain(
      "/api/actions/submit",
    );
    expect(manifest.routes.map((route) => route.toolName)).toContain(
      "submitAction",
    );
  });

  it("parses JSON object request bodies without accepting arrays or scalars", async () => {
    await expect(
      parseAgentApiJsonObject(
        new Request("https://agents.example.test/api/legal-actions", {
          body: JSON.stringify({ seat: "seat-0" }),
          method: "POST",
        }),
      ),
    ).resolves.toEqual({ seat: "seat-0" });

    await expect(
      parseAgentApiJsonObject(
        new Request("https://agents.example.test/api/legal-actions", {
          body: JSON.stringify(["seat-0"]),
          method: "POST",
        }),
      ),
    ).rejects.toThrow("API request body must be a JSON object");
  });

  it("submits only known legal actions at the current state version", () => {
    const action: TestAction = {
      actionId: "seat-0:wait",
      humanLabel: "Wait",
      intent: { kind: "wait" },
      kind: "wait",
      machineLabel: "wait",
      priority: 0,
    };

    const applied = createSubmitActionResult<
      TestState,
      TestIntent,
      TestEvent,
      TestAction
    >({
      actionId: action.actionId,
      applyIntent: (state, intent) => ({
        events: [{ kind: `${intent.kind}ed` as "waited" }],
        nextState: { version: state.version + 1 },
        outcome: "applied",
      }),
      legalActions: [action],
      seat: "seat-0",
      state: { version: 0 },
      stateVersion: 0,
      version: 0,
    });

    const rejected = createSubmitActionResult<
      TestState,
      TestIntent,
      TestEvent,
      TestAction
    >({
      actionId: "seat-0:wait",
      applyIntent: (state) => ({
        events: [],
        nextState: state,
        outcome: "noop",
      }),
      legalActions: [action],
      seat: "seat-0",
      state: { version: 0 },
      stateVersion: 3,
      version: 0,
    });

    expect(applied).toMatchObject({
      action,
      nextState: { version: 1 },
      ok: true,
      stateVersion: 1,
    });
    expect(rejected).toMatchObject({
      error: "State version mismatch. Expected 0 but received 3",
      ok: false,
    });
  });

  it("wraps response payloads with consistent JSON headers", async () => {
    const response = createAgentApiResponse({ ok: true });

    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("creates a fetch client for hosted agent APIs", async () => {
    const requests: Array<{ body: string; method: string; path: string }> = [];
    const client = createAgentApiClient({
      baseUrl: "https://agents.example.test/game-1/",
      fetch: async (request) => {
        const url = new URL(request.url);
        requests.push({
          body: await request.text(),
          method: request.method,
          path: url.pathname,
        });
        return createAgentApiResponse({
          legalActions: [],
          seat: "seat-0",
          stateVersion: 7,
        });
      },
    });

    await expect(client.listLegalActions("seat-0")).resolves.toEqual({
      legalActions: [],
      seat: "seat-0",
      stateVersion: 7,
    });

    expect(requests).toEqual([
      {
        body: '{"seat":"seat-0"}',
        method: "POST",
        path: "/game-1/api/legal-actions",
      },
    ]);
  });
});
