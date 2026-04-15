import type {
  ConditionNode,
  ContinuousEffectNode,
  CostSpec,
  EffectNode,
  EventPattern,
  MatchCardCatalogEntry,
  MatchState,
  ReplacementNode,
  TargetSpec,
  TriggerSpec,
} from "@lunchtable/game-core";
import type {
  MatchEvent,
  MatchPromptView,
  MatchSeatView,
  MatchShell,
  MatchSpectatorView,
  ReplayFrame,
} from "@lunchtable/shared-types";
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
  MATCH_TIMING_MODELS,
  MATCH_TURN_MODELS,
  MATCH_VICTORY_MODELS,
  MATCH_VISIBILITIES,
  MATCH_ZONE_KINDS,
} from "@lunchtable/shared-types";

type JsonObject = Record<string, unknown>;
type StatModifierShape = {
  power?: number;
  toughness?: number;
};

const CARD_KINDS = ["unit", "spell", "relic"] as const;
const ABILITY_KINDS = [
  "activated",
  "replacement",
  "static",
  "triggered",
] as const;
const ABILITY_SPEEDS = ["fast", "slow"] as const;
const CONDITION_KINDS = [
  "controllerHasResource",
  "sourceHasKeyword",
  "turnPhaseIs",
] as const;
const CONDITION_PHASES = [
  "attack",
  "block",
  "cleanup",
  "draw",
  "end",
  "main1",
  "main2",
  "mulligan",
  "ready",
  "upkeep",
] as const;
const CONTINUOUS_EFFECT_KINDS = [
  "grantPermission",
  "modifyStats",
  "grantKeyword",
] as const;
const CONTINUOUS_EFFECT_PERMISSIONS = [
  "canAttackOnEntry",
  "canBlockFlying",
  "canCastAtFastSpeed",
  "ignoreSummoningSickness",
] as const;
const CONTINUOUS_EFFECT_TARGETS = ["self", "friendlyUnits"] as const;
const CONTINUOUS_LAYERS = [
  "control",
  "cardType",
  "rulesText",
  "baseStats",
  "statModifiers",
  "permissions",
] as const;
const COST_KINDS = ["resource", "tapSource", "discardCard"] as const;
const EFFECT_DURATIONS = ["endOfTurn", "permanent"] as const;
const EFFECT_KINDS = [
  "moveCard",
  "drawCards",
  "discardCards",
  "revealCards",
  "shuffleZone",
  "createToken",
  "adjustResource",
  "dealDamage",
  "heal",
  "destroy",
  "banish",
  "modifyStats",
  "grantKeyword",
  "removeKeyword",
  "changeControl",
  "copyStackObject",
  "counterStackObject",
  "searchZone",
  "attach",
  "detach",
  "createDelayedTrigger",
  "createReplacementEffect",
  "createChoicePrompt",
  "randomSelection",
  "drawFromMulligan",
  "setAutoPass",
] as const;
const EVENT_PATTERN_EVENTS = [
  "selfWouldBeDestroyed",
  "sourceWouldTakeDamage",
  "sourceWouldBeTargeted",
] as const;
const EVENT_PATTERN_LIMITS = ["firstEachTurn"] as const;
const PROMPT_STATUSES = ["pending", "resolved"] as const;
const REPLACEMENT_KINDS = [
  "preventDamage",
  "moveInstead",
  "imposeTargetingTax",
] as const;
const STACK_OBJECT_KINDS = [
  "activatedAbility",
  "castCard",
  "triggeredAbility",
] as const;
const STACK_OBJECT_STATUSES = [
  "countered",
  "fizzled",
  "pending",
  "resolved",
] as const;
const STACK_DESTINATION_ZONES = ["battlefield", "graveyard"] as const;
const STACK_ORIGIN_ZONES = ["battlefield", "hand"] as const;
const STACK_RESOLUTIONS = ["resolved", "countered", "fizzled"] as const;
const CONCEDE_REASONS = ["manual", "disconnect", "timeout"] as const;
const MATCH_COMPLETION_REASONS = [
  "administrative",
  "concession",
  "draw",
  "elimination",
  "objective",
] as const;
const REPLAY_EVENT_KINDS = ["matchSnapshot", ...MATCH_EVENT_KINDS] as const;
const TARGET_SELECTORS = [
  "anyCard",
  "friendlyUnit",
  "opposingUnit",
  "player",
  "self",
  "stackObject",
] as const;
const TRIGGER_EVENTS = [
  "selfEntersBattlefield",
  "selfLeavesBattlefield",
  "turnStarts",
] as const;
const TRIGGER_SEAT_SCOPES = ["controller", "opponent"] as const;

export function parseMatchShellJson(shellJson: string): MatchShell {
  return validateMatchShell(
    parseJsonValue(shellJson, "match shell"),
    "match shell",
  );
}

export function parseMatchStateJson(snapshotJson: string): MatchState {
  return validateMatchState(
    parseJsonValue(snapshotJson, "match state"),
    "match state",
  );
}

export function parseMatchEventJson(eventJson: string): MatchEvent {
  return validateMatchEvent(
    parseJsonValue(eventJson, "match event"),
    "match event",
  );
}

export function parseMatchSeatViewJson(viewJson: string): MatchSeatView {
  return validateMatchSeatView(
    parseJsonValue(viewJson, "seat view"),
    "seat view",
  );
}

export function parseMatchSpectatorViewJson(
  viewJson: string,
): MatchSpectatorView {
  return validateMatchSpectatorView(
    parseJsonValue(viewJson, "spectator view"),
    "spectator view",
  );
}

