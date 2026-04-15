import type { MatchState } from "@lunchtable/game-core";
import {
  AUTHORITATIVE_INTENT_KINDS,
  MATCH_ACTOR_TYPES,
  MATCH_BOARD_MODELS,
  MATCH_EVENT_KINDS,
  MATCH_PHASES,
  MATCH_PROMPT_KINDS,
  MATCH_RESOURCE_MODELS,
  MATCH_SEAT_STATUSES,
  MATCH_STATUSES,
  MATCH_TELEMETRY_EVENT_NAMES,
  MATCH_TIMING_MODELS,
  MATCH_TURN_MODELS,
  MATCH_VICTORY_MODELS,
  MATCH_VISIBILITIES,
  MATCH_ZONE_KINDS,
} from "@lunchtable/shared-types";
import type {
  GameplayIntentKind,
  MatchEvent,
  MatchEventKind,
  MatchSeatView,
  MatchShell,
  MatchSpectatorView,
  MatchTelemetryEventName,
  MatchVisibility,
  ReplayFrame,
  ZoneKind,
} from "@lunchtable/shared-types";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isArrayOf(
  value: unknown,
  guard: (item: unknown) => boolean,
): value is unknown[] {
  return Array.isArray(value) && value.every(guard);
}

function isRecordOf(
  value: unknown,
  guard: (item: unknown) => boolean,
): value is Record<string, unknown> {
  return isObject(value) && Object.values(value).every(guard);
}

function isOneOf<const TValue extends string>(
  value: unknown,
  candidates: readonly TValue[],
): value is TValue {
  return isString(value) && candidates.includes(value as TValue);
}

function isMatchPhase(value: unknown): value is MatchShell["phase"] {
  return isOneOf(value, MATCH_PHASES);
}

function isMatchStatus(value: unknown): value is MatchShell["status"] {
  return isOneOf(value, MATCH_STATUSES);
}

function isMatchActorType(
  value: unknown,
): value is MatchShell["seats"][number]["actorType"] {
  return isOneOf(value, MATCH_ACTOR_TYPES);
}

function isMatchSeatStatus(
  value: unknown,
): value is MatchShell["seats"][number]["status"] {
  return isOneOf(value, MATCH_SEAT_STATUSES);
}

function isMatchVisibility(value: unknown): value is MatchVisibility {
  return isOneOf(value, MATCH_VISIBILITIES);
}

function isZoneKind(value: unknown): value is ZoneKind {
  return isOneOf(value, MATCH_ZONE_KINDS);
}

function isGameplayIntentKind(value: unknown): value is GameplayIntentKind {
  return isOneOf(value, AUTHORITATIVE_INTENT_KINDS);
}

function isMatchPromptKind(
  value: unknown,
): value is NonNullable<MatchSeatView["prompt"]>["kind"] {
  return isOneOf(value, MATCH_PROMPT_KINDS);
}

function isMatchEventSummary(value: unknown) {
  return (
    isObject(value) &&
    isMatchEventKind(value.kind) &&
    isString(value.label) &&
    isNullableString(value.seat) &&
    isNumber(value.sequence)
  );
}

function isSeatResourceView(value: unknown) {
  return (
    isObject(value) &&
    isNumber(value.current) &&
    isString(value.label) &&
    isNullableNumber(value.maximum) &&
    isString(value.resourceId)
  );
}

function isSeatStateView(value: unknown) {
  return (
    isObject(value) &&
    isMatchActorType(value.actorType) &&
    isBoolean(value.autoPassEnabled) &&
    isNumber(value.deckCount) &&
    isNumber(value.graveyardCount) &&
    isNumber(value.handCount) &&
    isBoolean(value.hasPriority) &&
    isBoolean(value.isActiveTurn) &&
    isNumber(value.lifeTotal) &&
    isArrayOf(value.resources, isSeatResourceView) &&
    isString(value.seat) &&
    isMatchSeatStatus(value.status) &&
    isNullableString(value.username)
  );
}

function isMatchCardStatLine(value: unknown) {
  return (
    isObject(value) &&
    isNullableNumber(value.power) &&
    isNullableNumber(value.toughness)
  );
}

function isRecordOfNumbers(value: unknown): value is Record<string, number> {
  return isRecordOf(value, isNumber);
}

function isMatchCardView(value: unknown) {
  return (
    isObject(value) &&
    isStringArray(value.annotations) &&
    isString(value.cardId) &&
    isString(value.controllerSeat) &&
    isRecordOfNumbers(value.counters) &&
    isString(value.instanceId) &&
    isBoolean(value.isTapped) &&
    isStringArray(value.keywords) &&
    isString(value.name) &&
    isString(value.ownerSeat) &&
    isNullableString(value.slotId) &&
    (value.statLine === null || isMatchCardStatLine(value.statLine)) &&
    isMatchVisibility(value.visibility) &&
    isZoneKind(value.zone)
  );
}

