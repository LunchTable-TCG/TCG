import type { GameplayIntent } from "./gameplay";
import type { GameplayIntentKind } from "./kinds";
import type { CardCatalogEntry } from "./library";
import type {
  MatchCombatView,
  MatchEventSummary,
  MatchId,
  MatchPromptView,
  MatchSeatView,
  MatchShell,
  MatchSpectatorView,
  MatchStackItemView,
  MatchVisibility,
  MatchZoneView,
  SeatId,
  SeatStateView,
  ZoneKind,
} from "./match";

export const AGENT_MATCH_CONTEXT_VERSION = "v1" as const;
export type AgentMatchContextVersion = typeof AGENT_MATCH_CONTEXT_VERSION;

export interface PromptDecisionChoiceV1 {
  choiceId: string;
  disabled: boolean;
  hint: string | null;
  label: string;
}

export interface PromptDecisionSchemaV1 {
  choices: PromptDecisionChoiceV1[];
  kind: MatchPromptView["kind"];
  maxSelections: number;
  message: string;
  minSelections: number;
  ownerSeat: SeatId;
  promptId: string;
}

export type LegalActionArgumentValue =
  | boolean
  | number
  | string
  | null
  | string[];

export interface LegalActionDescriptorV1 {
  actionId: string;
  args: Record<string, LegalActionArgumentValue>;
  humanLabel: string;
  intent: GameplayIntent;
  kind: GameplayIntentKind;
  legalityFingerprint: string;
  machineLabel: string;
  priority: number;
}

export interface AgentVisibleCardV1 {
  card: CardCatalogEntry;
  seenIn: Array<{
    ownerSeat: SeatId | null;
    visibility: MatchVisibility;
    zone: ZoneKind;
  }>;
}

export interface AgentMatchContextV1 {
  availableIntentKinds: GameplayIntentKind[];
  builtAt: number;
  buildDurationMs: number;
  combat: MatchCombatView;
  legalActions: LegalActionDescriptorV1[];
  match: MatchShell;
  prompt: MatchPromptView | null;
  promptDecision: PromptDecisionSchemaV1 | null;
  recentEvents: MatchEventSummary[];
  seats: SeatStateView[];
  stack: MatchStackItemView[];
  version: AgentMatchContextVersion;
  viewKind: MatchSeatView["kind"] | MatchSpectatorView["kind"];
  viewerSeat: SeatId | null;
  visibleCards: AgentVisibleCardV1[];
  zones: MatchZoneView[];
}

export interface BotDecisionTraceV1 {
  actionCatalogSize: number;
  chosenActionId: string | null;
  chosenKind: GameplayIntentKind | null;
  confidence: number | null;
  contextHash: string;
  invalidChoiceReason: string | null;
  matchId: MatchId;
  policyKey: string;
  promptTemplateVersion: string | null;
  rejectedActionIds: string[];
  requestedAt: number;
  respondedAt: number;
  seat: SeatId;
  stateVersion: number;
  submittedAt: number | null;
  tokenUsage: {
    input: number | null;
    output: number | null;
    total: number | null;
  };
}