export function parseReplayFramesJson(framesJson: string): ReplayFrame[] {
  return readArray(
    parseJsonValue(framesJson, "replay frames"),
    "replay frames",
    validateReplayFrame,
  );
}

function validateMatchShell(value: unknown, label: string): MatchShell {
  const object = readObject(value, label);

  return {
    activeSeat: readNullableString(object.activeSeat, `${label}.activeSeat`),
    completedAt: readNullableNumber(object.completedAt, `${label}.completedAt`),
    createdAt: readNumber(object.createdAt, `${label}.createdAt`),
    format: validateMatchFormatSummary(object.format, `${label}.format`),
    id: readString(object.id, `${label}.id`),
    lastEventNumber: readNumber(
      object.lastEventNumber,
      `${label}.lastEventNumber`,
    ),
    phase: readEnum(object.phase, MATCH_PHASES, `${label}.phase`),
    prioritySeat: readNullableString(
      object.prioritySeat,
      `${label}.prioritySeat`,
    ),
    seats: readArray(object.seats, `${label}.seats`, validateMatchSeatSummary),
    spectatorCount: readNumber(
      object.spectatorCount,
      `${label}.spectatorCount`,
    ),
    startedAt: readNullableNumber(object.startedAt, `${label}.startedAt`),
    status: readEnum(object.status, MATCH_STATUSES, `${label}.status`),
    timers: validateMatchTimerSnapshot(object.timers, `${label}.timers`),
    turnNumber: readNumber(object.turnNumber, `${label}.turnNumber`),
    version: readNumber(object.version, `${label}.version`),
    winnerSeat: readNullableString(object.winnerSeat, `${label}.winnerSeat`),
  };
}

function validateMatchState(value: unknown, label: string): MatchState {
  const object = readObject(value, label);

  return {
    cardCatalog: readRecord(
      object.cardCatalog,
      `${label}.cardCatalog`,
      validateMatchCardCatalogEntry,
    ),
    eventSequence: readNumber(object.eventSequence, `${label}.eventSequence`),
    lastPriorityPassSeat: readNullableString(
      object.lastPriorityPassSeat,
      `${label}.lastPriorityPassSeat`,
    ),
    prompts: readArray(
      object.prompts,
      `${label}.prompts`,
      validateMatchPromptState,
    ),
    random: validateMatchRandomState(object.random, `${label}.random`),
    seats: readRecord(object.seats, `${label}.seats`, validateMatchSeatState),
    shell: validateMatchShell(object.shell, `${label}.shell`),
    stack: readArray(
      object.stack,
      `${label}.stack`,
      validateMatchStackObjectState,
    ),
  };
}

function validateMatchEvent(value: unknown, label: string): MatchEvent {
  const object = readObject(value, label);
  const kind = readEnum(object.kind, MATCH_EVENT_KINDS, `${label}.kind`);

  return {
    at: readNumber(object.at, `${label}.at`),
    eventId: readString(object.eventId, `${label}.eventId`),
    kind,
    matchId: readString(object.matchId, `${label}.matchId`),
    payload: validateMatchEventPayload(
      kind,
      object.payload,
      `${label}.payload`,
    ),
    sequence: readNumber(object.sequence, `${label}.sequence`),
    stateVersion: readNumber(object.stateVersion, `${label}.stateVersion`),
  } as MatchEvent;
}

function validateMatchSeatView(value: unknown, label: string): MatchSeatView {
  const object = readObject(value, label);

  if (readString(object.kind, `${label}.kind`) !== "seat") {
    throw new Error(`Invalid ${label}.kind: expected "seat".`);
  }

  return {
    availableIntents: readArray(
      object.availableIntents,
      `${label}.availableIntents`,
      (entry, entryLabel) =>
        readEnum(entry, AUTHORITATIVE_INTENT_KINDS, entryLabel),
    ),
    kind: "seat",
    match: validateMatchShell(object.match, `${label}.match`),
    prompt: readNullable(
      object.prompt,
      `${label}.prompt`,
      validateMatchPromptView,
    ),
    recentEvents: readArray(
      object.recentEvents,
      `${label}.recentEvents`,
      validateMatchEventSummary,
    ),
    seats: readArray(object.seats, `${label}.seats`, validateSeatStateView),
    stack: readArray(
      object.stack,
      `${label}.stack`,
      validateMatchStackItemView,
    ),
    viewerSeat: readString(object.viewerSeat, `${label}.viewerSeat`),
    zones: readArray(object.zones, `${label}.zones`, validateMatchZoneView),
  };
}

function validateMatchSpectatorView(
  value: unknown,
  label: string,
): MatchSpectatorView {
  const object = readObject(value, label);

  if (readString(object.kind, `${label}.kind`) !== "spectator") {
    throw new Error(`Invalid ${label}.kind: expected "spectator".`);
  }

  const availableIntents = readArray(
    object.availableIntents,
    `${label}.availableIntents`,
    (entry, entryLabel) =>
      readEnum(entry, AUTHORITATIVE_INTENT_KINDS, entryLabel),
  );
  if (availableIntents.length > 0) {
    throw new Error(
      `Invalid ${label}.availableIntents: expected an empty array.`,
    );
  }
  if (object.prompt !== null) {
    throw new Error(`Invalid ${label}.prompt: expected null.`);
  }

  return {
    availableIntents: [],
    kind: "spectator",
    match: validateMatchShell(object.match, `${label}.match`),
    prompt: null,
    recentEvents: readArray(
      object.recentEvents,
      `${label}.recentEvents`,
      validateMatchEventSummary,
    ),
    seats: readArray(object.seats, `${label}.seats`, validateSeatStateView),
    stack: readArray(
      object.stack,
      `${label}.stack`,
      validateMatchStackItemView,
    ),
    zones: readArray(object.zones, `${label}.zones`, validateMatchZoneView),
  };
}

