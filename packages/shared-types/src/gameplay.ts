import type { GameplayIntentKind, MatchEventKind } from "./kinds";
import type {
  CardInstanceId,
  MatchId,
  MatchPhase,
  MatchPromptView,
  MatchShell,
  PromptId,
  SeatId,
  StackObjectId,
  ZoneKind,
} from "./match";

export interface GameplayIntentBase<
  TKind extends GameplayIntentKind,
  TPayload,
> {
  intentId: string;
  kind: TKind;
  matchId: MatchId;
  payload: TPayload;
  seat: SeatId;
  stateVersion: number;
}

export interface KeepOpeningHandIntent
  extends GameplayIntentBase<"keepOpeningHand", Record<string, never>> {}

export interface TakeMulliganIntent
  extends GameplayIntentBase<
    "takeMulligan",
    {
      targetHandSize: number | null;
    }
  > {}

export interface PlayCardIntent
  extends GameplayIntentBase<
    "playCard",
    {
      alternativeCostId: string | null;
      cardInstanceId: CardInstanceId;
      sourceZone: ZoneKind;
      targetSlotId: string | null;
    }
  > {}

export interface ActivateAbilityIntent
  extends GameplayIntentBase<
    "activateAbility",
    {
      abilityId: string;
      sourceInstanceId: CardInstanceId;
    }
  > {}

export interface DeclareAttackersIntent
  extends GameplayIntentBase<
    "declareAttackers",
    {
      attackers: Array<{
        attackerId: CardInstanceId;
        defenderSeat: SeatId;
        laneId: string | null;
      }>;
    }
  > {}

export interface DeclareBlockersIntent
  extends GameplayIntentBase<
    "declareBlockers",
    {
      blocks: Array<{
        attackerId: CardInstanceId;
        blockerId: CardInstanceId;
      }>;
    }
  > {}

export interface AssignCombatDamageIntent
  extends GameplayIntentBase<
    "assignCombatDamage",
    {
      assignments: Array<{
        amount: number;
        sourceId: CardInstanceId;
        targetId: CardInstanceId | SeatId;
      }>;
    }
  > {}

export interface ChoosePromptOptionsIntent
  extends GameplayIntentBase<
    "choosePromptOptions",
    {
      choiceIds: string[];
      promptId: PromptId;
    }
  > {}

export interface ChooseTargetsIntent
  extends GameplayIntentBase<
    "chooseTargets",
    {
      promptId: PromptId;
      targetIds: string[];
    }
  > {}

export interface ChooseModesIntent
  extends GameplayIntentBase<
    "chooseModes",
    {
      modeIds: string[];
      promptId: PromptId;
    }
  > {}

export interface ChooseCostsIntent
  extends GameplayIntentBase<
    "chooseCosts",
    {
      costIds: string[];
      promptId: PromptId;
    }
  > {}

export interface PassPriorityIntent
  extends GameplayIntentBase<"passPriority", Record<string, never>> {}

export interface ToggleAutoPassIntent
  extends GameplayIntentBase<
    "toggleAutoPass",
    {
      enabled: boolean;
    }
  > {}

export interface ConcedeIntent
  extends GameplayIntentBase<
    "concede",
    {
      reason: "manual" | "disconnect" | "timeout";
    }
  > {}

export type GameplayIntent =
  | ActivateAbilityIntent
  | AssignCombatDamageIntent
  | ChooseCostsIntent
  | ChooseModesIntent
  | ChoosePromptOptionsIntent
  | ChooseTargetsIntent
  | ConcedeIntent
  | DeclareAttackersIntent
  | DeclareBlockersIntent
  | KeepOpeningHandIntent
  | PassPriorityIntent
  | PlayCardIntent
  | TakeMulliganIntent
  | ToggleAutoPassIntent;

export interface MatchEventBase<TKind extends MatchEventKind, TPayload> {
  at: number;
  eventId: string;
  kind: TKind;
  matchId: MatchId;
  payload: TPayload;
  sequence: number;
  stateVersion: number;
}

export interface MatchCreatedEvent
  extends MatchEventBase<
    "matchCreated",
    {
      shell: MatchShell;
    }
  > {}

export interface OpeningHandKeptEvent
  extends MatchEventBase<
    "openingHandKept",
    {
      seat: SeatId;
    }
  > {}

export interface MulliganTakenEvent
  extends MatchEventBase<
    "mulliganTaken",
    {
      handSize: number;
      seat: SeatId;
    }
  > {}

