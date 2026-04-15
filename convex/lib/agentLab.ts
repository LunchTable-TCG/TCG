import { getCatalogForFormat } from "@lunchtable/bot-sdk";
import {
  createDecisionFrame,
  listLegalBotActions,
  planBaselineIntent,
} from "@lunchtable/bot-sdk";
import type {
  AgentLabPurpose,
  AgentLabSessionRecord,
  MatchSeatSummary,
  MatchSeatView,
  MatchSpectatorView,
  SeatId,
  SeatStateView,
} from "@lunchtable/shared-types";
import type { Doc } from "../_generated/dataModel";

export const COACH_AGENT_NAME = "Lunch-Table Coach";
export const COMMENTATOR_AGENT_NAME = "Lunch-Table Commentator";
export const AGENT_REPLY_PREVIEW_LENGTH = 180;

type AnySeatSummary = MatchSeatSummary | SeatStateView;

function getZoneCardCount<
  T extends {
    zones: {
      cardCount: number;
      ownerSeat: string | null;
      zone: string;
    }[];
  },
>(view: T, ownerSeat: SeatId | null, zone: string) {
  return (
    view.zones.find(
      (candidate) =>
        candidate.ownerSeat === ownerSeat && candidate.zone === zone,
    )?.cardCount ?? 0
  );
}

function summarizeRecentEvents(
  recentEvents: { label: string }[],
  count: number,
): string {
  const labels = recentEvents
    .slice(-count)
    .map((event) => event.label)
    .filter((label) => label.trim().length > 0);

  if (labels.length === 0) {
    return "No recent public events yet.";
  }

  return labels.join(" | ");
}

function normalizePrompt(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 280);
}

function previewReply(reply: string) {
  const compact = normalizePrompt(reply);
  return compact.length <= AGENT_REPLY_PREVIEW_LENGTH
    ? compact
    : `${compact.slice(0, AGENT_REPLY_PREVIEW_LENGTH - 1)}…`;
}

function describeLifeTotals(
  selfSeat: AnySeatSummary,
  opposingSeat: AnySeatSummary | null,
) {
  if (!opposingSeat) {
    return `${selfSeat.seat} is at ${selfSeat.lifeTotal} life.`;
  }

  const lifeLead = selfSeat.lifeTotal - opposingSeat.lifeTotal;
  if (lifeLead === 0) {
    return `${selfSeat.seat} and ${opposingSeat.seat} are tied at ${selfSeat.lifeTotal} life.`;
  }

  const leader = lifeLead > 0 ? selfSeat.seat : opposingSeat.seat;
  const margin = Math.abs(lifeLead);
  return `${leader} leads on life by ${margin}. ${selfSeat.seat}: ${selfSeat.lifeTotal}, ${opposingSeat.seat}: ${opposingSeat.lifeTotal}.`;
}

export function getAgentSessionTitle(input: {
  matchId: string;
  purpose: AgentLabPurpose;
}) {
  const prefix =
    input.purpose === "coach" ? "Coach Thread" : "Commentator Thread";
  return `${prefix} · ${input.matchId}`;
}

export function toAgentLabSessionRecord(
  doc: Doc<"agentSessions">,
): AgentLabSessionRecord {
  return {
    createdAt: doc.createdAt,
    id: doc._id,
    latestReplyPreview: doc.latestReplyPreview ?? null,
    matchId: doc.matchId,
    ownerUserId: doc.ownerUserId,
    purpose: doc.purpose,
    status: doc.status,
    threadId: doc.threadId,
    title: doc.title,
    updatedAt: doc.updatedAt,
  };
}