function validateReplayFrame(value: unknown, label: string): ReplayFrame {
  const object = readObject(value, label);

  return {
    eventKind: readEnum(
      object.eventKind,
      REPLAY_EVENT_KINDS,
      `${label}.eventKind`,
    ),
    eventSequence: readNumber(object.eventSequence, `${label}.eventSequence`),
    frameIndex: readNumber(object.frameIndex, `${label}.frameIndex`),
    label: readString(object.label, `${label}.label`),
    recordedAt: readNumber(object.recordedAt, `${label}.recordedAt`),
    view: validateMatchSpectatorView(object.view, `${label}.view`),
  };
}

function validateMatchEventPayload(
  kind: MatchEvent["kind"],
  value: unknown,
  label: string,
): MatchEvent["payload"] {
  const object = readObject(value, label);

  switch (kind) {
    case "matchCreated":
      return {
        shell: validateMatchShell(object.shell, `${label}.shell`),
      };
    case "openingHandKept":
      return {
        seat: readString(object.seat, `${label}.seat`),
      };
    case "mulliganTaken":
      return {
        handSize: readNumber(object.handSize, `${label}.handSize`),
        seat: readString(object.seat, `${label}.seat`),
      };
    case "cardsDrawn":
      return {
        count: readNumber(object.count, `${label}.count`),
        seat: readString(object.seat, `${label}.seat`),
      };
    case "cardPlayed":
      return {
        cardInstanceId: readString(
          object.cardInstanceId,
          `${label}.cardInstanceId`,
        ),
        seat: readString(object.seat, `${label}.seat`),
        toZone: readEnum(object.toZone, MATCH_ZONE_KINDS, `${label}.toZone`),
      };
    case "abilityActivated":
      return {
        abilityId: readString(object.abilityId, `${label}.abilityId`),
        seat: readString(object.seat, `${label}.seat`),
        sourceInstanceId: readString(
          object.sourceInstanceId,
          `${label}.sourceInstanceId`,
        ),
      };
    case "attackersDeclared":
      return {
        attackers: readArray(
          object.attackers,
          `${label}.attackers`,
          (entry, entryLabel) => {
            const attacker = readObject(entry, entryLabel);
            return {
              attackerId: readString(
                attacker.attackerId,
                `${entryLabel}.attackerId`,
              ),
              defenderSeat: readString(
                attacker.defenderSeat,
                `${entryLabel}.defenderSeat`,
              ),
              laneId: readNullableString(
                attacker.laneId,
                `${entryLabel}.laneId`,
              ),
            };
          },
        ),
        seat: readString(object.seat, `${label}.seat`),
      };
    case "blockersDeclared":
      return {
        blocks: readArray(
          object.blocks,
          `${label}.blocks`,
          (entry, entryLabel) => {
            const block = readObject(entry, entryLabel);
            return {
              attackerId: readString(
                block.attackerId,
                `${entryLabel}.attackerId`,
              ),
              blockerId: readString(block.blockerId, `${entryLabel}.blockerId`),
            };
          },
        ),
        seat: readString(object.seat, `${label}.seat`),
      };
    case "combatDamageAssigned":
      return {
        assignments: readArray(
          object.assignments,
          `${label}.assignments`,
          (entry, entryLabel) => {
            const assignment = readObject(entry, entryLabel);
            return {
              amount: readNumber(assignment.amount, `${entryLabel}.amount`),
              sourceId: readString(
                assignment.sourceId,
                `${entryLabel}.sourceId`,
              ),
              targetId: readString(
                assignment.targetId,
                `${entryLabel}.targetId`,
              ),
            };
          },
        ),
      };
    case "promptOpened":
      return {
        prompt: validateMatchPromptView(object.prompt, `${label}.prompt`),
      };
    case "promptResolved":
      return {
        choiceIds: readStringArray(object.choiceIds, `${label}.choiceIds`),
        promptId: readString(object.promptId, `${label}.promptId`),
        seat: readString(object.seat, `${label}.seat`),
      };
    case "priorityPassed":
      return {
        seat: readString(object.seat, `${label}.seat`),
      };
    case "phaseAdvanced":
      return {
        from: readEnum(object.from, MATCH_PHASES, `${label}.from`),
        to: readEnum(object.to, MATCH_PHASES, `${label}.to`),
      };
    case "turnAdvanced":
      return {
        activeSeat: readString(object.activeSeat, `${label}.activeSeat`),
        turnNumber: readNumber(object.turnNumber, `${label}.turnNumber`),
      };
    case "stackObjectCreated":
      return {
        controllerSeat: readString(
          object.controllerSeat,
          `${label}.controllerSeat`,
        ),
        label: readString(object.label, `${label}.label`),
        stackId: readString(object.stackId, `${label}.stackId`),
      };
    case "stackObjectResolved":
      return {
        resolution: readEnum(
          object.resolution,
          STACK_RESOLUTIONS,
          `${label}.resolution`,
        ),
        stackId: readString(object.stackId, `${label}.stackId`),
      };
    case "cardMoved":
      return {
        cardInstanceId: readString(
          object.cardInstanceId,
          `${label}.cardInstanceId`,
        ),
        fromZone: readEnum(
          object.fromZone,
          MATCH_ZONE_KINDS,
          `${label}.fromZone`,
        ),
        publicReason: readString(object.publicReason, `${label}.publicReason`),
        toZone: readEnum(object.toZone, MATCH_ZONE_KINDS, `${label}.toZone`),
      };
    case "lifeTotalChanged":
      return {
        from: readNumber(object.from, `${label}.from`),
        reason: readString(object.reason, `${label}.reason`),
        seat: readString(object.seat, `${label}.seat`),
        to: readNumber(object.to, `${label}.to`),
      };
    case "autoPassToggled":
      return {
        enabled: readBoolean(object.enabled, `${label}.enabled`),
        seat: readString(object.seat, `${label}.seat`),
      };
    case "playerConceded":
      return {
        reason: readEnum(object.reason, CONCEDE_REASONS, `${label}.reason`),
        seat: readString(object.seat, `${label}.seat`),
      };
    case "matchCompleted":
      return {
        reason: readEnum(
          object.reason,
          MATCH_COMPLETION_REASONS,
          `${label}.reason`,
        ),
        winnerSeat: readNullableString(
          object.winnerSeat,
          `${label}.winnerSeat`,
        ),
      };
  }
}

