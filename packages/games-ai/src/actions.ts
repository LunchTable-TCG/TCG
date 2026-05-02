export interface LegalActionDescriptor<
  TIntent extends { kind: string } = { kind: string },
> {
  actionId: string;
  humanLabel: string;
  intent: TIntent;
  kind: TIntent["kind"];
  machineLabel: string;
  priority: number;
}

export interface DecisionFrame<TView, TAction extends LegalActionDescriptor> {
  deadlineAt: number | null;
  legalActions: TAction[];
  receivedAt: number;
  seat: string;
  view: TView;
}