function isMatchZoneView(value: unknown) {
  return (
    isObject(value) &&
    isArrayOf(value.cards, isMatchCardView) &&
    isNumber(value.cardCount) &&
    isNullableString(value.ownerSeat) &&
    isMatchVisibility(value.visibility) &&
    isZoneKind(value.zone)
  );
}

function isMatchStackItemView(value: unknown) {
  return (
    isObject(value) &&
    isString(value.controllerSeat) &&
    isString(value.label) &&
    isNullableString(value.sourceInstanceId) &&
    isString(value.stackId) &&
    isStringArray(value.targetLabels)
  );
}

function isMatchPromptChoiceView(value: unknown) {
  return (
    isObject(value) &&
    isString(value.choiceId) &&
    isBoolean(value.disabled) &&
    isNullableString(value.hint) &&
    isString(value.label)
  );
}

function isMatchPromptView(value: unknown) {
  return (
    isObject(value) &&
    isArrayOf(value.choices, isMatchPromptChoiceView) &&
    isNullableNumber(value.expiresAt) &&
    isMatchPromptKind(value.kind) &&
    isNumber(value.maxSelections) &&
    isString(value.message) &&
    isNumber(value.minSelections) &&
    isString(value.ownerSeat) &&
    isString(value.promptId)
  );
}

function isMatchDeckRulesSummary(value: unknown) {
  return (
    isObject(value) &&
    isNumber(value.maxCopies) &&
    isNumber(value.minCards) &&
    isNumber(value.sideboardSize)
  );
}

function isMatchFormatSummary(value: unknown) {
  return (
    isObject(value) &&
    isOneOf(value.boardModel, MATCH_BOARD_MODELS) &&
    isMatchDeckRulesSummary(value.deckRules) &&
    isString(value.id) &&
    isString(value.name) &&
    isOneOf(value.resourceModel, MATCH_RESOURCE_MODELS) &&
    isOneOf(value.timingModel, MATCH_TIMING_MODELS) &&
    isOneOf(value.turnModel, MATCH_TURN_MODELS) &&
    isString(value.version) &&
    isOneOf(value.victoryModel, MATCH_VICTORY_MODELS)
  );
}

function isMatchTimerSnapshot(value: unknown) {
  return (
    isObject(value) &&
    isNullableNumber(value.activeDeadlineAt) &&
    isNullableNumber(value.ropeDeadlineAt) &&
    isRecordOfNumbers(value.seatTimeRemainingMs) &&
    isNullableNumber(value.turnStartedAt)
  );
}

function isMatchSeatSummary(value: unknown) {
  return (
    isObject(value) &&
    isMatchActorType(value.actorType) &&
    isBoolean(value.connected) &&
    isNumber(value.deckCount) &&
    isNumber(value.graveyardCount) &&
    isNumber(value.handCount) &&
    isNumber(value.lifeTotal) &&
    isBoolean(value.ready) &&
    isNumber(value.resourceTotal) &&
    isString(value.seat) &&
    isMatchSeatStatus(value.status) &&
    isNullableString(value.userId) &&
    isNullableString(value.username) &&
    isNullableString(value.walletAddress)
  );
}

export function isMatchShell(value: unknown): value is MatchShell {
  return (
    isObject(value) &&
    isNullableString(value.activeSeat) &&
    isNullableNumber(value.completedAt) &&
    isNumber(value.createdAt) &&
    isMatchFormatSummary(value.format) &&
    isString(value.id) &&
    isNumber(value.lastEventNumber) &&
    isMatchPhase(value.phase) &&
    isNullableString(value.prioritySeat) &&
    isArrayOf(value.seats, isMatchSeatSummary) &&
    isNumber(value.spectatorCount) &&
    isNullableNumber(value.startedAt) &&
    isMatchStatus(value.status) &&
    isMatchTimerSnapshot(value.timers) &&
    isNumber(value.turnNumber) &&
    isNumber(value.version) &&
    isNullableString(value.winnerSeat)
  );
}

function isMatchCardCatalogEntry(value: unknown) {
  return (
    isObject(value) &&
    Array.isArray(value.abilities) &&
    isString(value.cardId) &&
    isNumber(value.cost) &&
    isString(value.kind) &&
    isStringArray(value.keywords) &&
    isString(value.name) &&
    (value.stats === undefined ||
      (isObject(value.stats) &&
        isNumber(value.stats.power) &&
        isNumber(value.stats.toughness)))
  );
}

function isMatchPromptState(value: unknown) {
  return (
    isObject(value) &&
    isStringArray(value.choiceIds) &&
    isNullableNumber(value.expiresAt) &&
    isMatchPromptKind(value.kind) &&
    isString(value.message) &&
    isString(value.ownerSeat) &&
    isString(value.promptId) &&
    isStringArray(value.resolvedChoiceIds) &&
    isOneOf(value.status, ["pending", "resolved"] as const)
  );
}

function isMatchRandomState(value: unknown) {
  return isObject(value) && isNumber(value.cursor) && isString(value.seed);
}