function validateMatchFormatSummary(
  value: unknown,
  label: string,
): MatchShell["format"] {
  const object = readObject(value, label);
  const deckRules = readObject(object.deckRules, `${label}.deckRules`);

  return {
    boardModel: readEnum(
      object.boardModel,
      MATCH_BOARD_MODELS,
      `${label}.boardModel`,
    ),
    deckRules: {
      maxCopies: readNumber(
        deckRules.maxCopies,
        `${label}.deckRules.maxCopies`,
      ),
      minCards: readNumber(deckRules.minCards, `${label}.deckRules.minCards`),
      sideboardSize: readNumber(
        deckRules.sideboardSize,
        `${label}.deckRules.sideboardSize`,
      ),
    },
    id: readString(object.id, `${label}.id`),
    name: readString(object.name, `${label}.name`),
    resourceModel: readEnum(
      object.resourceModel,
      MATCH_RESOURCE_MODELS,
      `${label}.resourceModel`,
    ),
    timingModel: readEnum(
      object.timingModel,
      MATCH_TIMING_MODELS,
      `${label}.timingModel`,
    ),
    turnModel: readEnum(
      object.turnModel,
      MATCH_TURN_MODELS,
      `${label}.turnModel`,
    ),
    version: readString(object.version, `${label}.version`),
    victoryModel: readEnum(
      object.victoryModel,
      MATCH_VICTORY_MODELS,
      `${label}.victoryModel`,
    ),
  };
}

function validateMatchTimerSnapshot(
  value: unknown,
  label: string,
): MatchShell["timers"] {
  const object = readObject(value, label);

  return {
    activeDeadlineAt: readNullableNumber(
      object.activeDeadlineAt,
      `${label}.activeDeadlineAt`,
    ),
    ropeDeadlineAt: readNullableNumber(
      object.ropeDeadlineAt,
      `${label}.ropeDeadlineAt`,
    ),
    seatTimeRemainingMs: readNumberRecord(
      object.seatTimeRemainingMs,
      `${label}.seatTimeRemainingMs`,
    ),
    turnStartedAt: readNullableNumber(
      object.turnStartedAt,
      `${label}.turnStartedAt`,
    ),
  };
}

function validateMatchSeatSummary(
  value: unknown,
  label: string,
): MatchShell["seats"][number] {
  const object = readObject(value, label);

  return {
    actorType: readEnum(
      object.actorType,
      MATCH_ACTOR_TYPES,
      `${label}.actorType`,
    ),
    connected: readBoolean(object.connected, `${label}.connected`),
    deckCount: readNumber(object.deckCount, `${label}.deckCount`),
    graveyardCount: readNumber(
      object.graveyardCount,
      `${label}.graveyardCount`,
    ),
    handCount: readNumber(object.handCount, `${label}.handCount`),
    lifeTotal: readNumber(object.lifeTotal, `${label}.lifeTotal`),
    ready: readBoolean(object.ready, `${label}.ready`),
    resourceTotal: readNumber(object.resourceTotal, `${label}.resourceTotal`),
    seat: readString(object.seat, `${label}.seat`),
    status: readEnum(object.status, MATCH_SEAT_STATUSES, `${label}.status`),
    userId: readNullableString(
      object.userId,
      `${label}.userId`,
    ) as MatchShell["seats"][number]["userId"],
    username: readNullableString(object.username, `${label}.username`),
    walletAddress: readNullableString(
      object.walletAddress,
      `${label}.walletAddress`,
    ),
  };
}

function validateMatchPromptView(
  value: unknown,
  label: string,
): MatchPromptView {
  const object = readObject(value, label);

  return {
    choices: readArray(
      object.choices,
      `${label}.choices`,
      validateMatchPromptChoiceView,
    ),
    expiresAt: readNullableNumber(object.expiresAt, `${label}.expiresAt`),
    kind: readEnum(object.kind, MATCH_PROMPT_KINDS, `${label}.kind`),
    maxSelections: readNumber(object.maxSelections, `${label}.maxSelections`),
    message: readString(object.message, `${label}.message`),
    minSelections: readNumber(object.minSelections, `${label}.minSelections`),
    ownerSeat: readString(object.ownerSeat, `${label}.ownerSeat`),
    promptId: readString(object.promptId, `${label}.promptId`),
  };
}

function validateMatchPromptChoiceView(
  value: unknown,
  label: string,
): MatchPromptView["choices"][number] {
  const object = readObject(value, label);

  return {
    choiceId: readString(object.choiceId, `${label}.choiceId`),
    disabled: readBoolean(object.disabled, `${label}.disabled`),
    hint: readNullableString(object.hint, `${label}.hint`),
    label: readString(object.label, `${label}.label`),
  };
}

