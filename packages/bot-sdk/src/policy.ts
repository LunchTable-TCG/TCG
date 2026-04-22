import { createAgentMatchContext } from "./agent-context";
import { listLegalBotActions } from "./legal-actions";
import type {
  BotDecisionFrame,
  BotLegalAction,
  BotPlannedIntent,
  BotPolicy,
  BotSeatId,
} from "./types";

function assertBotSeatId(seat: string): BotSeatId {
  if (seat === "seat-0" || seat === "seat-1") {
    return seat;
  }
  throw new Error(`Unsupported bot seat: ${seat}`);
}

export function createDecisionFrame(input: {
  catalog: BotDecisionFrame["catalog"];
  receivedAt?: number;
  view: BotDecisionFrame["view"];
}): BotDecisionFrame {
  const receivedAt = input.receivedAt ?? Date.now();
  const context = createAgentMatchContext({
    catalog: input.catalog,
    receivedAt,
    view: input.view,
  });

  return {
    availableIntentKinds: [...input.view.availableIntents],
    catalog: input.catalog,
    context,
    deadlineAt: input.view.match.timers.activeDeadlineAt,
    matchId: input.view.match.id,
    receivedAt,
    seat: assertBotSeatId(input.view.viewerSeat),
    view: input.view,
  };
}

export function createDecisionKey(frame: BotDecisionFrame): string {
  return [
    frame.matchId,
    frame.view.match.version,
    frame.view.prompt?.promptId ?? "no-prompt",
    frame.context.legalActions.map((action) => action.actionId).join("|"),
  ].join(":");
}

export function planBaselineIntent(
  frame: BotDecisionFrame,
): BotPlannedIntent | null {
  const action = selectPreferredAction(listLegalBotActions(frame));
  if (!action) {
    return null;
  }

  return {
    actionId: action.actionId,
    confidence: action.kind === "passPriority" ? 0.5 : 0.8,
    intent: action.intent,
    requestedAt: frame.receivedAt,
    seat: frame.seat,
  };
}

export const baselineBotPolicy: BotPolicy = {
  decide: planBaselineIntent,
  key: "baseline-v2-legal-actions",
};

function selectPreferredAction(
  actions: BotLegalAction[],
): BotLegalAction | null {
  return (
    actions.find(
      (action) => action.kind !== "concede" && action.kind !== "toggleAutoPass",
    ) ?? null
  );
}
