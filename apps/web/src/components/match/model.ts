import type {
  CardCatalogEntry,
  MatchCardView,
  MatchSeatView,
  MatchSpectatorView,
  MatchView,
  MatchZoneView,
  ZoneKind,
} from "@lunchtable/shared-types";

export type MatchRenderMode = "seat" | "spectator";

export interface ActivatedAbilityAction {
  abilityId: string;
  cardName: string;
  instanceId: string;
  text: string;
  targetIds?: string[];
  targetLabel?: string;
}

export interface CombatAction {
  assignments?: Array<{
    amount: number;
    sourceId: string;
    targetId: string;
  }>;
  attackers?: Array<{
    attackerId: string;
    defenderSeat: string;
    laneId: string | null;
  }>;
  blocks?: Array<{
    attackerId: string;
    blockerId: string;
  }>;
  kind: "assignCombatDamage" | "declareAttackers" | "declareBlockers";
  label: string;
}

function getBattlefieldCards(view: MatchSeatView) {
  return view.zones.flatMap((zone) =>
    zone.zone === "battlefield" ? zone.cards : [],
  );
}

function getOpponentSeat(view: MatchSeatView) {
  return view.seats.find((seat) => seat.seat !== view.viewerSeat)?.seat ?? null;
}

function canAttack(card: MatchCardView, seat: string) {
  return (
    card.controllerSeat === seat &&
    (card.statLine?.power ?? 0) > 0 &&
    !card.annotations.includes("summoningSick")
  );
}

function canBlock(
  blocker: MatchCardView,
  attacker: MatchCardView,
  seat: string,
) {
  return (
    blocker.controllerSeat === seat &&
    (blocker.statLine?.power ?? 0) > 0 &&
    (blocker.statLine?.toughness ?? 0) > 0 &&
    (!attacker.keywords.includes("flying") ||
      blocker.keywords.includes("flying"))
  );
}

function listAttackerSubsets(cards: MatchCardView[]) {
  const limitedCards = cards.slice(0, 4);
  const subsets: MatchCardView[][] = [[]];

  for (const card of limitedCards) {
    const nextSubsets = subsets.map((subset) => [...subset, card]);
    subsets.push(...nextSubsets);
  }

  return subsets.sort((left, right) => right.length - left.length);
}

function buildDefaultCombatAssignments(view: MatchSeatView) {
  const battlefieldById = new Map(
    getBattlefieldCards(view).map((card) => [card.instanceId, card]),
  );
  const blockerByAttacker = new Map(
    view.combat.blocks.map((block) => [block.attackerId, block.blockerId]),
  );

  return view.combat.attackers
    .flatMap((attacker) => {
      const attackerCard = battlefieldById.get(attacker.attackerId);
      const attackerPower = attackerCard?.statLine?.power ?? 0;
      if (attackerPower <= 0) {
        return [];
      }

      const assignments: CombatAction["assignments"] = [
        {
          amount: attackerPower,
          sourceId: attacker.attackerId,
          targetId:
            blockerByAttacker.get(attacker.attackerId) ?? attacker.defenderSeat,
        },
      ];

      const blockerId = blockerByAttacker.get(attacker.attackerId);
      if (!blockerId) {
        return assignments;
      }

      const blockerCard = battlefieldById.get(blockerId);
      const blockerPower = blockerCard?.statLine?.power ?? 0;
      if (blockerPower <= 0) {
        return assignments;
      }

      assignments.push({
        amount: blockerPower,
        sourceId: blockerId,
        targetId: attacker.attackerId,
      });
      return assignments;
    })
    .sort((left, right) => {
      if (left.sourceId === right.sourceId) {
        return left.targetId.localeCompare(right.targetId);
      }
      return left.sourceId.localeCompare(right.sourceId);
    });
}

function listTargetCandidates(input: {
  sourceInstanceId: string;
  targetSelector:
    | "anyCard"
    | "friendlyUnit"
    | "opposingUnit"
    | "player"
    | "self"
    | "stackObject";
  view: MatchSeatView;
}) {
  const battlefield = getBattlefieldCards(input.view);

  switch (input.targetSelector) {
    case "self":
      return battlefield.filter(
        (card) => card.instanceId === input.sourceInstanceId,
      );
    case "friendlyUnit":
      return battlefield.filter(
        (card) => card.controllerSeat === input.view.viewerSeat,
      );
    case "opposingUnit":
      return battlefield.filter(
        (card) => card.controllerSeat !== input.view.viewerSeat,
      );
    default:
      return [];
  }
}

export interface MatchCinematicCue {
  accentSeat: string | null;
  cardId?: string;
  cardName: string;
  eventSequence: number;
  focusInstanceId: string | null;
  kind: "ability" | "summon";
  kicker: string;
  label: string;
}

export function resolveRenderableView(input: {
  preferredMode: MatchRenderMode;
  seatView: MatchSeatView | null;
  spectatorView: MatchSpectatorView | null;
}): {
  mode: MatchRenderMode;
  view: MatchView | null;
} {
  if (input.preferredMode === "seat" && input.seatView) {
    return {
      mode: "seat",
      view: input.seatView,
    };
  }

  if (input.spectatorView) {
    return {
      mode: "spectator",
      view: input.spectatorView,
    };
  }

  return {
    mode: "seat",
    view: input.seatView,
  };
}

