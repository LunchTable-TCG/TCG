import {
  applyGameplayIntent,
  compileCardDefinition,
  createGameState,
  createMatchShellFromState,
  createSeatView,
  createSpectatorView,
  deriveDeterministicNumber,
} from "@lunchtable/game-core";
import type {
  FormatDefinition,
  MatchCardCatalogEntry,
  MatchState,
  MatchTransition,
} from "@lunchtable/game-core";
import type {
  DeckCardEntry,
  GameplayIntent,
  MatchActorType,
  MatchEvent,
  MatchPhase,
  MatchPromptView,
  MatchSeatView,
  MatchShell,
  MatchSpectatorView,
  MatchStatus,
  SeatId,
  UserId,
} from "@lunchtable/shared-types";

import type { MutationCtx } from "../_generated/server";
import {
  parseMatchEventJson,
  parseMatchSeatViewJson,
  parseMatchShellJson,
  parseMatchSpectatorViewJson,
  parseMatchStateJson,
} from "./matchJson";
import {
  createReplayFrame,
  createReplayFrameSlice,
  serializeReplayFrames,
} from "./replays";

export interface PracticeMatchBundleInput {
  createdAt: number;
  format: FormatDefinition;
  matchId: string;
  player: {
    userId: UserId;
    username: string;
    walletAddress: string | null;
  };
  primaryDeck: {
    mainboard: DeckCardEntry[];
    sideboard: DeckCardEntry[];
  };
}

export interface MatchParticipantInput {
  actorType: MatchActorType;
  deck: {
    mainboard: DeckCardEntry[];
    sideboard: DeckCardEntry[];
  };
  seat: string;
  userId?: UserId | null;
  username?: string | null;
  walletAddress?: string | null;
}

export interface PersistedMatchBundleInput {
  activeSeat?: string | null;
  createdAt: number;
  format: FormatDefinition;
  matchId: string;
  participants: MatchParticipantInput[];
  phase?: MatchPhase;
  prioritySeat?: string | null;
  startedAt?: number | null;
  status: MatchStatus;
  turnNumber?: number;
}

export interface PersistedSeatViewRecord {
  kind: "seat";
  viewerSeat: string;
  viewerUserId: UserId | null;
  view: MatchSeatView;
}

export interface PersistedMatchBundle {
  events: MatchEvent[];
  shell: MatchShell;
  spectatorView: MatchSpectatorView;
  state: MatchState;
  views: PersistedSeatViewRecord[];
}

export type PracticeMatchBundle = PersistedMatchBundle;

export interface PersistedIntentResult {
  allEvents: MatchEvent[];
  appendedEvents: MatchEvent[];
  shell: MatchShell;
  spectatorView: MatchSpectatorView;
  state: MatchState;
  transition: MatchTransition;
  views: PersistedSeatViewRecord[];
}

const DEFAULT_OPENING_HAND_SIZE = 7;

function toMatchFormatSummary(format: FormatDefinition): MatchShell["format"] {
  return {
    boardModel: format.boardModel,
    deckRules: {
      ...format.deckRules,
    },
    id: format.formatId,
    name: format.name,
    resourceModel: format.resourceModel,
    timingModel: format.timingModel,
    turnModel: "alternating",
    version: "alpha-1",
    victoryModel: format.victoryModel,
  };
}

function createZoneInstanceIds(
  seat: string,
  zone: "deck" | "sideboard",
  entries: DeckCardEntry[],
): string[] {
  const instanceIds: string[] = [];

  for (const entry of entries) {
    for (let copyIndex = 0; copyIndex < entry.count; copyIndex += 1) {
      instanceIds.push(`${seat}:${entry.cardId}:${zone}:${copyIndex + 1}`);
    }
  }

  return instanceIds;
}

function createMatchCreatedEvent(
  shell: MatchShell,
): Extract<MatchEvent, { kind: "matchCreated" }> {
  return {
    at: shell.createdAt,
    eventId: "event_1",
    kind: "matchCreated",
    matchId: shell.id,
    payload: {
      shell,
    },
    sequence: 1,
    stateVersion: shell.version,
  };
}

function createPromptView(
  prompt: MatchState["prompts"][number],
): MatchPromptView {
  return {
    choices: prompt.choiceIds.map((choiceId) => ({
      choiceId,
      disabled: false,
      hint: null,
      label: choiceId,
    })),
    expiresAt: prompt.expiresAt,
    kind: prompt.kind,
    maxSelections: 1,
    message: prompt.message,
    minSelections: 1,
    ownerSeat: prompt.ownerSeat,
    promptId: prompt.promptId,
  };
}