export function buildCoachReply(input: {
  prompt: string;
  view: MatchSeatView;
}) {
  const seat = input.view.seats.find(
    (candidate) => candidate.seat === input.view.viewerSeat,
  );
  if (!seat) {
    throw new Error("Coach view is missing the viewer seat summary.");
  }

  const opponent =
    input.view.seats.find(
      (candidate) => candidate.seat !== input.view.viewerSeat,
    ) ?? null;

  const decisionFrame = createDecisionFrame({
    catalog: getCatalogForFormat(input.view.match.format.id),
    view: input.view,
  });
  const legalActions = listLegalBotActions(decisionFrame);
  const recommendation = planBaselineIntent(decisionFrame);
  const recommendedAction = recommendation
    ? (legalActions.find(
        (candidate) =>
          candidate.kind === recommendation.intent.kind &&
          candidate.intent.intentId === recommendation.intent.intentId,
      ) ??
      legalActions[0] ??
      null)
    : (legalActions[0] ?? null);

  const battlefieldCount = getZoneCardCount(
    input.view,
    input.view.viewerSeat,
    "battlefield",
  );
  const opposingBattlefieldCount = getZoneCardCount(
    input.view,
    opponent?.seat ?? null,
    "battlefield",
  );
  const cleanPrompt = normalizePrompt(input.prompt);
  const legalActionLabels = legalActions
    .slice(0, 4)
    .map((action) => action.label)
    .join(", ");

  return [
    "Coach mode is advisory only. It never submits intents or bypasses prompts.",
    `Turn ${input.view.match.turnNumber} · ${input.view.match.phase}. Active seat: ${input.view.match.activeSeat ?? "none"}. You ${seat.hasPriority ? "currently have" : "do not currently have"} priority.`,
    describeLifeTotals(seat, opponent),
    `Your board: ${battlefieldCount} battlefield card${battlefieldCount === 1 ? "" : "s"}, ${seat.handCount} in hand, ${seat.deckCount} in deck. Opponent board: ${opposingBattlefieldCount}.`,
    input.view.prompt
      ? `Prompt in front of you: ${input.view.prompt.message}`
      : "No prompt is waiting on your seat right now.",
    legalActionLabels.length > 0
      ? `Legal actions now: ${legalActionLabels}.`
      : "No immediate legal actions are available from this seat view.",
    recommendedAction
      ? `Baseline parity recommendation: ${recommendedAction.label}.`
      : "Baseline parity recommendation: wait for the next legal window.",
    cleanPrompt.length > 0
      ? `Requested focus: ${cleanPrompt}`
      : "Suggested focus: preserve tempo and avoid spending resources off-priority without pressure.",
    `Recent context: ${summarizeRecentEvents(input.view.recentEvents, 3)}`,
  ].join("\n\n");
}

export function buildCommentatorReply(input: {
  prompt: string;
  replaySummary: {
    totalFrames: number;
  } | null;
  view: MatchSpectatorView;
}) {
  const orderedSeats = [...input.view.seats].sort((left, right) =>
    left.seat.localeCompare(right.seat),
  );
  const seatLines = orderedSeats.map((seat) => {
    const battlefieldCount = getZoneCardCount(
      input.view,
      seat.seat,
      "battlefield",
    );
    const graveyardCount = getZoneCardCount(input.view, seat.seat, "graveyard");
    return `${seat.seat}: ${seat.lifeTotal} life, ${battlefieldCount} on board, ${seat.handCount} in hand, ${graveyardCount} in graveyard.`;
  });
  const cleanPrompt = normalizePrompt(input.prompt);

  return [
    "Commentator mode is public-state only. It never reads private opponent hands or unrevealed deck order.",
    `Turn ${input.view.match.turnNumber} · ${input.view.match.phase}. Active seat: ${input.view.match.activeSeat ?? "none"}. Priority seat: ${input.view.match.prioritySeat ?? "none"}. Stack objects: ${input.view.stack.length}.`,
    ...seatLines,
    `Public momentum: ${summarizeRecentEvents(input.view.recentEvents, 4)}`,
    input.replaySummary
      ? `Replay coverage: ${input.replaySummary.totalFrames} public frame${input.replaySummary.totalFrames === 1 ? "" : "s"} captured so far.`
      : "Replay coverage: no replay summary available yet.",
    cleanPrompt.length > 0
      ? `Requested focus: ${cleanPrompt}`
      : "Requested focus: highlight visible swing points and tempo changes only.",
  ].join("\n\n");
}

export function createAgentReply(input: {
  prompt: string;
  purpose: AgentLabPurpose;
  replaySummary: {
    totalFrames: number;
  } | null;
  seatView: MatchSeatView | null;
  spectatorView: MatchSpectatorView | null;
}) {
  if (input.purpose === "coach") {
    if (!input.seatView) {
      throw new Error(
        "Coach sessions require an owned seat view for the selected match.",
      );
    }

    return {
      agentName: COACH_AGENT_NAME,
      reply: buildCoachReply({
        prompt: input.prompt,
        view: input.seatView,
      }),
    };
  }

  if (!input.spectatorView) {
    throw new Error(
      "Commentator sessions require a public spectator view for the selected match.",
    );
  }

  return {
    agentName: COMMENTATOR_AGENT_NAME,
    reply: buildCommentatorReply({
      prompt: input.prompt,
      replaySummary: input.replaySummary,
      view: input.spectatorView,
    }),
  };
}

export function nextSessionPreview(reply: string) {
  return previewReply(reply);
}
