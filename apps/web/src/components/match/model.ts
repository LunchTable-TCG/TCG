import type {
  CardCatalogEntry,
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

function getBattlefieldCards(view: MatchSeatView) {
  return view.zones.flatMap((zone) =>
    zone.zone === "battlefield" ? zone.cards : [],
  );
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