function createPromptOpenedEvent(
  state: MatchState,
  prompt: MatchState["prompts"][number],
  sequence: number,
): Extract<MatchEvent, { kind: "promptOpened" }> {
  return {
    at: (state.shell.startedAt ?? state.shell.createdAt) + sequence,
    eventId: `event_${sequence}`,
    kind: "promptOpened",
    matchId: state.shell.id,
    payload: {
      prompt: createPromptView(prompt),
    },
    sequence,
    stateVersion: state.shell.version,
  };
}

function buildCardCatalog(format: FormatDefinition): MatchState["cardCatalog"] {
  return Object.fromEntries(
    format.cardPool.map((card) => {
      const compiled = compileCardDefinition(card, format.keywordRegistry);
      if (!compiled.ok) {
        throw new Error(compiled.errors.join(", "));
      }
      const entry: MatchCardCatalogEntry = {
        abilities: compiled.value.abilities,
        cardId: card.id,
        cost: card.cost,
        kind: card.kind,
        keywords: [...card.keywords],
        name: card.name,
        stats: card.stats ? { ...card.stats } : undefined,
      };
      return [card.id, entry];
    }),
  );
}

function shuffleInstances(
  instances: string[],
  random: MatchState["random"],
): [string[], MatchState["random"]] {
  let nextRandom = random;
  const weighted = instances.map((instanceId) => {
    const [weight, updatedRandom] = deriveDeterministicNumber(nextRandom);
    nextRandom = updatedRandom;
    return {
      instanceId,
      weight,
    };
  });

  weighted.sort((left, right) => {
    if (left.weight === right.weight) {
      return left.instanceId.localeCompare(right.instanceId);
    }
    return left.weight - right.weight;
  });

  return [weighted.map((item) => item.instanceId), nextRandom];
}

function createMulliganPrompt(
  seat: SeatId,
  handSize: number,
): MatchState["prompts"][number] {
  return {
    choiceIds: ["keep", `mulligan:${Math.max(0, handSize - 1)}`],
    expiresAt: null,
    kind: "mulligan",
    message: `Choose whether to keep ${handSize} cards or take a mulligan.`,
    ownerSeat: seat,
    promptId: `prompt:${seat}:mulligan`,
    resolvedChoiceIds: [],
    status: "pending",
  };
}

function setTurnResources(state: MatchState) {
  const activeSeat = state.shell.activeSeat;
  const amount = Math.max(1, state.shell.turnNumber);
  for (const seat of Object.values(state.seats)) {
    seat.resources = [
      {
        current: seat.seat === activeSeat ? amount : 0,
        label: "Mana",
        maximum: seat.seat === activeSeat ? amount : 0,
        resourceId: "mana",
      },
    ];
  }
}

function configurePendingState(state: MatchState) {
  for (const seat of Object.values(state.seats)) {
    seat.ready = true;
    seat.status = "ready";
  }
  state.shell.status = "pending";
}

function configureActiveState(
  state: MatchState,
  input: PersistedMatchBundleInput,
) {
  const activeSeat = (input.activeSeat ??
    input.participants[0]?.seat ??
    null) as SeatId | null;

  for (const seat of Object.values(state.seats)) {
    seat.ready = true;
    seat.status = "active";
  }

  state.cardCatalog = buildCardCatalog(input.format);
  state.shell.activeSeat = activeSeat;
  state.shell.phase = "mulligan";
  state.shell.prioritySeat = null;
  state.shell.startedAt = input.startedAt ?? input.createdAt;
  state.shell.status = "active";
  state.shell.turnNumber = input.turnNumber ?? 1;
  state.lastPriorityPassSeat = null;
  state.prompts = [];

  for (const seat of Object.values(state.seats)) {
    const [shuffledDeck, nextRandom] = shuffleInstances(
      seat.deck,
      state.random,
    );
    state.random = nextRandom;
    seat.deck = shuffledDeck;
    seat.hand = seat.deck.splice(0, DEFAULT_OPENING_HAND_SIZE);
    seat.mulligansTaken = 0;
    state.prompts.push(createMulliganPrompt(seat.seat, seat.hand.length));
  }

  setTurnResources(state);
}

function createSeatViews(
  state: MatchState,
  events: MatchEvent[],
): PersistedSeatViewRecord[] {
  return Object.values(state.seats).map((seat) => ({
    kind: "seat",
    viewerSeat: seat.seat,
    viewerUserId: seat.userId,
    view: createSeatView(state, seat.seat, events),
  }));
}

