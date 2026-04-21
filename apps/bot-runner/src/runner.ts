import { createHash } from "node:crypto";

import {
  createDecisionFrame,
  createDecisionKey,
  getCatalogForFormat,
  listLegalBotActions,
} from "@lunchtable/bot-sdk";
import { APP_NAME } from "@lunchtable/shared-types";
import type {
  BotAssignmentId,
  BotAssignmentSnapshot,
  BotDecisionTraceV1,
  BotRunnerSession,
  MatchSeatView,
  MatchTelemetryEvent,
} from "@lunchtable/shared-types";
import { ConvexClient, ConvexHttpClient } from "convex/browser";

import { api } from "../../../convex/_generated/api";
import {
  type DecisionPolicyConfig,
  type DecisionPlanner,
  createDecisionPlanner,
  loadDecisionPolicyConfig,
} from "./policy";
import { shouldRefreshSeatViewAfterSubmit } from "./refresh";

export interface RunnerConfig {
  botSlug: string;
  convexUrl: string;
  policyConfig: DecisionPolicyConfig;
  runnerSecret: string;
}

export interface RunnerConnectionState {
  connectionCount: number;
  isWebSocketConnected: boolean;
}

export type RunnerSubscription =
  | {
      unsubscribe(): void;
    }
  | (() => void);

export interface RunnerRealtimeClient {
  close(): Promise<void>;
  mutation(functionRef: unknown, args: unknown): Promise<unknown>;
  onUpdate(
    functionRef: unknown,
    args: unknown,
    onValue: (value: unknown) => void,
    onError: (error: Error) => void,
  ): RunnerSubscription;
  query(functionRef: unknown, args: unknown): Promise<unknown>;
  setAuth(fetchToken: () => Promise<string>): void;
  subscribeToConnectionState(
    onStateChange: (state: RunnerConnectionState) => void,
  ): void;
}

export interface RunnerHttpClient {
  action(functionRef: unknown, args: unknown): Promise<unknown>;
}

interface RunnerDeps {
  client?: RunnerRealtimeClient;
  httpClient?: RunnerHttpClient;
  planner?: DecisionPlanner;
}

interface AssignmentWatcher {
  inFlight: boolean;
  lastDecisionKey: string | null;
  unsubscribe: RunnerSubscription;
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptionalEnv(name: string) {
  return process.env[name]?.trim() || null;
}

function createRealtimeClient(convexUrl: string): RunnerRealtimeClient {
  return new ConvexClient(convexUrl, {
    logger: false,
    verbose: false,
  }) as unknown as RunnerRealtimeClient;
}

function createHttpClient(convexUrl: string): RunnerHttpClient {
  return new ConvexHttpClient(convexUrl, {
    logger: false,
  }) as unknown as RunnerHttpClient;
}

function cancelSubscription(subscription: RunnerSubscription | null) {
  if (!subscription) {
    return;
  }

  if (typeof subscription === "function") {
    subscription();
    return;
  }

  subscription.unsubscribe();
}

export function loadConfig(): RunnerConfig {
  const policyConfig = loadDecisionPolicyConfig(process.env);
  const botSlug = readOptionalEnv("BOT_SLUG") || "table-bot";
  const convexUrl =
    readOptionalEnv("CONVEX_URL") || readOptionalEnv("VITE_CONVEX_URL");

  if (!convexUrl) {
    throw new Error(
      "Missing required environment variable: CONVEX_URL or VITE_CONVEX_URL",
    );
  }

  return {
    botSlug,
    convexUrl,
    policyConfig,
    runnerSecret: requireEnv("BOT_RUNNER_SECRET"),
  };
}

export class BotRunner {
  private assignmentSubscription: RunnerSubscription | null = null;
  private readonly client: RunnerRealtimeClient;
  private readonly httpClient: RunnerHttpClient;
  private readonly planner: DecisionPlanner;
  private readonly watchers = new Map<BotAssignmentId, AssignmentWatcher>();

