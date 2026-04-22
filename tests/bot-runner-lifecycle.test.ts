import { starterFormat } from "@lunchtable/card-content";
import type {
  BotAssignmentSnapshot,
  BotRunnerSession,
  MatchSeatView,
  MatchTelemetryEvent,
} from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";

import { createDecisionPlanner } from "../apps/bot-runner/src/policy";
import { BotRunner, type RunnerConfig } from "../apps/bot-runner/src/runner";
import { buildPersistedMatchBundle } from "../convex/lib/matches";
import { buildStarterDeck } from "./helpers/starterDeck";

async function flushAsyncWork(turns = 24) {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve();
  }
}

function createBotSeatView(): MatchSeatView {
  const bundle = buildPersistedMatchBundle({
    activeSeat: "seat-0",
    createdAt: Date.UTC(2026, 3, 3, 12, 0, 0),
    format: starterFormat,
    matchId: "match_bot_runner_restart",
    participants: [
      {
        actorType: "human",
        deck: buildStarterDeck(),
        seat: "seat-0",
        userId: "user_human" as never,
        username: "human",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        actorType: "bot",
        deck: buildStarterDeck(),
        seat: "seat-1",
        userId: "user_bot" as never,
        username: "Table Bot",
      },
    ],
    startedAt: Date.UTC(2026, 3, 3, 12, 0, 0),
    status: "active",
    turnNumber: 1,
  });

  const view = bundle.views.find(
    (entry) => entry.viewerSeat === "seat-1",
  )?.view;
  if (!view) {
    throw new Error("Expected bot seat view");
  }

  return view;
}

class FakeRunnerBackend {
  private readonly assignmentSubscribers = new Set<
    (assignments: BotAssignmentSnapshot[]) => void
  >();
  private readonly seatViewSubscribers = new Map<
    string,
    Set<(seatView: MatchSeatView | null) => void>
  >();
  private readonly seatViews = new Map<string, MatchSeatView | null>();

  readonly submittedIntents: Array<{ kind: string; matchId: string }> = [];
  readonly telemetry: MatchTelemetryEvent[] = [];

  constructor(private readonly session: BotRunnerSession) {}

  createHttpClient() {
    return {
      action: async () => {
        return this.session;
      },
    };
  }

  createRealtimeClient() {
    return {
      close: async () => {},
      mutation: async (_functionRef: unknown, args: unknown) => {
        if (
          typeof args === "object" &&
          args &&
          "intent" in args &&
          typeof (args as { intent?: unknown }).intent === "object"
        ) {
          const intent = (args as { intent: { kind: string; matchId: string } })
            .intent;
          this.submittedIntents.push({
            kind: intent.kind,
            matchId: intent.matchId,
          });
          return {
            accepted: true,
            appendedEventKinds: ["openingHandKept"],
            outcome: "applied" as const,
            reason: null,
            seatView: null,
            shell: null,
          };
        }

        if (
          typeof args === "object" &&
          args &&
          "event" in args &&
          typeof (args as { event?: unknown }).event === "object"
        ) {
          this.telemetry.push((args as { event: MatchTelemetryEvent }).event);
          return null;
        }

        throw new Error("Unexpected mutation");
      },
      onUpdate: (
        _functionRef: unknown,
        args: unknown,
        onValue: (value: unknown) => void,
      ) => {
        if (
          typeof args === "object" &&
          args &&
          "includeCompleted" in args &&
          (args as { includeCompleted?: boolean }).includeCompleted === false
        ) {
          const subscriber = onValue as (
            assignments: BotAssignmentSnapshot[],
          ) => void;
          this.assignmentSubscribers.add(subscriber);
          return {
            unsubscribe: () => {
              this.assignmentSubscribers.delete(subscriber);
            },
          };
        }

        if (
          typeof args === "object" &&
          args &&
          "matchId" in args &&
          typeof (args as { matchId?: unknown }).matchId === "string"
        ) {
          const matchId = (args as { matchId: string }).matchId;
          const subscriber = onValue as (
            seatView: MatchSeatView | null,
          ) => void;
          const subscribers =
            this.seatViewSubscribers.get(matchId) ?? new Set();
          subscribers.add(subscriber);
          this.seatViewSubscribers.set(matchId, subscribers);

          const cachedSeatView = this.seatViews.get(matchId);
          if (cachedSeatView) {
            subscriber(cachedSeatView);
          }

          return {
            unsubscribe: () => {
              subscribers.delete(subscriber);
              if (subscribers.size === 0) {
                this.seatViewSubscribers.delete(matchId);
              }
            },
          };
        }

        throw new Error("Unexpected subscription");
      },
      query: async (_functionRef: unknown, args: unknown) => {
        if (
          typeof args !== "object" ||
          !args ||
          !("matchId" in args) ||
          typeof (args as { matchId?: unknown }).matchId !== "string"
        ) {
          throw new Error("Unexpected query");
        }

        return (
          this.seatViews.get((args as { matchId: string }).matchId) ?? null
        );
      },
      setAuth: () => {},
      subscribeToConnectionState: () => {},
    };
  }

