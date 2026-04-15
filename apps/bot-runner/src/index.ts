import {
  baselineBotPolicy,
  createDecisionFrame,
  createDecisionKey,
  getCatalogForFormat,
} from "@lunchtable/bot-sdk";
import { APP_NAME } from "@lunchtable/shared-types";
import type {
  BotAssignmentId,
  BotAssignmentSnapshot,
  MatchSeatView,
} from "@lunchtable/shared-types";
import { ConvexClient, ConvexHttpClient } from "convex/browser";

import { api } from "../../../convex/_generated/api";
import { shouldRefreshSeatViewAfterSubmit } from "./refresh";

interface RunnerConfig {
  botSlug: string;
  convexUrl: string;
  runnerSecret: string;
}

interface AssignmentWatcher {
  inFlight: boolean;
  lastDecisionKey: string | null;
  unsubscribe: {
    (): void;
    unsubscribe(): void;
  };
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function loadConfig(): RunnerConfig {
  return {
    botSlug: process.env.BOT_SLUG ?? "table-bot",
    convexUrl: process.env.CONVEX_URL ?? requireEnv("VITE_CONVEX_URL"),
    runnerSecret: requireEnv("BOT_RUNNER_SECRET"),
  };
}

class BotRunner {
  private assignmentSubscription: AssignmentWatcher["unsubscribe"] | null =
    null;
  private readonly client: ConvexClient;
  private readonly httpClient: ConvexHttpClient;
  private readonly policy = baselineBotPolicy;
  private readonly watchers = new Map<BotAssignmentId, AssignmentWatcher>();

  constructor(private readonly config: RunnerConfig) {
    this.client = new ConvexClient(config.convexUrl, {
      logger: false,
      verbose: false,
    });
    this.httpClient = new ConvexHttpClient(config.convexUrl, {
      logger: false,
    });
  }

  async start() {
    const session = await this.httpClient.action(api.agents.issueBotSession, {
      runnerSecret: this.config.runnerSecret,
      slug: this.config.botSlug,
    });

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
        void this.syncAssignments(assignments ?? []);
      },
      (error) => {
        console.error(`[${APP_NAME}] failed to watch bot assignments`, error);
      },
    );

    console.log(
      `[${APP_NAME}] bot runner ready for ${session.botIdentity.displayName} (${session.botIdentity.slug}) using policy ${this.policy.key}.`,
    );
  }

  async stop() {
    this.assignmentSubscription?.unsubscribe();
    this.assignmentSubscription = null;

    for (const watcher of this.watchers.values()) {
      watcher.unsubscribe.unsubscribe();
    }
    this.watchers.clear();

    await this.client.close();
  }

  private async syncAssignments(assignments: BotAssignmentSnapshot[]) {
    const activeAssignmentIds = new Set(
      assignments.map((assignment) => assignment.assignment.id),
    );

    for (const [assignmentId, watcher] of this.watchers) {
      if (activeAssignmentIds.has(assignmentId)) {
        continue;
      }

      watcher.unsubscribe.unsubscribe();
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
          void this.handleSeatView(assignment, seatView);
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

    if (watcher.inFlight || watcher.lastDecisionKey === decisionKey) {
      return;
    }

    const plan = this.policy.decide(frame);
    if (!plan) {
      return;
    }

    watcher.inFlight = true;
    watcher.lastDecisionKey = decisionKey;

    let shouldRefreshSeatView = false;
    let shouldExitAfterSubmit = false;
    try {
      const result = await this.client.mutation(api.matches.submitIntent, {
        intent: plan.intent,
      });
      shouldRefreshSeatView = shouldRefreshSeatViewAfterSubmit({
        accepted: result.accepted,
        reason: result.reason ?? null,
      });
      if (!result.accepted) {
        watcher.lastDecisionKey = null;
        console.warn(
          `[${APP_NAME}] ${plan.intent.kind} rejected for ${assignment.assignment.matchId} (${result.reason ?? result.outcome}).`,
        );

        shouldExitAfterSubmit = true;
      } else {
        console.log(
          `[${APP_NAME}] ${plan.intent.kind} -> ${assignment.assignment.matchId} (${result.outcome}${result.reason ? `:${result.reason}` : ""})`,
        );
      }
    } catch (error) {
      watcher.lastDecisionKey = null;
      console.error(
        `[${APP_NAME}] failed to submit ${plan.intent.kind} for ${assignment.assignment.matchId}`,
        error,
      );
    } finally {
      watcher.inFlight = false;
    }

    if (shouldRefreshSeatView) {
      const refreshedView = await this.client.query(api.matches.getSeatView, {
        matchId: assignment.assignment.matchId,
      });
      if (refreshedView) {
        await this.handleSeatView(assignment, refreshedView);
      }
    }

    if (shouldExitAfterSubmit) {
      return;
    }
  }
}

const config = loadConfig();
const runner = new BotRunner(config);

const shutdown = async (signal: string) => {
  console.log(`[${APP_NAME}] stopping bot runner on ${signal}.`);
  await runner.stop();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await runner.start();
