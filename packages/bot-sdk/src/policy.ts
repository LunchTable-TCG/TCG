import { assertMatchSeatId } from "@lunchtable/shared-types";
import { listLegalBotActions } from "./legal-actions";
import type { BotDecisionFrame, BotPlannedIntent, BotPolicy } from "./types";

export function createDecisionFrame(input: {
  catalog: BotDecisionFrame["catalog"];
  receivedAt?: number;
  view: BotDecisionFrame["view"];
}): BotDecisionFrame {
  return {
    availableIntentKinds: [...input.view.availableIntents],
    catalog: input.catalog,
    deadlineAt: input.view.match.timers.activeDeadlineAt,
    matchId: input.view.match.id,
    receivedAt: input.receivedAt ?? Date.now(),
    seat: assertMatchSeatId(input.view.viewerSeat),
    view: input.view,
  };
}

export function createDecisionKey(frame: BotDecisionFrame): string {
  return `${frame.matchId}:${frame.view.match.version}:${frame.view.prompt?.promptId ?? "no-prompt"}`;
}

export function planBaselineIntent(
  frame: BotDecisionFrame,
): BotPlannedIntent | null {
  const action = listLegalBotActions(frame)[0];
  if (!action) {
    return null;
  }

  return {
    confidence: action.kind === "passPriority" ? 0.5 : 0.8,
    intent: action.intent,
    requestedAt: frame.receivedAt,
    seat: frame.seat,
  };
}

export const baselineBotPolicy: BotPolicy = {
  decide: planBaselineIntent,
  key: "baseline-v1",
};
