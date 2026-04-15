import type {
  CardCatalogEntry,
  GameplayIntent,
  GameplayIntentKind,
  MatchId,
  MatchSeatId,
  MatchSeatView,
} from "@lunchtable/shared-types";

export type BotSeatId = MatchSeatId;

type BotSupportedIntentKind =
  | "activateAbility"
  | "keepOpeningHand"
  | "passPriority"
  | "playCard"
  | "takeMulligan";

type BotSupportedIntentBase = Extract<
  GameplayIntent,
  { kind: BotSupportedIntentKind }
>;

type BotPlayCardIntent = Extract<BotSupportedIntentBase, { kind: "playCard" }>;
type BotNonPlayCardIntent = Exclude<BotSupportedIntentBase, BotPlayCardIntent>;

type WithBotSeat<T extends { seat: unknown }> = T extends unknown
  ? Omit<T, "seat"> & { seat: BotSeatId }
  : never;

type BotPlayableCardIntent = Omit<WithBotSeat<BotPlayCardIntent>, "payload"> & {
  payload: Omit<BotPlayCardIntent["payload"], "sourceZone"> & {
    sourceZone: Exclude<BotPlayCardIntent["payload"]["sourceZone"], "stack">;
  };
};

export type BotSupportedIntent =
  | WithBotSeat<BotNonPlayCardIntent>
  | BotPlayableCardIntent;

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
