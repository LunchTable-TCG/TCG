import type {
  DecisionFrame,
  LegalActionDescriptor,
} from "@lunchtable/games-ai";
import type {
  AgentMatchContextV1,
  CardCatalogEntry,
  GameplayIntentBase,
  GameplayIntentKind,
  LegalActionDescriptorV1,
  MatchId,
  MatchSeatId,
  MatchSeatView,
} from "@lunchtable/shared-types";

export type BotSeatId = MatchSeatId;

type BotSupportedIntentKind =
  | "activateAbility"
  | "assignCombatDamage"
  | "chooseCosts"
  | "chooseModes"
  | "choosePromptOptions"
  | "chooseTargets"
  | "concede"
  | "declareAttackers"
  | "declareBlockers"
  | "keepOpeningHand"
  | "passPriority"
  | "playCard"
  | "takeMulligan"
  | "toggleAutoPass";

type WithBotSeat<T extends { seat: unknown }> = T extends unknown
  ? Omit<T, "seat"> & { seat: BotSeatId }
  : never;

type BotIntentBase<
  TKind extends GameplayIntentKind,
  TPayload,
> = GameplayIntentBase<TKind, TPayload> & {
  seat: BotSeatId;
};

export type BotSupportedIntent =
  | BotIntentBase<
      "activateAbility",
      {
        abilityId: string;
        sourceInstanceId: string;
        targetIds?: string[];
      }
    >
  | BotIntentBase<
      "assignCombatDamage",
      {
        assignments: Array<{
          amount: number;
          sourceId: string;
          targetId: string;
        }>;
      }
    >
  | BotIntentBase<"chooseCosts", { costIds: string[]; promptId: string }>
  | BotIntentBase<"chooseModes", { modeIds: string[]; promptId: string }>
  | BotIntentBase<
      "choosePromptOptions",
      {
        choiceIds: string[];
        promptId: string;
      }
    >
  | BotIntentBase<"chooseTargets", { promptId: string; targetIds: string[] }>
  | BotIntentBase<
      "concede",
      {
        reason: "disconnect" | "manual" | "timeout";
      }
    >
  | BotIntentBase<
      "declareAttackers",
      {
        attackers: Array<{
          attackerId: string;
          defenderSeat: BotSeatId;
          laneId: string | null;
        }>;
      }
    >
  | BotIntentBase<
      "declareBlockers",
      {
        blocks: Array<{
          attackerId: string;
          blockerId: string;
        }>;
      }
    >
  | BotIntentBase<"keepOpeningHand", Record<string, never>>
  | BotIntentBase<"passPriority", Record<string, never>>
  | BotIntentBase<
      "playCard",
      {
        alternativeCostId: string | null;
        cardInstanceId: string;
        sourceZone:
          | "battlefield"
          | "command"
          | "deck"
          | "graveyard"
          | "hand"
          | "laneReserve"
          | "objective"
          | "sideboard"
          | "stack"
          | "exile";
        targetSlotId: string | null;
      }
    >
  | BotIntentBase<"takeMulligan", { targetHandSize: number | null }>
  | BotIntentBase<"toggleAutoPass", { enabled: boolean }>;

export interface BotDecisionFrame
  extends Omit<DecisionFrame<MatchSeatView, BotLegalAction>, "legalActions"> {
  availableIntentKinds: GameplayIntentKind[];
  catalog: CardCatalogEntry[];
  context: AgentMatchContextV1;
  deadlineAt: number | null;
  matchId: MatchId;
  receivedAt: number;
  seat: BotSeatId;
  view: MatchSeatView;
}

export type BotLegalActionFor<TIntent extends BotSupportedIntent> =
  LegalActionDescriptor<TIntent> &
    Omit<LegalActionDescriptorV1, "intent" | "kind"> & {
      intent: TIntent;
      kind: TIntent["kind"];
    };

export type BotLegalAction = BotLegalActionFor<BotSupportedIntent>;

export interface BotExternalDecisionAction {
  actionId: string;
  intent: BotSupportedIntent;
  kind: BotSupportedIntent["kind"];
  label: string;
  priority: number;
}

export interface BotExternalDecisionEnvelope {
  formatId: string;
  formatName: string;
  legalActions: BotExternalDecisionAction[];
  matchId: MatchId;
  prompt: string;
  receivedAt: number;
  seat: BotSeatId;
  stateVersion: number;
  summary: {
    activeSeat: MatchSeatView["match"]["activeSeat"];
    deadlineAt: number | null;
    phase: MatchSeatView["match"]["phase"];
    recentEvents: string[];
    stackLabels: string[];
    turnNumber: MatchSeatView["match"]["turnNumber"];
  };
  view: MatchSeatView;
}

export type BotExternalDecisionResponse =
  | {
      actionId: null;
    }
  | {
      actionId: string;
      confidence?: number;
      rationale?: string;
    };

export interface BotPlannedIntent {
  actionId: string;
  confidence: number;
  intent: BotSupportedIntent;
  requestedAt: number;
  seat: BotSeatId;
}

export interface BotPolicy {
  key: string;
  decide(frame: BotDecisionFrame): BotPlannedIntent | null;
}