export function getZoneView(
  view: MatchView,
  ownerSeat: string,
  zone: ZoneKind,
): MatchZoneView | null {
  return (
    view.zones.find(
      (candidate) =>
        candidate.ownerSeat === ownerSeat && candidate.zone === zone,
    ) ?? null
  );
}

export function listActivatedAbilityActions(
  catalog: CardCatalogEntry[],
  view: MatchSeatView | null,
): ActivatedAbilityAction[] {
  if (!view || !view.availableIntents.includes("activateAbility")) {
    return [];
  }

  const battlefield = getZoneView(view, view.viewerSeat, "battlefield");
  if (!battlefield) {
    return [];
  }

  return battlefield.cards.flatMap((card) => {
    const entry = catalog.find((candidate) => candidate.cardId === card.cardId);
    if (!entry) {
      return [];
    }

    return entry.abilities
      .filter((ability) => ability.kind === "activated")
      .flatMap((ability) => {
        if (!ability.requiresTargets) {
          return [
            {
              abilityId: ability.id,
              cardName: entry.name,
              instanceId: card.instanceId,
              text: ability.text,
            },
          ];
        }

        if ((ability.targets?.length ?? 0) !== 1) {
          return [];
        }

        const [targetSpec] = ability.targets ?? [];
        if (
          !targetSpec ||
          targetSpec.minSelections !== 1 ||
          targetSpec.maxSelections !== 1
        ) {
          return [];
        }

        return listTargetCandidates({
          sourceInstanceId: card.instanceId,
          targetSelector: targetSpec.selector,
          view,
        }).map((targetCard) => ({
          abilityId: ability.id,
          cardName: entry.name,
          instanceId: card.instanceId,
          targetIds: [targetCard.instanceId],
          targetLabel: targetCard.name,
          text: `${ability.text} -> ${targetCard.name}`,
        }));
      });
  });
}

export function listCombatActions(view: MatchSeatView | null): CombatAction[] {
  if (!view) {
    return [];
  }

  if (view.availableIntents.includes("assignCombatDamage")) {
    return [
      {
        assignments: buildDefaultCombatAssignments(view),
        kind: "assignCombatDamage",
        label: "Resolve combat damage",
      },
    ];
  }

  if (view.availableIntents.includes("declareBlockers")) {
    const battlefieldById = new Map(
      getBattlefieldCards(view).map((card) => [card.instanceId, card]),
    );
    const attackers = view.combat.attackers
      .map((attacker) => battlefieldById.get(attacker.attackerId))
      .filter((card): card is MatchCardView => card !== undefined);
    const blockers =
      getZoneView(view, view.viewerSeat, "battlefield")?.cards ?? [];

    return [
      {
        blocks: [],
        kind: "declareBlockers",
        label: "Declare no blocks",
      },
      ...attackers.flatMap((attacker) =>
        blockers
          .filter((blocker) => canBlock(blocker, attacker, view.viewerSeat))
          .map((blocker) => ({
            blocks: [
              {
                attackerId: attacker.instanceId,
                blockerId: blocker.instanceId,
              },
            ],
            kind: "declareBlockers" as const,
            label: `Block ${attacker.name} with ${blocker.name}`,
          })),
      ),
    ];
  }

  if (view.availableIntents.includes("declareAttackers")) {
    const defenderSeat = getOpponentSeat(view);
    if (!defenderSeat) {
      return [];
    }

    const attackers = (
      getZoneView(view, view.viewerSeat, "battlefield")?.cards ?? []
    ).filter((card) => canAttack(card, view.viewerSeat));

    return listAttackerSubsets(attackers).map((subset) => ({
      attackers: subset.map((card) => ({
        attackerId: card.instanceId,
        defenderSeat,
        laneId: null,
      })),
      kind: "declareAttackers" as const,
      label:
        subset.length === 0
          ? "Skip attacks"
          : `Attack with ${subset.map((card) => card.name).join(", ")}`,
    }));
  }

  return [];
}

export function deriveMatchCinematicCue(
  view: MatchView | null,
): MatchCinematicCue | null {
  const latest = view?.recentEvents.at(-1);
  if (!latest) {
    return null;
  }

  if (
    latest.kind === "cardPlayed" &&
    latest.cardName &&
    latest.toZone === "battlefield"
  ) {
    return {
      accentSeat: latest.seat,
      cardId: latest.cardId,
      cardName: latest.cardName,
      eventSequence: latest.sequence,
      focusInstanceId: latest.focusInstanceId ?? null,
      kind: "summon",
      kicker: "Summon sequence",
      label: latest.label,
    };
  }

  if (latest.kind === "abilityActivated" && latest.cardName) {
    return {
      accentSeat: latest.seat,
      cardId: latest.cardId,
      cardName: latest.cardName,
      eventSequence: latest.sequence,
      focusInstanceId: latest.focusInstanceId ?? null,
      kind: "ability",
      kicker: latest.abilityId
        ? `Ability ignition · ${latest.abilityId}`
        : "Ability ignition",
      label: latest.label,
    };
  }

  return null;
}
