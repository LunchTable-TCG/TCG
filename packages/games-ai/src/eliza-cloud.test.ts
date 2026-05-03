import { describe, expect, it } from "vitest";

import type { LegalActionDescriptor } from "./actions";
import {
  createElizaCloudAgentProfile,
  createElizaCloudDecisionRequest,
  createElizaCloudHostedAgentClient,
  createElizaCloudHostedGameplayOrchestration,
  resolveElizaCloudDecisionResponse,
} from "./eliza-cloud";

const legalActions: LegalActionDescriptor[] = [
  {
    actionId: "seat-1:pass:0",
    humanLabel: "Pass",
    intent: { kind: "pass" },
    kind: "pass",
    machineLabel: "pass",
    priority: 100,
  },
];

describe("elizaOS Cloud hosted gameplay agents", () => {
  it("creates an agent profile for elizaOS Cloud provisioning", () => {
    expect(
      createElizaCloudAgentProfile({
        bio: "Plays Lunch Table Games through legal actions only.",
        displayName: "Table Bot",
        gameId: "game-1",
        seat: "seat-1",
      }),
    ).toEqual({
      bio: "Plays Lunch Table Games through legal actions only.",
      category: "gameplay",
      name: "Table Bot",
      tags: ["lunchtable", "gameplay", "legal-actions", "seat-1"],
    });
  });

  it("frames decisions as legal-action-only chat requests", () => {
    const request = createElizaCloudDecisionRequest({
      agentId: "agent-1",
      endpointUrl: "https://elizacloud.ai/api/v1/chat/completions",
      frame: {
        deadlineAt: null,
        gameId: "game-1",
        legalActions,
        receivedAt: 1777746200000,
        rulesetId: "ruleset-1",
        seat: "seat-1",
        stateVersion: 4,
        transport: "external-http",
        view: { handCount: 2 },
      },
      model: "elizaos-cloud-agent",
      requestId: "request-1",
    });

    expect(request).toMatchObject({
      body: {
        model: "elizaos-cloud-agent",
        metadata: {
          agentId: "agent-1",
          gameId: "game-1",
          requestId: "request-1",
          seat: "seat-1",
          stateVersion: 4,
        },
        response_format: { type: "json_object" },
      },
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      url: "https://elizacloud.ai/api/v1/chat/completions",
    });
    expect(request.body.messages.at(-1)?.content).toContain("seat-1:pass:0");
  });

  it("resolves hosted responses through the known action catalog", () => {
    expect(
      resolveElizaCloudDecisionResponse(legalActions, {
        choices: [
          {
            message: {
              content: '{"actionId":"seat-1:pass:0"}',
            },
          },
        ],
      }),
    ).toEqual(legalActions[0]);
    expect(() =>
      resolveElizaCloudDecisionResponse(legalActions, {
        choices: [{ message: { content: '{"actionId":"invented"}' } }],
      }),
    ).toThrow("External agent returned an unrecognized actionId");
  });

  it("uses bearer auth for elizaOS Cloud server-side requests", async () => {
    const calls: Array<{ headers: Record<string, string>; url: string }> = [];
    const client = createElizaCloudHostedAgentClient({
      apiKey: "cloud-key",
      fetch: async (url, init) => {
        calls.push({
          headers: init.headers,
          url,
        });
        return {
          json: async () => ({ agent: { id: "agent-1" }, success: true }),
          ok: true,
          status: 200,
        };
      },
    });

    await client.createAgent(
      createElizaCloudAgentProfile({
        bio: "Legal action agent.",
        displayName: "Table Bot",
        gameId: "game-1",
        seat: "seat-1",
      }),
    );

    expect(calls).toEqual([
      {
        headers: {
          Authorization: "Bearer cloud-key",
          "Content-Type": "application/json",
        },
        url: "https://elizacloud.ai/api/v1/app/agents",
      },
    ]);
  });

  it("builds a hosted gameplay orchestration plan around OpenAI-compatible chat", () => {
    const orchestration = createElizaCloudHostedGameplayOrchestration({
      apiBaseUrl: "https://elizacloud.ai",
      agentId: "agent-1",
      gameId: "game-1",
      mcpServerCommand: "bun run --silent mcp:stdio",
      seat: "seat-1",
    });

    expect(orchestration).toEqual({
      agentId: "agent-1",
      apiBaseUrl: "https://elizacloud.ai",
      decisionEndpoint: "https://elizacloud.ai/api/v1/chat/completions",
      gameId: "game-1",
      guardrails: [
        "only-submit-listed-legal-action-ids",
        "only-use-scoped-seat-view",
        "submit-through-authoritative-runtime",
        "return-json-object",
      ],
      mcp: {
        serverCommand: "bun run --silent mcp:stdio",
        tools: ["listLegalActions", "getSeatView", "submitAction"],
      },
      requiredEnv: ["ELIZA_CLOUD_API_KEY"],
      seat: "seat-1",
      transport: "eliza-cloud-chat-completions",
    });
  });
});