  constructor(
    private readonly config: RunnerConfig,
    deps: RunnerDeps = {},
  ) {
    this.planner = deps.planner ?? createDecisionPlanner(config.policyConfig);
    this.client = deps.client ?? createRealtimeClient(config.convexUrl);
    this.httpClient = deps.httpClient ?? createHttpClient(config.convexUrl);
  }

  async start() {
    const session = (await (async () => {
      try {
        return (await this.httpClient.action(api.agents.issueBotSession, {
          policyKey: this.config.policyConfig.key,
          runnerSecret: this.config.runnerSecret,
          slug: this.config.botSlug,
        })) as BotRunnerSession;
      } catch (error) {
        console.error(`[${APP_NAME}] failed to issue bot session`, error);
        throw error;
      }
    })()) satisfies BotRunnerSession;

    this.client.setAuth(async () => session.token);
    this.client.subscribeToConnectionState((state) => {
      if (!state.isWebSocketConnected && state.connectionCount > 0) {
        console.warn(
          `[${APP_NAME}] bot runner socket disconnected after ${state.connectionCount} connections.`,
        );
      }
    });

    this.assignmentSubscription = this.client.onUpdate(
      api.agents.listMyAssignments,
      { includeCompleted: false },
      (assignments) => {
        void this.syncAssignments((assignments as BotAssignmentSnapshot[]) ?? []);
      },
      (error) => {
        console.error(`[${APP_NAME}] failed to watch bot assignments`, error);
      },
    );

    console.log(
      `[${APP_NAME}] bot runner ready for ${session.botIdentity.displayName} (${session.botIdentity.slug}) using policy ${this.planner.key}.`,
    );
  }

  async stop() {
    cancelSubscription(this.assignmentSubscription);
    this.assignmentSubscription = null;

    for (const watcher of this.watchers.values()) {
      cancelSubscription(watcher.unsubscribe);
    }
    this.watchers.clear();

    await this.client.close();
  }

  private buildContextHash(view: MatchSeatView) {
    return createHash("sha256")
      .update(
        JSON.stringify({
          availableIntents: view.availableIntents,
          matchId: view.match.id,
          promptId: view.prompt?.promptId ?? null,
          recentEvents: view.recentEvents.map((event) => event.sequence),
          stateVersion: view.match.version,
          viewerSeat: view.viewerSeat,
        }),
      )
      .digest("hex")
      .slice(0, 16);
  }

  private async emitTelemetry(event: MatchTelemetryEvent) {
    try {
      await this.client.mutation(api.agents.recordBotTelemetry, {
        event: {
          at: event.at,
          matchId: event.matchId,
          metrics: event.metrics,
          name: event.name,
          seat: event.seat,
          tags: event.tags,
        },
      });
    } catch (error) {
      console.warn(`[${APP_NAME}] failed to record bot telemetry`, error);
    }
  }

  private buildDecisionTrace(input: {
    actionId: string | null;
    confidence: number | null;
    contextHash: string;
    frame: ReturnType<typeof createDecisionFrame>;
    invalidChoiceReason: string | null;
    respondedAt: number;
    submittedAt: number | null;
  }): BotDecisionTraceV1 {
    const selectedAction =
      input.actionId === null
        ? null
        : input.frame.context.legalActions.find(
            (action) => action.actionId === input.actionId,
          ) ?? null;

    return {
      actionCatalogSize: input.frame.context.legalActions.length,
      chosenActionId: input.actionId,
      chosenKind: selectedAction?.kind ?? null,
      confidence: input.confidence,
      contextHash: input.contextHash,
      invalidChoiceReason: input.invalidChoiceReason,
      matchId: input.frame.matchId,
      policyKey: this.planner.key,
      promptTemplateVersion: null,
      rejectedActionIds: [],
      requestedAt: input.frame.receivedAt,
      respondedAt: input.respondedAt,
      seat: input.frame.seat,
      stateVersion: input.frame.view.match.version,
      submittedAt: input.submittedAt,
      tokenUsage: {
        input: null,
        output: null,
        total: null,
      },
    };
  }

