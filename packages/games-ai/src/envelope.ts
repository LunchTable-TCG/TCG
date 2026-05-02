import type { DecisionFrame, LegalActionDescriptor } from "./actions";

export interface ExternalDecisionEnvelope<
  TView,
  TAction extends LegalActionDescriptor,
> {
  deadlineAt: number | null;
  gameId: string;
  legalActions: TAction[];
  receivedAt: number;
  requestId: string;
  rulesetId: string;
  seat: string;
  view: TView;
}

export function createExternalDecisionEnvelope<
  TView,
  TAction extends LegalActionDescriptor,
>(
  frame: DecisionFrame<TView, TAction>,
  metadata: {
    gameId: string;
    requestId: string;
    rulesetId: string;
  },
): ExternalDecisionEnvelope<TView, TAction> {
  return {
    deadlineAt: frame.deadlineAt,
    gameId: metadata.gameId,
    legalActions: frame.legalActions,
    receivedAt: frame.receivedAt,
    requestId: metadata.requestId,
    rulesetId: metadata.rulesetId,
    seat: frame.seat,
    view: frame.view,
  };
}
