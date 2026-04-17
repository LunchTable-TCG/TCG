import type { MatchSeatView } from "@lunchtable/shared-types";

import { listLegalBotActions } from "./legal-actions";
import type {
  BotDecisionFrame,
  BotExternalDecisionEnvelope,
  BotExternalDecisionResponse,
  BotPlannedIntent,
} from "./types";

function formatSeatSummary(view: MatchSeatView) {
  return view.seats.map((seat) => {
    const seatLabel = seat.username ?? seat.seat;
    const role = seat.actorType === "bot" ? "agent" : "human";
    const statusTags = [
      seat.isActiveTurn ? "active turn" : null,
      seat.hasPriority ? "priority" : null,
      seat.autoPassEnabled ? "auto-pass on" : null,
    ].filter(Boolean);

    return `${seatLabel} [${seat.seat}, ${role}] life ${seat.lifeTotal}, hand ${seat.handCount}, deck ${seat.deckCount}, graveyard ${seat.graveyardCount}${statusTags.length > 0 ? `, ${statusTags.join(", ")}` : ""}`;
  });
}

export function createExternalDecisionPrompt(frame: BotDecisionFrame): string {
  const actions = listLegalBotActions(frame);
  const promptLines = [
    `You are controlling ${frame.seat} in Lunch Table.`,
    "Choose exactly one provided actionId or return null if no action should be taken right now.",
    "Never invent a new gameplay mutation. Only select from the legal actions below.",
    `Match: ${frame.matchId}`,
    `Current time: ${new Date(frame.receivedAt).toISOString()} (${frame.receivedAt})`,
    `Format: ${frame.view.match.format.name} (${frame.view.match.format.id})`,
    `Phase: ${frame.view.match.phase} on turn ${frame.view.match.turnNumber}`,
    `State version: ${frame.view.match.version}`,
    `Active seat: ${frame.view.match.activeSeat ?? "none"}`,
    `Deadline: ${frame.deadlineAt ?? "none"}`,
    "Seats:",
    ...formatSeatSummary(frame.view).map((line) => `- ${line}`),
    frame.view.prompt
      ? `Prompt: ${frame.view.prompt.kind} — ${frame.view.prompt.message}`
      : "Prompt: none",
    frame.view.stack.length > 0
      ? `Stack: ${frame.view.stack.map((item) => item.label).join(" | ")}`
      : "Stack: empty",
    frame.view.recentEvents.length > 0
      ? `Recent events: ${frame.view.recentEvents
          .map((event) => `${event.sequence}. ${event.label}`)
          .join(" | ")}`
      : "Recent events: none",
    "Legal actions:",
    ...actions.map(
      (action) =>
        `- ${action.intent.intentId}: ${action.label} [${action.kind}] priority=${action.priority}`,
    ),
    'Response JSON: {"actionId":"...","confidence":0.0-1.0,"rationale":"optional"}',
  ];

  return promptLines.join("\n");
}

export function createExternalDecisionEnvelope(
  frame: BotDecisionFrame,
): BotExternalDecisionEnvelope {
  const legalActions = listLegalBotActions(frame).map((action) => ({
    actionId: action.intent.intentId,
    intent: action.intent,
    kind: action.kind,
    label: action.label,
    priority: action.priority,
  }));

  return {
    formatId: frame.view.match.format.id,
    formatName: frame.view.match.format.name,
    legalActions,
    matchId: frame.matchId,
    prompt: createExternalDecisionPrompt(frame),
    receivedAt: frame.receivedAt,
    seat: frame.seat,
    stateVersion: frame.view.match.version,
    summary: {
      activeSeat: frame.view.match.activeSeat,
      deadlineAt: frame.deadlineAt,
      phase: frame.view.match.phase,
      recentEvents: frame.view.recentEvents.map(
        (event) => `${event.sequence}. ${event.label}`,
      ),
      stackLabels: frame.view.stack.map((item) => item.label),
      turnNumber: frame.view.match.turnNumber,
    },
    view: frame.view,
  };
}

export function resolveExternalDecisionResponse(input: {
  frame: BotDecisionFrame;
  response: BotExternalDecisionResponse | string | null;
}): BotPlannedIntent | null {
  const parsed =
    typeof input.response === "string"
      ? { actionId: input.response }
      : input.response;

  if (!parsed || parsed.actionId == null) {
    return null;
  }

  const action = listLegalBotActions(input.frame).find(
    (candidate) => candidate.intent.intentId === parsed.actionId,
  );
  if (!action) {
    throw new Error("External agent returned an unknown actionId");
  }

  const confidence =
    typeof parsed.confidence === "number" &&
    parsed.confidence >= 0 &&
    parsed.confidence <= 1
      ? parsed.confidence
      : 0.5;

  return {
    confidence,
    intent: action.intent,
    requestedAt: input.frame.receivedAt,
    seat: input.frame.seat,
  };
}
