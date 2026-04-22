import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  createAgentMatchContext,
  createDecisionFrame,
  listLegalBotActions,
} from "@lunchtable/bot-sdk";
import {
  createCatalogEntriesForFormat,
  starterFormat,
} from "@lunchtable/card-content";
import {
  BENCHMARK_RESULT_VERSION,
  type BenchmarkMeasurementV1,
  type BenchmarkResultV1,
  type MatchSeatView,
} from "@lunchtable/shared-types";

import {
  buildPersistedIntentResult,
  buildPersistedMatchBundle,
} from "../convex/lib/matches";

const BUDGETS_MS = {
  "agent-context-build": 2,
  "legal-action-catalog": 1,
  "scripted-current-format-match": 6,
} as const;

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function createParticipantDeck() {
  return {
    mainboard: starterFormat.cardPool.map((card) => ({
      cardId: card.id,
      count: starterFormat.deckRules.maxCopies,
    })),
    sideboard: [],
  };
}

function createBenchmarkSeatView(): MatchSeatView {
  const bundle = buildPersistedMatchBundle({
    activeSeat: "seat-1",
    createdAt: Date.UTC(2026, 3, 3, 18, 0, 0),
    format: starterFormat,
    matchId: "benchmark_match",
    participants: [
      {
        actorType: "human",
        deck: createParticipantDeck(),
        seat: "seat-0",
        userId: "user_human" as never,
        username: "human",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        actorType: "bot",
        deck: createParticipantDeck(),
        seat: "seat-1",
        userId: "user_bot" as never,
        username: "Table Bot",
      },
    ],
    startedAt: Date.UTC(2026, 3, 3, 18, 0, 0),
    status: "active",
    turnNumber: 1,
  });

  const keepSeat0 = buildPersistedIntentResult({
    events: bundle.events,
    intent: {
      intentId: "bench_keep_human",
      kind: "keepOpeningHand",
      matchId: bundle.shell.id,
      payload: {},
      seat: "seat-0",
      stateVersion: bundle.shell.version,
    },
    state: bundle.state,
  });
  const keepSeat1 = buildPersistedIntentResult({
    events: keepSeat0.allEvents,
    intent: {
      intentId: "bench_keep_bot",
      kind: "keepOpeningHand",
      matchId: bundle.shell.id,
      payload: {},
      seat: "seat-1",
      stateVersion: keepSeat0.state.shell.version,
    },
    state: keepSeat0.state,
  });

  const seatView = keepSeat1.views.find(
    (view) => view.viewerSeat === "seat-1",
  )?.view;
  if (!seatView) {
    throw new Error("Missing benchmark seat view");
  }

  seatView.match.activeSeat = "seat-1";
  seatView.match.phase = "main1";
  seatView.match.prioritySeat = "seat-1";
  seatView.match.turnNumber = 2;
  seatView.seats = seatView.seats.map((seat) =>
    seat.seat === "seat-1"
      ? {
          ...seat,
          resources: [
            {
              current: 3,
              label: "Mana",
              maximum: 3,
              resourceId: "mana",
            },
          ],
        }
      : seat,
  );
  seatView.zones = seatView.zones.map((zone) => {
    if (zone.ownerSeat === "seat-1" && zone.zone === "hand") {
      return {
        ...zone,
        cardCount: 2,
        cards: [
          {
            annotations: [],
            cardId: "ember-summoner",
            controllerSeat: "seat-1",
            counters: {},
            instanceId: "seat-1:ember-summoner:hand:1",
            isTapped: false,
            keywords: [],
            name: "Ember Summoner",
            ownerSeat: "seat-1",
            slotId: null,
            statLine: { power: 2, toughness: 2 },
            visibility: "private-self",
            zone: "hand",
          },
          {
            annotations: [],
            cardId: "tidecall-apprentice",
            controllerSeat: "seat-1",
            counters: {},
            instanceId: "seat-1:tidecall-apprentice:hand:1",
            isTapped: false,
            keywords: [],
            name: "Tidecall Apprentice",
            ownerSeat: "seat-1",
            slotId: null,
            statLine: { power: 1, toughness: 2 },
            visibility: "private-self",
            zone: "hand",
          },
        ],
      };
    }

    return zone;
  });

  return seatView;
}