  emitAssignments(assignments: BotAssignmentSnapshot[]) {
    for (const subscriber of this.assignmentSubscribers) {
      subscriber(assignments);
    }
  }

  emitSeatView(matchId: string, seatView: MatchSeatView | null) {
    this.seatViews.set(matchId, seatView);
    for (const subscriber of this.seatViewSubscribers.get(matchId) ?? []) {
      subscriber(seatView);
    }
  }
}

describe("bot runner lifecycle", () => {
  it("rejoins an existing assignment after runner restart and submits a legal action", async () => {
    const seatView = createBotSeatView();
    const matchId = seatView.match.id;
    const assignment: BotAssignmentSnapshot = {
      assignment: {
        botIdentityId: "bot_identity_restart" as never,
        completedAt: null,
        createdAt: Date.UTC(2026, 3, 3, 12, 0, 0),
        id: "assignment_restart" as never,
        lastIntentAt: null,
        lastObservedVersion: seatView.match.version,
        matchId,
        seat: "seat-1",
        status: "active",
        updatedAt: Date.UTC(2026, 3, 3, 12, 0, 0),
        userId: "user_bot" as never,
      },
      match: seatView.match,
    };
    const session: BotRunnerSession = {
      botIdentity: {
        createdAt: Date.UTC(2026, 3, 3, 12, 0, 0),
        displayName: "Table Bot",
        id: "bot_identity_restart" as never,
        policyKey: "baseline-v2-legal-actions",
        slug: "table-bot",
        status: "active",
        updatedAt: Date.UTC(2026, 3, 3, 12, 0, 0),
        userId: "user_bot" as never,
      },
      token: "bot-session-token",
      userId: "user_bot" as never,
      username: "Table Bot",
    };
    const config: RunnerConfig = {
      botSlug: "table-bot",
      convexUrl: "https://example.convex.cloud",
      policyConfig: {
        authToken: null,
        decisionUrl: null,
        key: "baseline-v2-legal-actions",
        mode: "baseline",
        timeoutMs: 6_000,
      },
      runnerSecret: "runner-secret",
    };
    const backend = new FakeRunnerBackend(session);
    const planner = createDecisionPlanner(config.policyConfig);

    const firstRunner = new BotRunner(config, {
      client: backend.createRealtimeClient(),
      httpClient: backend.createHttpClient(),
      planner,
    });
    await firstRunner.start();
    backend.emitAssignments([assignment]);
    backend.emitSeatView(matchId, seatView);
    await flushAsyncWork();

    expect(backend.submittedIntents).toEqual([
      {
        kind: "keepOpeningHand",
        matchId,
      },
    ]);

    await firstRunner.stop();
    backend.emitSeatView(matchId, seatView);
    await flushAsyncWork();

    expect(backend.submittedIntents).toHaveLength(1);

    const restartedRunner = new BotRunner(config, {
      client: backend.createRealtimeClient(),
      httpClient: backend.createHttpClient(),
      planner,
    });
    await restartedRunner.start();
    backend.emitAssignments([assignment]);
    backend.emitSeatView(matchId, seatView);
    await flushAsyncWork();

    expect(backend.submittedIntents).toEqual([
      {
        kind: "keepOpeningHand",
        matchId,
      },
      {
        kind: "keepOpeningHand",
        matchId,
      },
    ]);
    expect(
      backend.telemetry.some(
        (event) =>
          event.name === "bot.seat.intentSubmitted" &&
          event.matchId === matchId,
      ),
    ).toBe(true);

    await restartedRunner.stop();
  });
});