export function buildPersistedMatchBundle(
  input: PersistedMatchBundleInput,
): PersistedMatchBundle {
  const state = createGameState({
    createdAt: input.createdAt,
    matchId: input.matchId,
    seatActors: input.participants.map((participant) => ({
      actorType: participant.actorType,
      seat: participant.seat,
      userId: participant.userId ?? null,
      username: participant.username ?? null,
      walletAddress: participant.walletAddress ?? null,
    })),
    status: input.status,
  });

  state.shell.format = toMatchFormatSummary(input.format);
  state.cardCatalog = buildCardCatalog(input.format);
  for (const participant of input.participants) {
    state.seats[participant.seat].deck = createZoneInstanceIds(
      participant.seat,
      "deck",
      participant.deck.mainboard,
    );
    state.seats[participant.seat].sideboard = createZoneInstanceIds(
      participant.seat,
      "sideboard",
      participant.deck.sideboard,
    );
  }

  if (input.status === "active") {
    configureActiveState(state, input);
  } else {
    configurePendingState(state);
  }

  const pendingPrompts = state.prompts.filter(
    (prompt) => prompt.status === "pending",
  );
  state.eventSequence = 1 + pendingPrompts.length;
  state.shell = createMatchShellFromState(state);

  const events = [
    createMatchCreatedEvent(state.shell),
    ...pendingPrompts.map((prompt, index) =>
      createPromptOpenedEvent(state, prompt, index + 2),
    ),
  ];
  const views = createSeatViews(state, events);

  return {
    events,
    shell: state.shell,
    spectatorView: createSpectatorView(state, events),
    state,
    views,
  };
}

export function buildPracticeMatchBundle(
  input: PracticeMatchBundleInput,
): PracticeMatchBundle {
  return buildPersistedMatchBundle({
    activeSeat: "seat-0",
    createdAt: input.createdAt,
    format: input.format,
    matchId: input.matchId,
    participants: [
      {
        actorType: "human",
        deck: input.primaryDeck,
        seat: "seat-0",
        userId: input.player.userId,
        username: input.player.username,
        walletAddress: input.player.walletAddress,
      },
      {
        actorType: "bot",
        deck: input.primaryDeck,
        seat: "seat-1",
        username: "Table Bot",
      },
    ],
    startedAt: input.createdAt,
    status: "active",
    turnNumber: 1,
  });
}

export function buildPersistedIntentResult(input: {
  events: MatchEvent[];
  intent: GameplayIntent;
  state: MatchState;
}): PersistedIntentResult {
  const transition = applyGameplayIntent(input.state, input.intent);
  const allEvents =
    transition.outcome === "applied"
      ? [...input.events, ...transition.events]
      : input.events;

  return {
    allEvents,
    appendedEvents: transition.events,
    shell: transition.nextState.shell,
    spectatorView: createSpectatorView(transition.nextState, allEvents),
    state: transition.nextState,
    transition,
    views: createSeatViews(transition.nextState, allEvents),
  };
}

function toMatchDocument(input: {
  formatId: string;
  shell: MatchShell;
  updatedAt: number;
}) {
  return {
    activeSeat: input.shell.activeSeat ?? undefined,
    completedAt: input.shell.completedAt ?? undefined,
    createdAt: input.shell.createdAt,
    formatId: input.formatId,
    phase: input.shell.phase,
    shellJson: serializeMatchShell(input.shell),
    startedAt: input.shell.startedAt ?? undefined,
    status: input.shell.status,
    turnNumber: input.shell.turnNumber,
    updatedAt: input.updatedAt,
    version: input.shell.version,
    winnerSeat: input.shell.winnerSeat ?? undefined,
  };
}

