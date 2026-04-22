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
import type {
  ActivatedAbility,
  CardAbility,
  CardKind,
  ContinuousEffectNode,
  ContinuousLayer,
  EffectNode,
  ReplacementAbility,
  StaticAbility,
  TriggeredAbility,
} from "./dsl";
import { CONTINUOUS_LAYERS } from "./dsl";

export interface MatchRandomState {
  cursor: number;
  seed: string;
}

export interface MatchResourceState extends SeatResourceView {}

export interface MatchCardCatalogEntry {
  abilities: CardAbility[];
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

export interface MatchRuntimeContinuousEffectState {
  controllerSeat: SeatId;
  effect: Extract<EffectNode, { kind: "grantKeyword" | "modifyStats" }>;
  expiresAtTurn: number | null;
  sourceInstanceId: CardInstanceId | null;
  targetIds: string[];
}

export interface MatchCombatAttackerState {
  attackerId: CardInstanceId;
  defenderSeat: SeatId;
  laneId: string | null;
}

export interface MatchCombatBlockState {
  attackerId: CardInstanceId;
  blockerId: CardInstanceId;
}

export interface MatchCombatState {
  attackers: MatchCombatAttackerState[];
  blocks: MatchCombatBlockState[];
}

export interface MatchStackObjectState {
  abilityId: string | null;
  cardId: string | null;
  controllerSeat: SeatId;
  destinationZone: "battlefield" | "graveyard" | null;
  effects: EffectNode[];
  kind: "activatedAbility" | "castCard" | "triggeredAbility";
  label: string;
  originZone: "battlefield" | "hand" | null;
  sourceInstanceId: CardInstanceId | null;
  stackId: StackObjectId;
  status: "countered" | "fizzled" | "pending" | "resolved";
  targetIds: string[];
}

export function isActivatedAbility(
  ability: CardAbility,
): ability is ActivatedAbility {
  return ability.kind === "activated";
}

export function isTriggeredAbility(
  ability: CardAbility,
): ability is TriggeredAbility {
  return ability.kind === "triggered";
}

export interface MatchSeatState {
  actorType: MatchActorType;
  autoPassEnabled: boolean;
  battlefield: CardInstanceId[];
  command: CardInstanceId[];
  deck: CardInstanceId[];
  exile: CardInstanceId[];
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
  battlefieldEntryTurns: Record<CardInstanceId, number>;
  cardCatalog: Record<string, MatchCardCatalogEntry>;
  combat: MatchCombatState;
  continuousEffects: MatchRuntimeContinuousEffectState[];
  eventSequence: number;
  lastPriorityPassSeat: SeatId | null;
  prompts: MatchPromptState[];
  random: MatchRandomState;
  seats: Record<SeatId, MatchSeatState>;
  shell: MatchShell;
  stack: MatchStackObjectState[];
}

export interface DerivedBattlefieldCardState {
  annotations: string[];
  controllerSeat: SeatId;
  instanceId: CardInstanceId;
  keywords: string[];
  permissions: string[];
  power: number | null;
  toughness: number | null;
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
    exile: [],
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
    battlefieldEntryTurns: {},
    cardCatalog: {},
    combat: {
      attackers: [],
      blocks: [],
    },
    continuousEffects: [],
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

export function isReplacementAbility(
  ability: CardAbility,
): ability is ReplacementAbility {
  return ability.kind === "replacement";
}

export function isStaticAbility(
  ability: CardAbility,
): ability is StaticAbility {
  return ability.kind === "static";
}

function cardIdFromInstanceId(instanceId: string) {
  const [, cardId] = instanceId.split(":");
  return cardId ?? instanceId;
}

function getAffectedBattlefieldInstances(
  state: MatchState,
  sourceInstanceId: CardInstanceId,
  controllerSeat: SeatId,
  effect: ContinuousEffectNode,
) {
  if (effect.target === "self") {
    return [sourceInstanceId];
  }

  return state.seats[controllerSeat].battlefield.filter(
    (instanceId) => instanceId !== sourceInstanceId,
  );
}

function createBaseDerivedBattlefieldState(
  state: MatchState,
): Record<CardInstanceId, DerivedBattlefieldCardState> {
  const entries: Record<CardInstanceId, DerivedBattlefieldCardState> = {};

  for (const seat of Object.values(state.seats)) {
    for (const instanceId of seat.battlefield) {
      const card = state.cardCatalog[cardIdFromInstanceId(instanceId)];
      entries[instanceId] = {
        annotations: [],
        controllerSeat: seat.seat,
        instanceId,
        keywords: [...(card?.keywords ?? [])],
        permissions: [],
        power: card?.stats?.power ?? null,
        toughness: card?.stats?.toughness ?? null,
      };
    }
  }

  return entries;
}

function applyContinuousEffect(
  derived: Record<CardInstanceId, DerivedBattlefieldCardState>,
  effect:
    | ContinuousEffectNode
    | Extract<EffectNode, { kind: "grantKeyword" | "modifyStats" }>,
  targets: CardInstanceId[],
) {
  for (const instanceId of targets) {
    const entry = derived[instanceId];
    if (!entry) {
      continue;
    }

    if (effect.kind === "modifyStats") {
      entry.power = (entry.power ?? 0) + (effect.modifier.power ?? 0);
      entry.toughness =
        (entry.toughness ?? 0) + (effect.modifier.toughness ?? 0);
      continue;
    }

    if (effect.kind === "grantKeyword") {
      if (!entry.keywords.includes(effect.keywordId)) {
        entry.keywords.push(effect.keywordId);
      }
      continue;
    }

    if (!entry.permissions.includes(effect.permission)) {
      entry.permissions.push(effect.permission);
    }
  }
}

export function deriveBattlefieldCardStates(
  state: MatchState,
): Record<CardInstanceId, DerivedBattlefieldCardState> {
  const derived = createBaseDerivedBattlefieldState(state);

  for (const layer of CONTINUOUS_LAYERS) {
    for (const seat of Object.values(state.seats)) {
      for (const instanceId of seat.battlefield) {
        const card = state.cardCatalog[cardIdFromInstanceId(instanceId)];
        if (!card) {
          continue;
        }

        for (const ability of card.abilities) {
          if (!isStaticAbility(ability) || ability.layer !== layer) {
            continue;
          }

          const targets = getAffectedBattlefieldInstances(
            state,
            instanceId,
            seat.seat,
            ability.effect,
          );
          applyContinuousEffect(derived, ability.effect, targets);
        }
      }
    }
  }

  for (const effectState of state.continuousEffects) {
    if (
      effectState.expiresAtTurn !== null &&
      effectState.expiresAtTurn < state.shell.turnNumber
    ) {
      continue;
    }

    applyContinuousEffect(derived, effectState.effect, effectState.targetIds);
  }

  return derived;
}

export function listReplacementAbilities(
  state: MatchState,
  instanceId: CardInstanceId,
) {
  const card = state.cardCatalog[cardIdFromInstanceId(instanceId)];
  if (!card) {
    return [];
  }

  return card.abilities.filter(isReplacementAbility);
}
