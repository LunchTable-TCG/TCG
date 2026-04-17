import {
  baselineBotPolicy,
  createExternalDecisionEnvelope,
  resolveExternalDecisionResponse,
} from "@lunchtable/bot-sdk";
import type { BotDecisionFrame, BotPlannedIntent } from "@lunchtable/bot-sdk";

export type DecisionPolicyMode = "baseline" | "external-http";

export interface DecisionPlanner {
  decide(frame: BotDecisionFrame): Promise<BotPlannedIntent | null>;
  key: string;
}

export interface DecisionPolicyConfig {
  authToken: string | null;
  decisionUrl: string | null;
  key: string;
  mode: DecisionPolicyMode;
  timeoutMs: number;
}

export function loadDecisionPolicyConfig(
  env: NodeJS.ProcessEnv,
): DecisionPolicyConfig {
  const mode = (env.BOT_POLICY_MODE?.trim() ??
    "baseline") as DecisionPolicyMode;
  if (mode !== "baseline" && mode !== "external-http") {
    throw new Error(`Unsupported BOT_POLICY_MODE: ${mode}`);
  }

  const timeoutMsRaw = env.BOT_EXTERNAL_DECISION_TIMEOUT_MS?.trim() ?? "6000";
  const timeoutMs = Number(timeoutMsRaw);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      "BOT_EXTERNAL_DECISION_TIMEOUT_MS must be a positive number",
    );
  }

  const decisionUrl = env.BOT_EXTERNAL_DECISION_URL?.trim() || null;
  if (mode === "external-http" && !decisionUrl) {
    throw new Error(
      "BOT_EXTERNAL_DECISION_URL is required when BOT_POLICY_MODE=external-http",
    );
  }

  const authToken = env.BOT_EXTERNAL_DECISION_AUTH_TOKEN?.trim() || null;
  return {
    authToken,
    decisionUrl,
    key:
      env.BOT_POLICY_KEY?.trim() ||
      (mode === "external-http" ? "external-http" : baselineBotPolicy.key),
    mode,
    timeoutMs,
  };
}

function parseExternalDecisionBody(body: string) {
  const trimmed = body.trim();
  if (!trimmed) {
    return { actionId: null };
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

async function decideWithExternalHttp(input: {
  config: DecisionPolicyConfig;
  fetchImpl: typeof fetch;
  frame: BotDecisionFrame;
}) {
  if (!input.config.decisionUrl) {
    throw new Error("External decision URL is unavailable");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);

  try {
    const response = await input.fetchImpl(input.config.decisionUrl, {
      body: JSON.stringify(createExternalDecisionEnvelope(input.frame)),
      headers: {
        ...(input.config.authToken
          ? {
              Authorization: `Bearer ${input.config.authToken}`,
            }
          : {}),
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `External decision endpoint returned ${response.status} ${response.statusText}`,
      );
    }

    return resolveExternalDecisionResponse({
      frame: input.frame,
      response: parseExternalDecisionBody(await response.text()),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createDecisionPlanner(
  config: DecisionPolicyConfig,
  fetchImpl: typeof fetch = fetch,
): DecisionPlanner {
  if (config.mode === "baseline") {
    return {
      async decide(frame) {
        return baselineBotPolicy.decide(frame);
      },
      key: config.key,
    };
  }

  return {
    async decide(frame) {
      return decideWithExternalHttp({
        config,
        fetchImpl,
        frame,
      });
    },
    key: config.key,
  };
}