function runScriptedCurrentFormatMatch() {
  let current = (() => {
    const base = buildPersistedMatchBundle({
      activeSeat: "seat-0",
      createdAt: Date.UTC(2026, 3, 3, 16, 0, 0),
      format: starterFormat,
      matchId: "benchmark_playability_match",
      participants: [
        {
          actorType: "human",
          deck: createParticipantDeck(),
          seat: "seat-0",
          userId: "user_human" as never,
          username: "human",
          walletAddress: "0x1111111111111111111111111111111111111111",
        },
        {
          actorType: "bot",
          deck: createParticipantDeck(),
          seat: "seat-1",
          userId: "user_bot" as never,
          username: "Table Bot",
        },
      ],
      startedAt: Date.UTC(2026, 3, 3, 16, 0, 0),
      status: "active",
      turnNumber: 1,
    });

    const keepSeat0 = buildPersistedIntentResult({
      events: base.events,
      intent: {
        intentId: "bench_script_keep_human",
        kind: "keepOpeningHand",
        matchId: base.shell.id,
        payload: {},
        seat: "seat-0",
        stateVersion: base.shell.version,
      },
      state: base.state,
    });
    const keepSeat1 = buildPersistedIntentResult({
      events: keepSeat0.allEvents,
      intent: {
        intentId: "bench_script_keep_bot",
        kind: "keepOpeningHand",
        matchId: base.shell.id,
        payload: {},
        seat: "seat-1",
        stateVersion: keepSeat0.state.shell.version,
      },
      state: keepSeat0.state,
    });

    keepSeat1.state.shell.activeSeat = "seat-0";
    keepSeat1.state.shell.phase = "main1";
    keepSeat1.state.shell.prioritySeat = "seat-0";
    keepSeat1.state.shell.turnNumber = 10;
    keepSeat1.state.seats["seat-0"].battlefield = [];
    keepSeat1.state.seats["seat-0"].deck = [];
    keepSeat1.state.seats["seat-0"].graveyard = [];
    keepSeat1.state.seats["seat-0"].hand = [
      "seat-0:ember-summoner:hand:1",
      "seat-0:ember-summoner:hand:2",
      "seat-0:ember-summoner:hand:3",
      "seat-0:ember-summoner:hand:4",
      "seat-0:ember-summoner:hand:5",
    ];
    keepSeat1.state.seats["seat-0"].resources = [
      {
        current: 10,
        label: "Mana",
        maximum: 10,
        resourceId: "mana",
      },
    ];
    keepSeat1.state.seats["seat-1"].battlefield = [];
    keepSeat1.state.seats["seat-1"].deck = [];
    keepSeat1.state.seats["seat-1"].graveyard = [];
    keepSeat1.state.seats["seat-1"].hand = [];
    keepSeat1.state.seats["seat-1"].lifeTotal = 10;

    return keepSeat1;
  })();

  const passSeat1 = () => {
    current = buildPersistedIntentResult({
      events: current.allEvents,
      intent: {
        intentId: `bench-pass-seat-1:${current.state.shell.version}`,
        kind: "passPriority",
        matchId: current.shell.id,
        payload: {},
        seat: "seat-1",
        stateVersion: current.state.shell.version,
      },
      state: current.state,
    });
  };

  const passSeat0 = () => {
    current = buildPersistedIntentResult({
      events: current.allEvents,
      intent: {
        intentId: `bench-pass-seat-0:${current.state.shell.version}`,
        kind: "passPriority",
        matchId: current.shell.id,
        payload: {},
        seat: "seat-0",
        stateVersion: current.state.shell.version,
      },
      state: current.state,
    });
  };

  for (let copyIndex = 1; copyIndex <= 5; copyIndex += 1) {
    current = buildPersistedIntentResult({
      events: current.allEvents,
      intent: {
        intentId: `bench-play:${copyIndex}`,
        kind: "playCard",
        matchId: current.shell.id,
        payload: {
          alternativeCostId: null,
          cardInstanceId: `seat-0:ember-summoner:hand:${copyIndex}`,
          sourceZone: "hand",
          targetSlotId: null,
        },
        seat: "seat-0",
        stateVersion: current.state.shell.version,
      },
      state: current.state,
    });
    passSeat1();
    passSeat0();
    passSeat0();
    passSeat1();
  }

  return current.state.shell.winnerSeat;
}

function measure(
  name: keyof typeof BUDGETS_MS,
  iterations: number,
  callback: () => void,
): BenchmarkMeasurementV1 {
  let minMs = Number.POSITIVE_INFINITY;
  let maxMs = 0;
  let totalMs = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const startedAt = nowMs();
    callback();
    const durationMs = nowMs() - startedAt;
    minMs = Math.min(minMs, durationMs);
    maxMs = Math.max(maxMs, durationMs);
    totalMs += durationMs;
  }

  return {
    averageMs: Number((totalMs / iterations).toFixed(3)),
    iterations,
    maxMs: Number(maxMs.toFixed(3)),
    minMs: Number(minMs.toFixed(3)),
    name,
    totalMs: Number(totalMs.toFixed(3)),
  };
}

const catalog = createCatalogEntriesForFormat(starterFormat);
const seatView = createBenchmarkSeatView();

const measurements = [
  measure("agent-context-build", 200, () => {
    createAgentMatchContext({
      catalog,
      view: seatView,
    });
  }),
  measure("legal-action-catalog", 200, () => {
    const frame = createDecisionFrame({
      catalog,
      view: seatView,
    });
    listLegalBotActions(frame);
  }),
  measure("scripted-current-format-match", 40, () => {
    const winnerSeat = runScriptedCurrentFormatMatch();
    if (winnerSeat !== "seat-0") {
      throw new Error(
        `Expected scripted match winner to be seat-0, received ${winnerSeat}`,
      );
    }
  }),
];

const result: BenchmarkResultV1 = {
  generatedAt: Date.now(),
  measurements,
  suite: "agent-playable-current-format",
  version: BENCHMARK_RESULT_VERSION,
};

const benchmarkDir = join(process.cwd(), ".phase-loop", "benchmarks");
mkdirSync(benchmarkDir, { recursive: true });
writeFileSync(
  join(benchmarkDir, "agent-playable-current-format.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);

const failingMeasurement = measurements.find(
  (measurement) => measurement.averageMs > BUDGETS_MS[measurement.name],
);

console.log(JSON.stringify(result, null, 2));

if (failingMeasurement) {
  console.error(
    `Benchmark ${failingMeasurement.name} exceeded budget: ${failingMeasurement.averageMs}ms average > ${BUDGETS_MS[failingMeasurement.name]}ms`,
  );
  process.exit(1);
}