function validateMatchEventSummary(
  value: unknown,
  label: string,
): MatchSeatView["recentEvents"][number] {
  const object = readObject(value, label);

  return {
    kind: readEnum(object.kind, MATCH_EVENT_KINDS, `${label}.kind`),
    label: readString(object.label, `${label}.label`),
    seat: readNullableString(object.seat, `${label}.seat`),
    sequence: readNumber(object.sequence, `${label}.sequence`),
  };
}

function validateSeatStateView(
  value: unknown,
  label: string,
): MatchSeatView["seats"][number] {
  const object = readObject(value, label);

  return {
    actorType: readEnum(
      object.actorType,
      MATCH_ACTOR_TYPES,
      `${label}.actorType`,
    ),
    autoPassEnabled: readBoolean(
      object.autoPassEnabled,
      `${label}.autoPassEnabled`,
    ),
    deckCount: readNumber(object.deckCount, `${label}.deckCount`),
    graveyardCount: readNumber(
      object.graveyardCount,
      `${label}.graveyardCount`,
    ),
    handCount: readNumber(object.handCount, `${label}.handCount`),
    hasPriority: readBoolean(object.hasPriority, `${label}.hasPriority`),
    isActiveTurn: readBoolean(object.isActiveTurn, `${label}.isActiveTurn`),
    lifeTotal: readNumber(object.lifeTotal, `${label}.lifeTotal`),
    resources: readArray(
      object.resources,
      `${label}.resources`,
      validateSeatResourceView,
    ),
    seat: readString(object.seat, `${label}.seat`),
    status: readEnum(object.status, MATCH_SEAT_STATUSES, `${label}.status`),
    username: readNullableString(object.username, `${label}.username`),
  };
}

function validateSeatResourceView(
  value: unknown,
  label: string,
): MatchSeatView["seats"][number]["resources"][number] {
  const object = readObject(value, label);

  return {
    current: readNumber(object.current, `${label}.current`),
    label: readString(object.label, `${label}.label`),
    maximum: readNullableNumber(object.maximum, `${label}.maximum`),
    resourceId: readString(object.resourceId, `${label}.resourceId`),
  };
}

function validateMatchStackItemView(
  value: unknown,
  label: string,
): MatchSeatView["stack"][number] {
  const object = readObject(value, label);

  return {
    controllerSeat: readString(
      object.controllerSeat,
      `${label}.controllerSeat`,
    ),
    label: readString(object.label, `${label}.label`),
    sourceInstanceId: readNullableString(
      object.sourceInstanceId,
      `${label}.sourceInstanceId`,
    ),
    stackId: readString(object.stackId, `${label}.stackId`),
    targetLabels: readStringArray(object.targetLabels, `${label}.targetLabels`),
  };
}

function validateMatchZoneView(
  value: unknown,
  label: string,
): MatchSeatView["zones"][number] {
  const object = readObject(value, label);

  return {
    cards: readArray(object.cards, `${label}.cards`, validateMatchCardView),
    cardCount: readNumber(object.cardCount, `${label}.cardCount`),
    ownerSeat: readNullableString(object.ownerSeat, `${label}.ownerSeat`),
    visibility: readEnum(
      object.visibility,
      MATCH_VISIBILITIES,
      `${label}.visibility`,
    ),
    zone: readEnum(object.zone, MATCH_ZONE_KINDS, `${label}.zone`),
  };
}

function validateMatchCardView(
  value: unknown,
  label: string,
): MatchSeatView["zones"][number]["cards"][number] {
  const object = readObject(value, label);

  return {
    annotations: readStringArray(object.annotations, `${label}.annotations`),
    cardId: readString(object.cardId, `${label}.cardId`),
    controllerSeat: readString(
      object.controllerSeat,
      `${label}.controllerSeat`,
    ),
    counters: readNumberRecord(object.counters, `${label}.counters`),
    instanceId: readString(object.instanceId, `${label}.instanceId`),
    isTapped: readBoolean(object.isTapped, `${label}.isTapped`),
    keywords: readStringArray(object.keywords, `${label}.keywords`),
    name: readString(object.name, `${label}.name`),
    ownerSeat: readString(object.ownerSeat, `${label}.ownerSeat`),
    slotId: readNullableString(object.slotId, `${label}.slotId`),
    statLine: readNullable(
      object.statLine,
      `${label}.statLine`,
      validateMatchCardStatLine,
    ),
    visibility: readEnum(
      object.visibility,
      MATCH_VISIBILITIES,
      `${label}.visibility`,
    ),
    zone: readEnum(object.zone, MATCH_ZONE_KINDS, `${label}.zone`),
  };
}

function validateMatchCardStatLine(
  value: unknown,
  label: string,
): MatchSeatView["zones"][number]["cards"][number]["statLine"] {
  const object = readObject(value, label);

  return {
    power: readNullableNumber(object.power, `${label}.power`),
    toughness: readNullableNumber(object.toughness, `${label}.toughness`),
  };
}

function validateMatchCardCatalogEntry(
  value: unknown,
  label: string,
): MatchCardCatalogEntry {
  const object = readObject(value, label);

  return {
    abilities: readArray(
      object.abilities,
      `${label}.abilities`,
      validateCardAbility,
    ),
    cardId: readString(object.cardId, `${label}.cardId`),
    cost: readNumber(object.cost, `${label}.cost`),
    kind: readEnum(object.kind, CARD_KINDS, `${label}.kind`),
    keywords: readStringArray(object.keywords, `${label}.keywords`),
    name: readString(object.name, `${label}.name`),
    stats: readOptional(object.stats, `${label}.stats`, (entry, entryLabel) => {
      const stats = readObject(entry, entryLabel);
      return {
        power: readNumber(stats.power, `${entryLabel}.power`),
        toughness: readNumber(stats.toughness, `${entryLabel}.toughness`),
      };
    }),
  };
}