  private async syncAssignments(assignments: BotAssignmentSnapshot[]) {
    const activeAssignmentIds = new Set(
      assignments.map((assignment) => assignment.assignment.id),
    );

    for (const [assignmentId, watcher] of this.watchers) {
      if (activeAssignmentIds.has(assignmentId)) {
        continue;
      }

      cancelSubscription(watcher.unsubscribe);
      this.watchers.delete(assignmentId);
    }

    for (const assignment of assignments) {
      const assignmentId = assignment.assignment.id;
      if (this.watchers.has(assignmentId)) {
        continue;
      }

      const unsubscribe = this.client.onUpdate(
        api.matches.getSeatView,
        { matchId: assignment.assignment.matchId },
        (seatView) => {
          void this.handleSeatView(
            assignment,
            (seatView as MatchSeatView | null) ?? null,
          );
        },
        (error) => {
          console.error(
            `[${APP_NAME}] failed to watch seat view for ${assignment.assignment.matchId}`,
            error,
          );
        },
      );

      this.watchers.set(assignmentId, {
        inFlight: false,
        lastDecisionKey: null,
        unsubscribe,
      });
    }
  }

  private async handleSeatView(
    assignment: BotAssignmentSnapshot,
    seatView: MatchSeatView | null,
  ) {
    const watcher = this.watchers.get(assignment.assignment.id);
    if (!watcher || !seatView) {
      return;
    }

    const catalog = getCatalogForFormat(seatView.match.format.id);
    if (catalog.length === 0) {
      console.warn(
        `[${APP_NAME}] no public catalog is registered for format ${seatView.match.format.id}; skipping ${assignment.assignment.matchId}.`,
      );
      return;
    }

    const frame = createDecisionFrame({
      catalog,
      view: seatView,
    });
    const decisionKey = createDecisionKey(frame);
    const legalActions = listLegalBotActions(frame);

    if (watcher.inFlight || watcher.lastDecisionKey === decisionKey) {
      return;
    }

    const contextHash = this.buildContextHash(seatView);
    const contextSizeBytes = JSON.stringify(frame.context).length;
    await this.emitTelemetry({
      at: frame.receivedAt,
      matchId: frame.matchId,
      metrics: {
        actionCatalogSize: legalActions.length,
        contextBuildMs: frame.context.buildDurationMs,
        contextSizeBytes,
        recentEventCount: frame.context.recentEvents.length,
        visibleCardCount: frame.context.visibleCards.length,
      },
      name: "bot.seat.contextBuilt",
      seat: frame.seat,
      tags: {
        policyKey: this.planner.key,
        promptKind: frame.context.promptDecision?.kind ?? "none",
      },
      userId: null,
    });
    await this.emitTelemetry({
      at: frame.receivedAt,
      matchId: frame.matchId,
      metrics: {
        actionCatalogSize: legalActions.length,
        contextSizeBytes,
      },
      name: "bot.seat.decisionStarted",
      seat: frame.seat,
      tags: {
        policyKey: this.planner.key,
        promptKind: frame.context.promptDecision?.kind ?? "none",
      },
      userId: null,
    });
    watcher.inFlight = true;
    watcher.lastDecisionKey = decisionKey;

    let plannerFailed = false;
    const plan = await (async () => {
      try {
        return await this.planner.decide(frame);
      } catch (error) {
        plannerFailed = true;
        console.error(
          `[${APP_NAME}] failed to plan ${assignment.assignment.matchId} for ${assignment.assignment.seat}`,
          error,
        );
        return null;
      }
    })();
    const respondedAt = Date.now();

    if (!plan) {
      if (plannerFailed) {
        watcher.lastDecisionKey = null;
      }
      await this.emitTelemetry({
        at: respondedAt,
        matchId: frame.matchId,
        metrics: {
          actionCatalogSize: legalActions.length,
          decisionLatencyMs: respondedAt - frame.receivedAt,
        },
        name: "bot.seat.decisionCompleted",
        seat: frame.seat,
        tags: {
          policyKey: this.planner.key,
          result: plannerFailed ? "planner-error" : "no-action",
        },
        userId: null,
      });
      watcher.inFlight = false;
      return;
    }

    const selectedAction =
      legalActions.find((action) => action.actionId === plan.actionId) ?? null;
    if (!selectedAction) {
      watcher.lastDecisionKey = null;
      watcher.inFlight = false;
      const invalidTrace = this.buildDecisionTrace({
        actionId: plan.actionId,
        confidence: plan.confidence,
        contextHash,
        frame,
        invalidChoiceReason: "unknownActionId",
        respondedAt,
        submittedAt: null,
      });
      console.warn(
        `[${APP_NAME}] policy ${this.planner.key} selected an unknown action for ${assignment.assignment.matchId}`,
        invalidTrace,
      );
      await this.emitTelemetry({
        at: respondedAt,
        matchId: frame.matchId,
        metrics: {
          actionCatalogSize: legalActions.length,
          decisionLatencyMs: respondedAt - frame.receivedAt,
        },
        name: "bot.seat.decisionInvalid",
        seat: frame.seat,
        tags: {
          actionId: plan.actionId,
          policyKey: this.planner.key,
          reason: "unknownActionId",
        },
        userId: null,
      });
      return;
    }

    const selectedTrace = this.buildDecisionTrace({
      actionId: selectedAction.actionId,
      confidence: plan.confidence,
      contextHash,
      frame,
      invalidChoiceReason: null,
      respondedAt,
      submittedAt: null,
    });
    console.log(`[${APP_NAME}] decision trace`, JSON.stringify(selectedTrace));
    await this.emitTelemetry({
      at: respondedAt,
      matchId: frame.matchId,
      metrics: {
        actionCatalogSize: legalActions.length,
        decisionLatencyMs: respondedAt - frame.receivedAt,
      },
      name: "bot.seat.decisionCompleted",
      seat: frame.seat,
      tags: {
        actionId: selectedAction.actionId,
        actionKind: selectedAction.kind,
        policyKey: this.planner.key,
        result: "selected",
      },
      userId: null,
    });

    let shouldRefreshSeatView = false;
    let shouldExitAfterSubmit = false;
    let submittedAt: number | null = null;
    try {
      const result = (await this.client.mutation(api.matches.submitIntent, {
        intent: selectedAction.intent,
      })) as {
        accepted: boolean;
        outcome: "applied" | "noop" | "rejected";
        reason: string | null;
      };
      submittedAt = Date.now();
      shouldRefreshSeatView = shouldRefreshSeatViewAfterSubmit({
        accepted: result.accepted,
        reason: result.reason ?? null,
      });
      await this.emitTelemetry({
        at: submittedAt,
        matchId: frame.matchId,
        metrics: {
          actionCatalogSize: legalActions.length,
          submitLatencyMs: submittedAt - frame.receivedAt,
        },
        name: "bot.seat.intentSubmitted",
        seat: frame.seat,
        tags: {
          accepted: result.accepted ? "true" : "false",
          actionId: selectedAction.actionId,
          actionKind: selectedAction.kind,
          outcome: result.outcome,
          policyKey: this.planner.key,
          reason: result.reason ?? "none",
        },
        userId: null,
      });
      if (!result.accepted) {
        watcher.lastDecisionKey = null;
        console.warn(
          `[${APP_NAME}] ${selectedAction.kind} rejected for ${assignment.assignment.matchId} (${result.reason ?? result.outcome}).`,
        );

        shouldExitAfterSubmit = true;
      } else {
        console.log(
          `[${APP_NAME}] ${selectedAction.kind} -> ${assignment.assignment.matchId} (${result.outcome}${result.reason ? `:${result.reason}` : ""})`,
        );
      }
    } catch (error) {
      watcher.lastDecisionKey = null;
      console.error(
        `[${APP_NAME}] failed to submit ${selectedAction.kind} for ${assignment.assignment.matchId}`,
        error,
      );
    } finally {
      watcher.inFlight = false;
    }

    if (shouldRefreshSeatView) {
      const refreshedView = (await this.client.query(api.matches.getSeatView, {
        matchId: assignment.assignment.matchId,
      })) as MatchSeatView | null;
      if (refreshedView) {
        await this.handleSeatView(assignment, refreshedView);
      }
    }

    if (shouldExitAfterSubmit) {
      return;
    }
  }
}
