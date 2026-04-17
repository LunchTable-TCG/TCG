import type {
  MatchEvent,
  MatchSpectatorView,
  ReplayFrame,
  ReplaySummary,
  UserId,
} from "@lunchtable/shared-types";
import { parseReplayFramesJson } from "./matchJson";


export const REPLAY_FRAME_SLICE_SIZE = 16;

export function describeReplayEvent(event: MatchEvent): string {
  switch (event.kind) {
    case "matchCreated":
      return "Match created";
    case "openingHandKept":
      return `${event.payload.seat} kept their opening hand.`;
    case "mulliganTaken":
      return `${event.payload.seat} took a mulligan to ${event.payload.handSize}.`;
    case "cardsDrawn":
      return `${event.payload.seat} drew ${event.payload.count} card${event.payload.count === 1 ? "" : "s"}.`;
    case "cardPlayed":
      return `${event.payload.seat} cast ${event.payload.cardInstanceId}.`;
    case "abilityActivated":
      return `${event.payload.seat} activated ${event.payload.abilityId}.`;
    case "attackersDeclared":
      return `${event.payload.seat} declared attackers.`;
    case "blockersDeclared":
      return `${event.payload.seat} declared blockers.`;
    case "combatDamageAssigned":
      return "Combat damage was assigned.";
    case "promptOpened":
      return `${event.payload.prompt.ownerSeat} received a ${event.payload.prompt.kind} prompt.`;
    case "promptResolved":
      return `${event.payload.seat} resolved ${event.payload.promptId}.`;
    case "priorityPassed":
      return `${event.payload.seat} passed priority.`;
    case "phaseAdvanced":
      return `Phase advanced to ${event.payload.to}.`;
    case "turnAdvanced":
      return `Turn ${event.payload.turnNumber} started for ${event.payload.activeSeat}.`;
    case "stackObjectCreated":
      return `Stack object ${event.payload.stackId} was created.`;
    case "stackObjectResolved":
      return `Stack object ${event.payload.stackId} resolved.`;
    case "cardMoved":
      return `${event.payload.cardInstanceId} moved to ${event.payload.toZone}.`;
    case "lifeTotalChanged":
      return `${event.payload.seat} moved to ${event.payload.to}.`;
    case "autoPassToggled":
      return `${event.payload.seat} ${event.payload.enabled ? "enabled" : "disabled"} auto-pass.`;
    case "playerConceded":
      return `${event.payload.seat} conceded the match.`;
    case "matchCompleted":
      return `Match completed. Winner: ${event.payload.winnerSeat ?? "none"}.`;
  }
}

export function selectReplayAnchorEvent(events: MatchEvent[]): MatchEvent {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event) {
      continue;
    }

    if (event.kind === "promptResolved" || event.kind === "priorityPassed") {
      continue;
    }

    return event;
  }

  const fallbackEvent = events.at(-1);
  if (!fallbackEvent) {
    throw new Error("Replay events are required.");
  }

  return fallbackEvent;
}

export function serializeReplayFrames(frames: ReplayFrame[]): string {
  return JSON.stringify(frames);
}

export function deserializeReplayFrames(framesJson: string): ReplayFrame[] {
  return parseReplayFramesJson(framesJson);
}

export function buildReplaySummary(input: {
  completedAt: number | null;
  createdAt: number;
  formatId: string;
  lastEventSequence: number;
  matchId: string;
  ownerUserId: UserId | null;
  status: ReplaySummary["status"];
  totalFrames: number;
  updatedAt: number;
  winnerSeat: string | null;
}): ReplaySummary {
  return {
    completedAt: input.completedAt,
    createdAt: input.createdAt,
    formatId: input.formatId,
    lastEventSequence: input.lastEventSequence,
    matchId: input.matchId,
    ownerUserId: input.ownerUserId,
    status: input.status,
    totalFrames: input.totalFrames,
    updatedAt: input.updatedAt,
    winnerSeat: input.winnerSeat,
  };
}

export function createReplayFrame(input: {
  event: MatchEvent;
  frameIndex: number;
  view: MatchSpectatorView;
}): ReplayFrame {
  const recentEvent = input.view.recentEvents.at(-1);

  return {
    eventKind: input.event.kind,
    eventSequence: input.event.sequence,
    frameIndex: input.frameIndex,
    label:
      recentEvent &&
      recentEvent.kind === input.event.kind &&
      recentEvent.label !== recentEvent.kind
        ? recentEvent.label
        : describeReplayEvent(input.event),
    recordedAt: input.event.at,
    view: input.view,
  };
}

export function appendReplayFrame(
  frames: ReplayFrame[],
  nextFrame: ReplayFrame,
): ReplayFrame[] {
  const previous = frames.at(-1);
  if (
    previous &&
    previous.eventSequence === nextFrame.eventSequence &&
    previous.label === nextFrame.label &&
    previous.view.match.version === nextFrame.view.match.version
  ) {
    return frames;
  }

  return [...frames, nextFrame];
}

export function createReplayFrameSlice(input: {
  frames: ReplayFrame[];
  sliceIndex: number;
}) {
  const firstFrame = input.frames[0];
  const lastFrame = input.frames.at(-1);
  if (!firstFrame || !lastFrame) {
    throw new Error("Replay frame slices must contain at least one frame.");
  }

  return {
    endFrameIndex: lastFrame.frameIndex,
    frameCount: input.frames.length,
    framesJson: serializeReplayFrames(input.frames),
    sliceIndex: input.sliceIndex,
    startFrameIndex: firstFrame.frameIndex,
  };
}