function validateCardAbility(
  value: unknown,
  label: string,
): MatchCardCatalogEntry["abilities"][number] {
  const object = readObject(value, label);
  const kind = readEnum(object.kind, ABILITY_KINDS, `${label}.kind`);
  const id = readString(object.id, `${label}.id`);
  const text = readString(object.text, `${label}.text`);

  switch (kind) {
    case "activated":
      return {
        costs: readArray(object.costs, `${label}.costs`, validateCostSpec),
        effect: readArray(object.effect, `${label}.effect`, validateEffectNode),
        id,
        kind,
        speed: readEnum(object.speed, ABILITY_SPEEDS, `${label}.speed`),
        targets: readOptional(
          object.targets,
          `${label}.targets`,
          (entry, entryLabel) =>
            readArray(entry, entryLabel, validateTargetSpec),
        ),
        text,
      };
    case "triggered":
      return {
        condition: readOptional(
          object.condition,
          `${label}.condition`,
          validateConditionNode,
        ),
        effect: readArray(object.effect, `${label}.effect`, validateEffectNode),
        id,
        kind,
        text,
        trigger: validateTriggerSpec(object.trigger, `${label}.trigger`),
      };
    case "static":
      return {
        effect: validateContinuousEffectNode(object.effect, `${label}.effect`),
        id,
        kind,
        layer: readEnum(object.layer, CONTINUOUS_LAYERS, `${label}.layer`),
        text,
      };
    case "replacement":
      return {
        id,
        kind,
        replace: validateReplacementNode(object.replace, `${label}.replace`),
        text,
        watches: validateEventPattern(object.watches, `${label}.watches`),
      };
  }
}

function validateMatchPromptState(
  value: unknown,
  label: string,
): MatchState["prompts"][number] {
  const object = readObject(value, label);

  return {
    choiceIds: readStringArray(object.choiceIds, `${label}.choiceIds`),
    expiresAt: readNullableNumber(object.expiresAt, `${label}.expiresAt`),
    kind: readEnum(object.kind, MATCH_PROMPT_KINDS, `${label}.kind`),
    message: readString(object.message, `${label}.message`),
    ownerSeat: readString(object.ownerSeat, `${label}.ownerSeat`),
    promptId: readString(object.promptId, `${label}.promptId`),
    resolvedChoiceIds: readStringArray(
      object.resolvedChoiceIds,
      `${label}.resolvedChoiceIds`,
    ),
    status: readEnum(object.status, PROMPT_STATUSES, `${label}.status`),
  };
}

function validateMatchRandomState(
  value: unknown,
  label: string,
): MatchState["random"] {
  const object = readObject(value, label);

  return {
    cursor: readNumber(object.cursor, `${label}.cursor`),
    seed: readString(object.seed, `${label}.seed`),
  };
}

function validateMatchSeatState(
  value: unknown,
  label: string,
): MatchState["seats"][string] {
  const object = readObject(value, label);

  return {
    actorType: readEnum(
      object.actorType,
      MATCH_ACTOR_TYPES,
      `${label}.actorType`,
    ),
    autoPassEnabled: readBoolean(
      object.autoPassEnabled,
      `${label}.autoPassEnabled`,
    ),
    battlefield: readStringArray(object.battlefield, `${label}.battlefield`),
    command: readStringArray(object.command, `${label}.command`),
    deck: readStringArray(object.deck, `${label}.deck`),
    exile: readStringArray(object.exile, `${label}.exile`),
    graveyard: readStringArray(object.graveyard, `${label}.graveyard`),
    hand: readStringArray(object.hand, `${label}.hand`),
    lifeTotal: readNumber(object.lifeTotal, `${label}.lifeTotal`),
    mulligansTaken: readNumber(
      object.mulligansTaken,
      `${label}.mulligansTaken`,
    ),
    objective: readStringArray(object.objective, `${label}.objective`),
    ready: readBoolean(object.ready, `${label}.ready`),
    resources: readArray(
      object.resources,
      `${label}.resources`,
      validateSeatResourceView,
    ),
    seat: readString(object.seat, `${label}.seat`),
    sideboard: readStringArray(object.sideboard, `${label}.sideboard`),
    status: readEnum(object.status, MATCH_SEAT_STATUSES, `${label}.status`),
    userId: readNullableString(
      object.userId,
      `${label}.userId`,
    ) as MatchState["seats"][string]["userId"],
    username: readNullableString(object.username, `${label}.username`),
    visibility: readEnum(
      object.visibility,
      MATCH_VISIBILITIES,
      `${label}.visibility`,
    ),
    walletAddress: readNullableString(
      object.walletAddress,
      `${label}.walletAddress`,
    ),
  };
}

