import type {
  CardCatalogEntry,
  GameplayIntentKind,
  MatchId,
  MatchSeatView,
} from "@lunchtable/shared-types";

export type BotSeatId = "seat-0" | "seat-1";

export type BotSupportedIntent =
  | {
      intentId: string;
      kind: "activateAbility";
      matchId: MatchId;
      payload: {
        abilityId: string;
        sourceInstanceId: string;
      };
      seat: BotSeatId;
      stateVersion: number;
    }
  | {
      intentId: string;
      kind: "keepOpeningHand";
      matchId: MatchId;
      payload: Record<string, never>;
      seat: BotSeatId;
      stateVersion: number;
    }
  | {
      intentId: string;
      kind: "passPriority";
      matchId: MatchId;
      payload: Record<string, never>;
      seat: BotSeatId;
      stateVersion: number;
    }
  | {
      intentId: string;
      kind: "playCard";
      matchId: MatchId;
      payload: {
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
          | "exile";
        targetSlotId: string | null;
      };
      seat: BotSeatId;
      stateVersion: number;
    }
  | {
      intentId: string;
      kind: "takeMulligan";
      matchId: MatchId;
      payload: {
        targetHandSize: number | null;
      };
      seat: BotSeatId;
      stateVersion: number;
    };

export interface BotDecisionFrame {
  availableIntentKinds: GameplayIntentKind[];
  catalog: CardCatalogEntry[];
  deadlineAt: number | null;
  matchId: MatchId;
  receivedAt: number;
  seat: BotSeatId;
  view: MatchSeatView;
}

export interface BotLegalAction {
  intent: BotSupportedIntent;
  kind: BotSupportedIntent["kind"];
  label: string;
  priority: number;
}

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

export interface BotExternalDecisionResponse {
  actionId: string | null;
  confidence?: number | null;
  rationale?: string | null;
}

export interface BotPlannedIntent {
  confidence: number;
  intent: BotSupportedIntent;
  requestedAt: number;
  seat: BotSeatId;
}

export interface BotPolicy {
  key: string;
  decide(frame: BotDecisionFrame): BotPlannedIntent | null;
}