export async function createPersistedMatch(
  ctx: MutationCtx,
  input: Omit<PersistedMatchBundleInput, "matchId">,
) {
  const matchRef = await ctx.db.insert("matches", {
    createdAt: input.createdAt,
    formatId: input.format.formatId,
    phase: "bootstrap",
    shellJson: "{}",
    status: input.status,
    turnNumber: 0,
    updatedAt: input.createdAt,
    version: 0,
  });

  const bundle = buildPersistedMatchBundle({
    ...input,
    matchId: matchRef,
  });

  await ctx.db.patch(
    matchRef,
    toMatchDocument({
      formatId: input.format.formatId,
      shell: bundle.shell,
      updatedAt: input.createdAt,
    }),
  );
  await ctx.db.insert("matchStates", {
    matchId: matchRef,
    snapshotJson: serializeMatchState(bundle.state),
    updatedAt: input.createdAt,
    version: bundle.shell.version,
  });

  for (const prompt of bundle.state.prompts.filter(
    (matchPrompt) => matchPrompt.status === "pending",
  )) {
    await ctx.db.insert("matchPrompts", {
      kind: prompt.kind,
      matchId: matchRef,
      ownerSeat: prompt.ownerSeat,
      promptId: prompt.promptId,
      promptJson: serializeMatchPrompt(prompt),
      status: "pending",
      updatedAt: input.createdAt,
    });
  }

  for (const event of bundle.events) {
    await ctx.db.insert("matchEvents", {
      at: event.at,
      eventJson: serializeMatchEvent(event),
      kind: event.kind,
      matchId: matchRef,
      seat: seatFromEvent(event),
      sequence: event.sequence,
      stateVersion: event.stateVersion,
    });
  }

  for (const view of bundle.views) {
    await ctx.db.insert("matchViews", {
      kind: "seat",
      matchId: matchRef,
      updatedAt: input.createdAt,
      viewJson: serializeMatchView(view.view),
      viewerSeat: view.viewerSeat,
      viewerUserId: view.viewerUserId ?? undefined,
    });
  }

  await ctx.db.insert("matchViews", {
    kind: "spectator",
    matchId: matchRef,
    updatedAt: input.createdAt,
    viewJson: serializeMatchView(bundle.spectatorView),
  });

  const initialReplayEvent = bundle.events[0];
  if (!initialReplayEvent) {
    throw new Error("Persisted matches must record an initial replay event.");
  }

  const initialReplayFrame = createReplayFrame({
    event: initialReplayEvent,
    frameIndex: 0,
    view: bundle.spectatorView,
  });

  const replayRef = await ctx.db.insert("replays", {
    completedAt: bundle.shell.completedAt ?? undefined,
    createdAt: input.createdAt,
    formatId: input.format.formatId,
    framesJson: serializeReplayFrames([]),
    lastEventSequence: initialReplayFrame.eventSequence,
    matchId: matchRef,
    ownerUserId: input.participants[0]?.userId ?? undefined,
    status: bundle.shell.status,
    totalFrames: 1,
    updatedAt: input.createdAt,
    winnerSeat: bundle.shell.winnerSeat ?? undefined,
  });

  const initialSlice = createReplayFrameSlice({
    frames: [initialReplayFrame],
    sliceIndex: 0,
  });
  await ctx.db.insert("replayFrameSlices", {
    createdAt: input.createdAt,
    endFrameIndex: initialSlice.endFrameIndex,
    frameCount: initialSlice.frameCount,
    framesJson: initialSlice.framesJson,
    matchId: matchRef,
    replayId: replayRef,
    sliceIndex: initialSlice.sliceIndex,
    startFrameIndex: initialSlice.startFrameIndex,
    updatedAt: input.createdAt,
  });

  return bundle;
}

export function serializeMatchShell(shell: MatchShell): string {
  return JSON.stringify(shell);
}

export function deserializeMatchShell(shellJson: string): MatchShell {
  return parseMatchShellJson(shellJson);
}

export function serializeMatchState(state: MatchState): string {
  return JSON.stringify(state);
}

export function deserializeMatchState(snapshotJson: string): MatchState {
  return parseMatchStateJson(snapshotJson);
}

export function serializeMatchEvent(event: MatchEvent): string {
  return JSON.stringify(event);
}

export function deserializeMatchEvent(eventJson: string): MatchEvent {
  return parseMatchEventJson(eventJson);
}

export function serializeMatchView(
  view: MatchSeatView | MatchSpectatorView,
): string {
  return JSON.stringify(view);
}

export function serializeMatchPrompt(
  prompt: MatchState["prompts"][number],
): string {
  return JSON.stringify(prompt);
}

export function deserializeSeatView(viewJson: string): MatchSeatView {
  return parseMatchSeatViewJson(viewJson);
}

export function deserializeSpectatorView(viewJson: string): MatchSpectatorView {
  return parseMatchSpectatorViewJson(viewJson);
}

export function seatFromEvent(event: MatchEvent): string | undefined {
  if ("seat" in event.payload && typeof event.payload.seat === "string") {
    return event.payload.seat;
  }
  return undefined;
}