function validateMatchStackObjectState(
  value: unknown,
  label: string,
): MatchState["stack"][number] {
  const object = readObject(value, label);

  return {
    abilityId: readNullableString(object.abilityId, `${label}.abilityId`),
    cardId: readNullableString(object.cardId, `${label}.cardId`),
    controllerSeat: readString(
      object.controllerSeat,
      `${label}.controllerSeat`,
    ),
    destinationZone: readNullableEnum(
      object.destinationZone,
      STACK_DESTINATION_ZONES,
      `${label}.destinationZone`,
    ),
    effects: readArray(
      object.effects,
      `${label}.effects`,
      validateEffectNode,
    ) as MatchState["stack"][number]["effects"],
    kind: readEnum(object.kind, STACK_OBJECT_KINDS, `${label}.kind`),
    label: readString(object.label, `${label}.label`),
    originZone: readNullableEnum(
      object.originZone,
      STACK_ORIGIN_ZONES,
      `${label}.originZone`,
    ),
    sourceInstanceId: readNullableString(
      object.sourceInstanceId,
      `${label}.sourceInstanceId`,
    ),
    stackId: readString(object.stackId, `${label}.stackId`),
    status: readEnum(object.status, STACK_OBJECT_STATUSES, `${label}.status`),
    targetIds: readStringArray(object.targetIds, `${label}.targetIds`),
  };
}

function validateCostSpec(value: unknown, label: string): CostSpec {
  const object = readObject(value, label);
  const kind = readEnum(object.kind, COST_KINDS, `${label}.kind`);

  switch (kind) {
    case "resource":
      return {
        amount: readNumber(object.amount, `${label}.amount`),
        kind,
        resourceId: readString(object.resourceId, `${label}.resourceId`),
      };
    case "tapSource":
      return {
        kind,
      };
    case "discardCard":
      return {
        amount: readNumber(object.amount, `${label}.amount`),
        kind,
        zone: readLiteral(object.zone, "hand", `${label}.zone`),
      };
  }
}

function validateTargetSpec(value: unknown, label: string): TargetSpec {
  const object = readObject(value, label);
  const count = readObject(object.count, `${label}.count`);

  return {
    count: {
      max: readNumber(count.max, `${label}.count.max`),
      min: readNumber(count.min, `${label}.count.min`),
    },
    selector: readEnum(object.selector, TARGET_SELECTORS, `${label}.selector`),
    zone: readOptional(object.zone, `${label}.zone`, readString),
  };
}

function validateConditionNode(value: unknown, label: string): ConditionNode {
  const object = readObject(value, label);
  const kind = readEnum(object.kind, CONDITION_KINDS, `${label}.kind`);

  switch (kind) {
    case "controllerHasResource":
      return {
        kind,
        minimum: readNumber(object.minimum, `${label}.minimum`),
        resourceId: readString(object.resourceId, `${label}.resourceId`),
      };
    case "sourceHasKeyword":
      return {
        kind,
        keywordId: readString(object.keywordId, `${label}.keywordId`),
      };
    case "turnPhaseIs":
      return {
        kind,
        phase: readEnum(object.phase, CONDITION_PHASES, `${label}.phase`),
      };
  }
}

function validateTriggerSpec(value: unknown, label: string): TriggerSpec {
  const object = readObject(value, label);
  const kind = readLiteral(object.kind, "event", `${label}.kind`);
  const event = readEnum(object.event, TRIGGER_EVENTS, `${label}.event`);

  switch (event) {
    case "selfEntersBattlefield":
    case "selfLeavesBattlefield":
      return {
        event,
        kind,
      };
    case "turnStarts":
      return {
        event,
        kind,
        seatScope: readEnum(
          object.seatScope,
          TRIGGER_SEAT_SCOPES,
          `${label}.seatScope`,
        ),
      };
  }
}

function validateEventPattern(value: unknown, label: string): EventPattern {
  const object = readObject(value, label);
  const kind = readLiteral(object.kind, "event", `${label}.kind`);
  const event = readEnum(object.event, EVENT_PATTERN_EVENTS, `${label}.event`);

  switch (event) {
    case "selfWouldBeDestroyed":
    case "sourceWouldBeTargeted":
      return {
        event,
        kind,
      };
    case "sourceWouldTakeDamage":
      return {
        event,
        kind,
        limit: readOptional(
          object.limit,
          `${label}.limit`,
          (entry, entryLabel) =>
            readEnum(entry, EVENT_PATTERN_LIMITS, entryLabel),
        ),
      };
  }
}

function validateEffectNode(value: unknown, label: string): EffectNode {
  const object = readObject(value, label);
  const kind = readEnum(object.kind, EFFECT_KINDS, `${label}.kind`);

  switch (kind) {
    case "drawCards":
      return {
        amount: readNumber(object.amount, `${label}.amount`),
        kind,
        target: readEnum(
          object.target,
          ["controller", "opponent", "target"] as const,
          `${label}.target`,
        ),
      };
    case "adjustResource":
      return {
        amount: readNumber(object.amount, `${label}.amount`),
        kind,
        resourceId: readString(object.resourceId, `${label}.resourceId`),
        target: readEnum(
          object.target,
          ["controller", "target"] as const,
          `${label}.target`,
        ),
      };
    case "dealDamage":
      return {
        amount: readNumber(object.amount, `${label}.amount`),
        kind,
        target: readEnum(
          object.target,
          ["opponent", "target"] as const,
          `${label}.target`,
        ),
      };
    case "modifyStats":
      return {
        kind,
        modifier: validateStatModifier(object.modifier, `${label}.modifier`),
        target: readEnum(
          object.target,
          ["self", "target"] as const,
          `${label}.target`,
        ),
        until: readOptional(
          object.until,
          `${label}.until`,
          (entry, entryLabel) => readEnum(entry, EFFECT_DURATIONS, entryLabel),
        ),
      };
    case "grantKeyword":
      return {
        keywordId: readString(object.keywordId, `${label}.keywordId`),
        kind,
        target: readEnum(
          object.target,
          ["self", "target"] as const,
          `${label}.target`,
        ),
        until: readOptional(
          object.until,
          `${label}.until`,
          (entry, entryLabel) => readEnum(entry, EFFECT_DURATIONS, entryLabel),
        ),
      };
    case "destroy":
      return {
        amount: readOptional(object.amount, `${label}.amount`, readNumber),
        kind,
        target: readEnum(
          object.target,
          ["self", "target"] as const,
          `${label}.target`,
        ),
      };
    case "moveCard":
      return {
        destination: readString(object.destination, `${label}.destination`),
        kind,
        source: readEnum(
          object.source,
          ["self", "target"] as const,
          `${label}.source`,
        ),
      };
    case "setAutoPass":
      return {
        kind,
        target: readLiteral(object.target, "controller", `${label}.target`),
        value: readBoolean(object.value, `${label}.value`),
      };
    case "randomSelection":
      return {
        kind,
        options: readStringArray(object.options, `${label}.options`),
        picks: readNumber(object.picks, `${label}.picks`),
      };
    default:
      throw new Error(
        `Invalid ${label}.kind: unsupported persisted effect kind "${kind}".`,
      );
  }
}

