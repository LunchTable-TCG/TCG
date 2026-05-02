export type IntentWithKind = { kind: string };

export type LegalActionDescriptor<
  TIntent extends IntentWithKind = IntentWithKind,
> = {
  [TKind in TIntent["kind"]]: {
    actionId: string;
    humanLabel: string;
    intent: Extract<TIntent, { kind: TKind }>;
    kind: TKind;
    machineLabel: string;
    priority: number;
  };
}[TIntent["kind"]];

export interface DecisionFrame<TView, TAction extends LegalActionDescriptor> {
  deadlineAt: number | null;
  legalActions: TAction[];
  receivedAt: number;
  seat: string;
  view: TView;
}