export interface CardsDrawnEvent
  extends MatchEventBase<
    "cardsDrawn",
    {
      count: number;
      seat: SeatId;
    }
  > {}

export interface CardPlayedEvent
  extends MatchEventBase<
    "cardPlayed",
    {
      cardInstanceId: CardInstanceId;
      seat: SeatId;
      toZone: ZoneKind;
    }
  > {}

export interface AbilityActivatedEvent
  extends MatchEventBase<
    "abilityActivated",
    {
      abilityId: string;
      seat: SeatId;
      sourceInstanceId: CardInstanceId;
    }
  > {}

export interface AttackersDeclaredEvent
  extends MatchEventBase<
    "attackersDeclared",
    {
      attackers: DeclareAttackersIntent["payload"]["attackers"];
      seat: SeatId;
    }
  > {}

export interface BlockersDeclaredEvent
  extends MatchEventBase<
    "blockersDeclared",
    {
      blocks: DeclareBlockersIntent["payload"]["blocks"];
      seat: SeatId;
    }
  > {}

export interface CombatDamageAssignedEvent
  extends MatchEventBase<
    "combatDamageAssigned",
    {
      assignments: AssignCombatDamageIntent["payload"]["assignments"];
    }
  > {}

export interface PromptOpenedEvent
  extends MatchEventBase<
    "promptOpened",
    {
      prompt: MatchPromptView;
    }
  > {}

export interface PromptResolvedEvent
  extends MatchEventBase<
    "promptResolved",
    {
      choiceIds: string[];
      promptId: PromptId;
      seat: SeatId;
    }
  > {}

export interface PriorityPassedEvent
  extends MatchEventBase<
    "priorityPassed",
    {
      seat: SeatId;
    }
  > {}

export interface PhaseAdvancedEvent
  extends MatchEventBase<
    "phaseAdvanced",
    {
      from: MatchPhase;
      to: MatchPhase;
    }
  > {}

export interface TurnAdvancedEvent
  extends MatchEventBase<
    "turnAdvanced",
    {
      activeSeat: SeatId;
      turnNumber: number;
    }
  > {}

export interface StackObjectCreatedEvent
  extends MatchEventBase<
    "stackObjectCreated",
    {
      controllerSeat: SeatId;
      label: string;
      stackId: StackObjectId;
    }
  > {}

export interface StackObjectResolvedEvent
  extends MatchEventBase<
    "stackObjectResolved",
    {
      resolution: "resolved" | "countered" | "fizzled";
      stackId: StackObjectId;
    }
  > {}

export interface CardMovedEvent
  extends MatchEventBase<
    "cardMoved",
    {
      cardInstanceId: CardInstanceId;
      fromZone: ZoneKind;
      publicReason: string;
      toZone: ZoneKind;
    }
  > {}

export interface LifeTotalChangedEvent
  extends MatchEventBase<
    "lifeTotalChanged",
    {
      from: number;
      reason: string;
      seat: SeatId;
      to: number;
    }
  > {}

export interface AutoPassToggledEvent
  extends MatchEventBase<
    "autoPassToggled",
    {
      enabled: boolean;
      seat: SeatId;
    }
  > {}

export interface PlayerConcededEvent
  extends MatchEventBase<
    "playerConceded",
    {
      reason: ConcedeIntent["payload"]["reason"];
      seat: SeatId;
    }
  > {}

export interface MatchCompletedEvent
  extends MatchEventBase<
    "matchCompleted",
    {
      reason:
        | "administrative"
        | "concession"
        | "draw"
        | "elimination"
        | "objective";
      winnerSeat: SeatId | null;
    }
  > {}

export type MatchEvent =
  | AbilityActivatedEvent
  | AttackersDeclaredEvent
  | AutoPassToggledEvent
  | BlockersDeclaredEvent
  | CardsDrawnEvent
  | CardMovedEvent
  | CardPlayedEvent
  | CombatDamageAssignedEvent
  | LifeTotalChangedEvent
  | MatchCompletedEvent
  | MatchCreatedEvent
  | MulliganTakenEvent
  | OpeningHandKeptEvent
  | PhaseAdvancedEvent
  | PlayerConcededEvent
  | PriorityPassedEvent
  | PromptOpenedEvent
  | PromptResolvedEvent
  | StackObjectCreatedEvent
  | StackObjectResolvedEvent
  | TurnAdvancedEvent;
