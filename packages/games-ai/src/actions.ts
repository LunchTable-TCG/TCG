export type IntentWithKind = { kind: string };

export type LegalActionDescriptor<
  TIntent extends IntentWithKind = IntentWithKind,
> = TIntent extends IntentWithKind
  ? {
      actionId: string;
      humanLabel: string;
      intent: TIntent;
      kind: TIntent["kind"];
      machineLabel: string;
      priority: number;
    }
  : never;

export interface DecisionFrame<TView, TAction extends LegalActionDescriptor> {
  deadlineAt: number | null;
  legalActions: TAction[];
  receivedAt: number;
  seat: string;
  view: TView;
}
