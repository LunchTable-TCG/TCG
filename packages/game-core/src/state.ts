import type {
  CardInstanceId,
  MatchActorType,
  MatchFormatSummary,
  MatchId,
  MatchShell,
  MatchStatus,
  MatchVisibility,
  PromptId,
  SeatId,
  SeatResourceView,
  StackObjectId,
  UserId,
} from "@lunchtable/shared-types";
import type { CardKind } from "./dsl";

export interface MatchRandomState {
  cursor: number;
  seed: string;
}

export interface MatchResourceState extends SeatResourceView {}

export interface MatchCardCatalogEntry {
  cardId: string;
  cost: number;
  kind: CardKind;
  keywords: string[];
  name: string;
  stats?: {
    power: number;
    toughness: number;
  };
}

export interface MatchPromptState {
  choiceIds: string[];
  expiresAt: number | null;
  kind:
    | "mulligan"
    | "priority"
    | "targets"
    | "modes"
    | "costs"
    | "attackers"
    | "blockers"
    | "choice";
  message: string;
  ownerSeat: SeatId;
  promptId: PromptId;
  resolvedChoiceIds: string[];
  status: "pending" | "resolved";
}

export interface MatchStackObjectState {
  controllerSeat: SeatId;
  label: string;
  sourceInstanceId: CardInstanceId | null;
  stackId: StackObjectId;
  status: "countered" | "fizzled" | "pending" | "resolved";
  targetIds: string[];
}

export interface MatchSeatState {
  actorType: MatchActorType;
  autoPassEnabled: boolean;
  battlefield: CardInstanceId[];
  command: CardInstanceId[];
  deck: CardInstanceId[];
  graveyard: CardInstanceId[];
  hand: CardInstanceId[];
  lifeTotal: number;
  mulligansTaken: number;
  objective: CardInstanceId[];
  ready: boolean;
  resources: MatchResourceState[];
  seat: SeatId;
  sideboard: CardInstanceId[];
  status: "active" | "conceded" | "eliminated" | "joining" | "ready";
  userId: UserId | null;
  username: string | null;
  visibility: MatchVisibility;
  walletAddress: string | null;
}

export interface MatchState {
  cardCatalog: Record<string, MatchCardCatalogEntry>;
  eventSequence: number;
  lastPriorityPassSeat: SeatId | null;
  prompts: MatchPromptState[];
  random: MatchRandomState;
  seats: Record<SeatId, MatchSeatState>;
  shell: MatchShell;
  stack: MatchStackObjectState[];
}

export interface CreateMatchStateOptions {
  createdAt?: number;
  matchId?: MatchId;
  seed?: string;
  seatActors?: Array<{
    actorType?: MatchActorType;
    seat: SeatId;
    userId?: UserId | null;
    username?: string | null;
    walletAddress?: string | null;
  }>;
  status?: MatchStatus;
}

export const DEFAULT_MATCH_FORMAT: MatchFormatSummary = {
  boardModel: "openBoard",
  deckRules: {
    maxCopies: 4,
    minCards: 40,
    sideboardSize: 15,
  },
  id: "core-demo",
  name: "Core Demo",
  resourceModel: "manaCurve",
  timingModel: "fullStack",
  turnModel: "alternating",
  version: "0.0.1",
  victoryModel: "lifeTotal",
};

export const DEFAULT_MATCH_SEED = "seed:bootstrap";
const DEFAULT_CREATED_AT = 0;
const DEFAULT_SEAT_ACTORS: Array<
  NonNullable<CreateMatchStateOptions["seatActors"]>[number]
> = [
  {
    actorType: "human",
    seat: "seat-0",
  },
  {
    actorType: "human",
    seat: "seat-1",
  },
];

function createSeatState(
  input: NonNullable<CreateMatchStateOptions["seatActors"]>[number],
): MatchSeatState {
  return {
    actorType: input.actorType ?? "human",
    autoPassEnabled: false,
    battlefield: [],
    command: [],
    deck: [],
    graveyard: [],
    hand: [],
    lifeTotal: 20,
    mulligansTaken: 0,
    objective: [],
    ready: false,
    resources: [],
    seat: input.seat,
    sideboard: [],
    status: "joining",
    userId: input.userId ?? null,
    username: input.username ?? null,
    visibility: "private-self",
    walletAddress: input.walletAddress ?? null,
  };
}

function createSeatSummary(seat: MatchSeatState) {
  return {
    actorType: seat.actorType,
    connected: false,
    deckCount: seat.deck.length,
    graveyardCount: seat.graveyard.length,
    handCount: seat.hand.length,
    lifeTotal: seat.lifeTotal,
    ready: seat.ready,
    resourceTotal: seat.resources.reduce(
      (total, resource) => total + resource.current,
      0,
    ),
    seat: seat.seat,
    status: seat.status,
    userId: seat.userId,
    username: seat.username,
    walletAddress: seat.walletAddress,
  };
}

export function createMatchShellFromState(state: MatchState): MatchShell {
  return {
    activeSeat: state.shell.activeSeat,
    completedAt: state.shell.completedAt,
    createdAt: state.shell.createdAt,
    format: state.shell.format,
    id: state.shell.id,
    lastEventNumber: state.eventSequence,
    phase: state.shell.phase,
    prioritySeat: state.shell.prioritySeat,
    seats: Object.values(state.seats).map(createSeatSummary),
    spectatorCount: state.shell.spectatorCount,
    startedAt: state.shell.startedAt,
    status: state.shell.status,
    timers: state.shell.timers,
    turnNumber: state.shell.turnNumber,
    version: state.shell.version,
    winnerSeat: state.shell.winnerSeat,
  };
}

export function createMatchState(
  options: CreateMatchStateOptions = {},
): MatchState {
  const seatActors = options.seatActors ?? DEFAULT_SEAT_ACTORS;
  const seats = Object.fromEntries(
    seatActors.map((actor) => {
      const seat = createSeatState(actor);
      return [seat.seat, seat];
    }),
  ) as Record<SeatId, MatchSeatState>;

  const shell: MatchShell = {
    activeSeat: null,
    completedAt: null,
    createdAt: options.createdAt ?? DEFAULT_CREATED_AT,
    format: DEFAULT_MATCH_FORMAT,
    id: options.matchId ?? "bootstrap-match",
    lastEventNumber: 0,
    phase: "bootstrap",
    prioritySeat: null,
    seats: Object.values(seats).map(createSeatSummary),
    spectatorCount: 0,
    startedAt: null,
    status: options.status ?? "pending",
    timers: {
      activeDeadlineAt: null,
      ropeDeadlineAt: null,
      seatTimeRemainingMs: {},
      turnStartedAt: null,
    },
    turnNumber: 0,
    version: 0,
    winnerSeat: null,
  };

  const state: MatchState = {
    cardCatalog: {},
    eventSequence: 0,
    lastPriorityPassSeat: null,
    prompts: [],
    random: {
      cursor: 0,
      seed: options.seed ?? DEFAULT_MATCH_SEED,
    },
    seats,
    shell,
    stack: [],
  };

  state.shell = createMatchShellFromState(state);
  return state;
}

export function deriveDeterministicNumber(
  random: MatchRandomState,
): [number, MatchRandomState] {
  const input = `${random.seed}:${random.cursor}`;
  let hash = 2166136261;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const nextRandom = {
    cursor: random.cursor + 1,
    seed: random.seed,
  };
  return [(hash >>> 0) / 4294967295, nextRandom];
}
