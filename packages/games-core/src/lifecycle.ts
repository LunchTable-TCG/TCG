export type GameId = string;
export type GamePhaseId = string;
export type GameRequestId = string;
export type GameRulesetId = string;
export type GameSeatId = string;

export type GameLifecycleStatus =
  | "complete"
  | "lobby"
  | "paused"
  | "playing"
  | "replaying";

export type GameActorType = "ai" | "human" | "system";

export type GameSeatStatus =
  | "active"
  | "eliminated"
  | "joining"
  | "ready"
  | "spectating";

export interface GameFormatSummary {
  id: string;
  name: string;
  rulesetId: GameRulesetId;
  version: string;
}

export interface GameTimer {
  deadlineAt: number | null;
  durationMs: number;
  ownerSeatId: GameSeatId | null;
  startedAt: number;
}

export interface GameShell {
  activeSeatId: GameSeatId | null;
  format: GameFormatSummary | null;
  id: GameId;
  phase: GamePhaseId;
  prioritySeatId: GameSeatId | null;
  round: number;
  status: GameLifecycleStatus;
  timers: GameTimer[];
  version: number;
}

export interface GameSeat {
  actorType: GameActorType;
  id: GameSeatId;
  permissions: string[];
  resources: Record<string, number>;
  status: GameSeatStatus;
  timers: GameTimer[];
  visibilityScope: string;
}

export type GamePromptKind =
  | "attackers"
  | "blockers"
  | "choice"
  | "cost"
  | "mode"
  | "target";

export interface GamePrompt<TChoice = string> {
  choices: TChoice[];
  expiresAt: number | null;
  id: string;
  kind: GamePromptKind;
  ownerSeatId: GameSeatId;
  required: boolean;
}

export interface GameIntentEnvelope<TIntent> {
  gameId: GameId;
  intent: TIntent;
  requestId: GameRequestId;
  seatId: GameSeatId;
  stateVersion: number;
  submittedAt: number;
}

export interface GameReplayMetadata {
  createdAt: number;
  gameId: GameId;
  initialSeed: string;
  rulesetId: GameRulesetId;
  updatedAt: number;
}

export interface GameReplayCheckpoint<TState> {
  eventSequence: number;
  state: TState;
}

export interface GameReplayLog<TIntent, TEvent, TState> {
  checkpoints: Array<GameReplayCheckpoint<TState>>;
  eventLog: TEvent[];
  intentLog: Array<GameIntentEnvelope<TIntent>>;
  metadata: GameReplayMetadata;
}

export function createIntentEnvelope<TIntent>(
  intent: TIntent,
  metadata: Omit<GameIntentEnvelope<TIntent>, "intent">,
): GameIntentEnvelope<TIntent> {
  return {
    gameId: metadata.gameId,
    intent,
    requestId: metadata.requestId,
    seatId: metadata.seatId,
    stateVersion: metadata.stateVersion,
    submittedAt: metadata.submittedAt,
  };
}

export function createReplayLog<
  TIntent = never,
  TEvent = never,
  TState = never,
>(
  metadata: Omit<GameReplayMetadata, "updatedAt">,
): GameReplayLog<TIntent, TEvent, TState> {
  return {
    checkpoints: [],
    eventLog: [],
    intentLog: [],
    metadata: {
      ...metadata,
      updatedAt: metadata.createdAt,
    },
  };
}

export function recordReplayIntent<TIntent, TEvent, TState>(
  replay: GameReplayLog<TIntent, TEvent, TState>,
  envelope: GameIntentEnvelope<TIntent>,
): GameReplayLog<TIntent, TEvent, TState> {
  return {
    checkpoints: [...replay.checkpoints],
    eventLog: [...replay.eventLog],
    intentLog: [...replay.intentLog, envelope],
    metadata: {
      ...replay.metadata,
      updatedAt: envelope.submittedAt,
    },
  };
}
