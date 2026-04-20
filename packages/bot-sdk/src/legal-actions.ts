import { listLegalActionDescriptors } from "./agent-context";
import type { BotDecisionFrame, BotLegalAction } from "./types";

export function listLegalBotActions(
  frame: BotDecisionFrame,
): BotLegalAction[] {
  return listLegalActionDescriptors(frame);
}
