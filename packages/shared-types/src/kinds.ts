export const AUTHORITATIVE_INTENT_KINDS = [
  "keepOpeningHand",
  "takeMulligan",
  "playCard",
  "activateAbility",
  "declareAttackers",
  "declareBlockers",
  "assignCombatDamage",
  "choosePromptOptions",
  "chooseTargets",
  "chooseModes",
  "chooseCosts",
  "passPriority",
  "toggleAutoPass",
  "concede",
] as const;

export type GameplayIntentKind = (typeof AUTHORITATIVE_INTENT_KINDS)[number];

export const MATCH_EVENT_KINDS = [
  "matchCreated",
  "openingHandKept",
  "mulliganTaken",
  "cardsDrawn",
  "cardPlayed",
  "abilityActivated",
  "attackersDeclared",
  "blockersDeclared",
  "combatDamageAssigned",
  "promptOpened",
  "promptResolved",
  "priorityPassed",
  "phaseAdvanced",
  "turnAdvanced",
  "stackObjectCreated",
  "stackObjectResolved",
  "cardMoved",
  "lifeTotalChanged",
  "autoPassToggled",
  "playerConceded",
  "matchCompleted",
] as const;

export type MatchEventKind = (typeof MATCH_EVENT_KINDS)[number];
