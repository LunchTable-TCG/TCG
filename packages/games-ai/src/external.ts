import type { LegalActionDescriptor } from "./actions";

export function resolveExternalActionId<TAction extends LegalActionDescriptor>(
  actions: TAction[],
  actionId: string,
): TAction;
export function resolveExternalActionId<TAction extends LegalActionDescriptor>(
  actions: TAction[],
  actionId: null,
): null;
export function resolveExternalActionId<TAction extends LegalActionDescriptor>(
  actions: TAction[],
  actionId: string | null,
): TAction | null;
export function resolveExternalActionId<TAction extends LegalActionDescriptor>(
  actions: TAction[],
  actionId: string | null,
): TAction | null {
  if (actionId === null) {
    return null;
  }

  const action = actions.find((candidate) => candidate.actionId === actionId);
  if (!action) {
    throw new Error("External agent returned an unrecognized actionId");
  }

  return action;
}