function isMatchSeatState(value: unknown) {
  return (
    isObject(value) &&
    isMatchActorType(value.actorType) &&
    isBoolean(value.autoPassEnabled) &&
    isStringArray(value.battlefield) &&
    isStringArray(value.command) &&
    isStringArray(value.deck) &&
    isStringArray(value.exile) &&
    isStringArray(value.graveyard) &&
    isStringArray(value.hand) &&
    isNumber(value.lifeTotal) &&
    isNumber(value.mulligansTaken) &&
    isStringArray(value.objective) &&
    isBoolean(value.ready) &&
    isArrayOf(value.resources, isSeatResourceView) &&
    isString(value.seat) &&
    isStringArray(value.sideboard) &&
    isMatchSeatStatus(value.status) &&
    isNullableString(value.userId) &&
    isNullableString(value.username) &&
    isMatchVisibility(value.visibility) &&
    isNullableString(value.walletAddress)
  );
}

function isMatchStackObjectState(value: unknown) {
  return (
    isObject(value) &&
    isNullableString(value.abilityId) &&
    isNullableString(value.cardId) &&
    isString(value.controllerSeat) &&
    (value.destinationZone === null ||
      isOneOf(value.destinationZone, ["battlefield", "graveyard"] as const)) &&
    Array.isArray(value.effects) &&
    isOneOf(value.kind, [
      "activatedAbility",
      "castCard",
      "triggeredAbility",
    ] as const) &&
    isString(value.label) &&
    (value.originZone === null ||
      isOneOf(value.originZone, ["battlefield", "hand"] as const)) &&
    isNullableString(value.sourceInstanceId) &&
    isString(value.stackId) &&
    isOneOf(value.status, [
      "countered",
      "fizzled",
      "pending",
      "resolved",
    ] as const) &&
    isStringArray(value.targetIds)
  );
}

export function isMatchState(value: unknown): value is MatchState {
  return (
    isObject(value) &&
    isRecordOf(value.cardCatalog, isMatchCardCatalogEntry) &&
    isNumber(value.eventSequence) &&
    isNullableString(value.lastPriorityPassSeat) &&
    isArrayOf(value.prompts, isMatchPromptState) &&
    isMatchRandomState(value.random) &&
    isRecordOf(value.seats, isMatchSeatState) &&
    isMatchShell(value.shell) &&
    isArrayOf(value.stack, isMatchStackObjectState)
  );
}

export function isMatchEventKind(value: unknown): value is MatchEventKind {
  return isOneOf(value, MATCH_EVENT_KINDS);
}

export function isMatchEvent(value: unknown): value is MatchEvent {
  return (
    isObject(value) &&
    isNumber(value.at) &&
    isString(value.eventId) &&
    isMatchEventKind(value.kind) &&
    isString(value.matchId) &&
    isObject(value.payload) &&
    isNumber(value.sequence) &&
    isNumber(value.stateVersion)
  );
}

export function isMatchSeatView(value: unknown): value is MatchSeatView {
  return (
    isObject(value) &&
    isArrayOf(value.availableIntents, isGameplayIntentKind) &&
    value.kind === "seat" &&
    isMatchShell(value.match) &&
    (value.prompt === null || isMatchPromptView(value.prompt)) &&
    isArrayOf(value.recentEvents, isMatchEventSummary) &&
    isArrayOf(value.seats, isSeatStateView) &&
    isArrayOf(value.stack, isMatchStackItemView) &&
    isString(value.viewerSeat) &&
    isArrayOf(value.zones, isMatchZoneView)
  );
}

export function isMatchSpectatorView(
  value: unknown,
): value is MatchSpectatorView {
  return (
    isObject(value) &&
    Array.isArray(value.availableIntents) &&
    value.availableIntents.length === 0 &&
    value.kind === "spectator" &&
    isMatchShell(value.match) &&
    value.prompt === null &&
    isArrayOf(value.recentEvents, isMatchEventSummary) &&
    isArrayOf(value.seats, isSeatStateView) &&
    isArrayOf(value.stack, isMatchStackItemView) &&
    isArrayOf(value.zones, isMatchZoneView)
  );
}

export function isReplayFrame(value: unknown): value is ReplayFrame {
  return (
    isObject(value) &&
    (value.eventKind === "matchSnapshot" ||
      isMatchEventKind(value.eventKind)) &&
    isNumber(value.eventSequence) &&
    isNumber(value.frameIndex) &&
    isString(value.label) &&
    isNumber(value.recordedAt) &&
    isMatchSpectatorView(value.view)
  );
}

export function isMatchTelemetryEventName(
  value: unknown,
): value is MatchTelemetryEventName {
  return isOneOf(value, MATCH_TELEMETRY_EVENT_NAMES);
}

export function parseJsonWithGuard<T>(
  json: string,
  guard: (value: unknown) => value is T,
  label: string,
): T {
  const parsed: unknown = JSON.parse(json);
  if (!guard(parsed)) {
    throw new Error(`Invalid ${label} JSON payload`);
  }
  return parsed;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return isObject(value);
}
