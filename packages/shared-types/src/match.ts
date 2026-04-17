import type { UserId } from "./auth";
import type { GameplayIntentKind, MatchEventKind } from "./kinds";

export type MatchId = string;
export type SeatId = string;
export type MatchSeatId = "seat-0" | "seat-1";
export type CardInstanceId = string;
export type PromptId = string;
export type StackObjectId = string;

export function assertMatchSeatId(seat: string): MatchSeatId {
  if (seat === "seat-0" || seat === "seat-1") {
    return seat;
  }

  throw new Error(`Unsupported match seat: ${seat}`);
}

export const MATCH_PHASES = [
  "bootstrap",
  "mulligan",
  "ready",
  "upkeep",
  "draw",
  "main1",
  "attack",
  "block",
  "damage",
  "main2",
  "end",
  "cleanup",
] as const;

export type MatchPhase = (typeof MATCH_PHASES)[number];

export const MATCH_STATUSES = [
  "pending",
  "active",
  "complete",
  "cancelled",
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_ACTOR_TYPES = ["human", "bot"] as const;
export type MatchActorType = (typeof MATCH_ACTOR_TYPES)[number];

export const MATCH_SEAT_STATUSES = [
  "joining",
  "ready",
  "active",
  "eliminated",
  "conceded",
] as const;

export type MatchSeatStatus = (typeof MATCH_SEAT_STATUSES)[number];

export const MATCH_VISIBILITIES = [
  "public",
  "private-self",
  "hidden",
  "count-only",
] as const;

export type MatchVisibility = (typeof MATCH_VISIBILITIES)[number];

export const MATCH_TURN_MODELS = [
  "alternating",
  "rounds",
  "simultaneousPlanning",
] as const;

export type MatchTurnModel = (typeof MATCH_TURN_MODELS)[number];

export const MATCH_TIMING_MODELS = [
  "fullStack",
  "fastSlow",
  "burstOnly",
  "noResponses",
] as const;

export type MatchTimingModel = (typeof MATCH_TIMING_MODELS)[number];

export const MATCH_BOARD_MODELS = [
  "openBoard",
  "lanes",
  "grid",
  "objectives",
] as const;

export type MatchBoardModel = (typeof MATCH_BOARD_MODELS)[number];

export const MATCH_RESOURCE_MODELS = [
  "manaCurve",
  "energy",
  "actionPoints",
  "autoRamp",
] as const;

export type MatchResourceModel = (typeof MATCH_RESOURCE_MODELS)[number];

export const MATCH_VICTORY_MODELS = [
  "lifeTotal",
  "objectives",
  "scoreRace",
  "bossDefeat",
] as const;

export type MatchVictoryModel = (typeof MATCH_VICTORY_MODELS)[number];

export const MATCH_ZONE_KINDS = [
  "deck",
  "hand",
  "battlefield",
  "graveyard",
  "exile",
  "stack",
  "command",
  "objective",
  "sideboard",
  "laneReserve",
] as const;

export type ZoneKind = (typeof MATCH_ZONE_KINDS)[number];

export interface MatchDeckRulesSummary {
  maxCopies: number;
  minCards: number;
  sideboardSize: number;
}

export interface MatchFormatSummary {
  boardModel: MatchBoardModel;
  deckRules: MatchDeckRulesSummary;
  id: string;
  name: string;
  resourceModel: MatchResourceModel;
  timingModel: MatchTimingModel;
  turnModel: MatchTurnModel;
  version: string;
  victoryModel: MatchVictoryModel;
}

export interface MatchTimerSnapshot {
  activeDeadlineAt: number | null;
  ropeDeadlineAt: number | null;
  seatTimeRemainingMs: Record<SeatId, number>;
  turnStartedAt: number | null;
}

export interface MatchSeatSummary {
  actorType: MatchActorType;
  connected: boolean;
  deckCount: number;
  graveyardCount: number;
  handCount: number;
  lifeTotal: number;
  ready: boolean;
  resourceTotal: number;
  seat: SeatId;
  status: MatchSeatStatus;
  userId: UserId | null;
  username: string | null;
  walletAddress: string | null;
}

export interface MatchShell {
  activeSeat: SeatId | null;
  completedAt: number | null;
  createdAt: number;
  format: MatchFormatSummary;
  id: MatchId;
  lastEventNumber: number;
  phase: MatchPhase;
  prioritySeat: SeatId | null;
  seats: MatchSeatSummary[];
  spectatorCount: number;
  startedAt: number | null;
  status: MatchStatus;
  timers: MatchTimerSnapshot;
  turnNumber: number;
  version: number;
  winnerSeat: SeatId | null;
}

export type MatchSkeleton = MatchShell;

export interface SeatResourceView {
  current: number;
  label: string;
  maximum: number | null;
  resourceId: string;
}

export interface SeatStateView {
  actorType: MatchActorType;
  autoPassEnabled: boolean;
  deckCount: number;
  graveyardCount: number;
  handCount: number;
  hasPriority: boolean;
  isActiveTurn: boolean;
  lifeTotal: number;
  resources: SeatResourceView[];
  seat: SeatId;
  status: MatchSeatStatus;
  username: string | null;
}

export interface MatchCardStatLine {
  power: number | null;
  toughness: number | null;
}

export interface MatchCardView {
  annotations: string[];
  cardId: string;
  controllerSeat: SeatId;
  counters: Record<string, number>;
  instanceId: CardInstanceId;
  isTapped: boolean;
  keywords: string[];
  name: string;
  ownerSeat: SeatId;
  slotId: string | null;
  statLine: MatchCardStatLine | null;
  visibility: MatchVisibility;
  zone: ZoneKind;
}

export interface MatchZoneView {
  cards: MatchCardView[];
  cardCount: number;
  ownerSeat: SeatId | null;
  visibility: MatchVisibility;
  zone: ZoneKind;
}

export interface MatchPromptChoiceView {
  choiceId: string;
  disabled: boolean;
  hint: string | null;
  label: string;
}

export const MATCH_PROMPT_KINDS = [
  "mulligan",
  "priority",
  "targets",
  "modes",
  "costs",
  "attackers",
  "blockers",
  "choice",
] as const;

export type MatchPromptKind = (typeof MATCH_PROMPT_KINDS)[number];

export interface MatchPromptView {
  choices: MatchPromptChoiceView[];
  expiresAt: number | null;
  kind: MatchPromptKind;
  maxSelections: number;
  message: string;
  minSelections: number;
  ownerSeat: SeatId;
  promptId: PromptId;
}

export interface MatchStackItemView {
  controllerSeat: SeatId;
  label: string;
  sourceInstanceId: CardInstanceId | null;
  stackId: StackObjectId;
  targetLabels: string[];
}

export interface MatchEventSummary {
  kind: MatchEventKind;
  label: string;
  seat: SeatId | null;
  sequence: number;
}

export interface MatchSeatView {
  availableIntents: GameplayIntentKind[];
  kind: "seat";
  match: MatchShell;
  prompt: MatchPromptView | null;
  recentEvents: MatchEventSummary[];
  seats: SeatStateView[];
  stack: MatchStackItemView[];
  viewerSeat: SeatId;
  zones: MatchZoneView[];
}

export interface MatchSpectatorView {
  availableIntents: [];
  kind: "spectator";
  match: MatchShell;
  prompt: null;
  recentEvents: MatchEventSummary[];
  seats: SeatStateView[];
  stack: MatchStackItemView[];
  zones: MatchZoneView[];
}

export type MatchView = MatchSeatView | MatchSpectatorView;