function validateContinuousEffectNode(
  value: unknown,
  label: string,
): ContinuousEffectNode {
  const object = readObject(value, label);
  const kind = readEnum(object.kind, CONTINUOUS_EFFECT_KINDS, `${label}.kind`);

  switch (kind) {
    case "grantPermission":
      return {
        kind,
        permission: readEnum(
          object.permission,
          CONTINUOUS_EFFECT_PERMISSIONS,
          `${label}.permission`,
        ),
        target: readEnum(
          object.target,
          CONTINUOUS_EFFECT_TARGETS,
          `${label}.target`,
        ),
      };
    case "modifyStats":
      return {
        kind,
        modifier: validateStatModifier(object.modifier, `${label}.modifier`),
        target: readEnum(
          object.target,
          CONTINUOUS_EFFECT_TARGETS,
          `${label}.target`,
        ),
      };
    case "grantKeyword":
      return {
        keywordId: readString(object.keywordId, `${label}.keywordId`),
        kind,
        target: readEnum(
          object.target,
          CONTINUOUS_EFFECT_TARGETS,
          `${label}.target`,
        ),
      };
  }
}

function validateReplacementNode(
  value: unknown,
  label: string,
): ReplacementNode {
  const object = readObject(value, label);
  const kind = readEnum(object.kind, REPLACEMENT_KINDS, `${label}.kind`);

  switch (kind) {
    case "preventDamage":
      return {
        kind,
        limit: readOptional(object.limit, `${label}.limit`, readNumber),
      };
    case "moveInstead":
      return {
        destination: readString(object.destination, `${label}.destination`),
        kind,
      };
    case "imposeTargetingTax":
      return {
        amount: readNumber(object.amount, `${label}.amount`),
        kind,
        resourceId: readString(object.resourceId, `${label}.resourceId`),
      };
  }
}

function validateStatModifier(
  value: unknown,
  label: string,
): StatModifierShape {
  const object = readObject(value, label);

  return {
    power: readOptional(object.power, `${label}.power`, readNumber),
    toughness: readOptional(object.toughness, `${label}.toughness`, readNumber),
  };
}

function parseJsonValue(json: string, label: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    throw new Error(`Invalid ${label} JSON.`);
  }
}

function readObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) {
    throw new Error(`Invalid ${label}: expected object.`);
  }
  return value;
}

function readArray<T>(
  value: unknown,
  label: string,
  parseEntry: (entry: unknown, label: string) => T,
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected array.`);
  }

  return value.map((entry, index) => parseEntry(entry, `${label}[${index}]`));
}

function readRecord<T>(
  value: unknown,
  label: string,
  parseEntry: (entry: unknown, label: string) => T,
): Record<string, T> {
  const object = readObject(value, label);
  return Object.fromEntries(
    Object.entries(object).map(([key, entry]) => [
      key,
      parseEntry(entry, `${label}.${key}`),
    ]),
  );
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${label}: expected string.`);
  }

  return value;
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${label}: expected finite number.`);
  }

  return value;
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${label}: expected boolean.`);
  }

  return value;
}

function readNullable<T>(
  value: unknown,
  label: string,
  parseValue: (value: unknown, label: string) => T,
): T | null {
  if (value === null) {
    return null;
  }

  return parseValue(value, label);
}

function readOptional<T>(
  value: unknown,
  label: string,
  parseValue: (value: unknown, label: string) => T,
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseValue(value, label);
}

function readNullableString(value: unknown, label: string): string | null {
  return readNullable(value, label, readString);
}

function readNullableNumber(value: unknown, label: string): number | null {
  return readNullable(value, label, readNumber);
}

function readEnum<const T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  label: string,
): T[number] {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw new Error(
      `Invalid ${label}: expected one of ${allowedValues.join(", ")}.`,
    );
  }

  return value;
}

function readLiteral<const T extends string>(
  value: unknown,
  expectedValue: T,
  label: string,
): T {
  if (value !== expectedValue) {
    throw new Error(`Invalid ${label}: expected "${expectedValue}".`);
  }

  return expectedValue;
}

function readNullableEnum<const T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  label: string,
): T[number] | null {
  if (value === null) {
    return null;
  }

  return readEnum(value, allowedValues, label);
}

function readStringArray(value: unknown, label: string): string[] {
  return readArray(value, label, readString);
}

function readNumberRecord(
  value: unknown,
  label: string,
): Record<string, number> {
  const object = readObject(value, label);
  return Object.fromEntries(
    Object.entries(object).map(([key, entry]) => [
      key,
      readNumber(entry, `${label}.${key}`),
    ]),
  );
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
