import type {
  MatchCardView,
  MatchEventSummary,
  MatchSeatView,
  MatchView,
  SeatId,
  ZoneKind,
} from "@lunchtable/shared-types";

export interface BoardViewport {
  height: number;
  width: number;
}

export type BoardCueKind =
  | "combat"
  | "entry"
  | "phase"
  | "stack"
  | "turn"
  | "warning";

export interface BoardCue {
  accentSeat: SeatId | null;
  eventSequence: number;
  kind: BoardCueKind;
  label: string;
}

export interface BoardSceneSeat {
  lane: "away" | "home";
  lifeTotal: number;
  name: string;
  resourceLabel: string;
  resourceText: string;
  seat: SeatId;
}

export interface BoardSceneCard {
  cardId: string;
  controllerSeat: SeatId;
  height: number;
  instanceId: string;
  interactive: boolean;
  isFaceUp: boolean;
  isSelected: boolean;
  label: string;
  keywords: string[];
  lane: "away" | "home";
  statLine: string | null;
  width: number;
  x: number;
  y: number;
  zone: ZoneKind;
}

export interface BoardSceneStackItem {
  label: string;
  stackId: string;
  x: number;
  y: number;
}

export interface BoardSceneModel {
  cardCount: number;
  cue: BoardCue | null;
  headline: string;
  homeSeat: BoardSceneSeat | null;
  seats: BoardSceneSeat[];
  stack: BoardSceneStackItem[];
  viewport: BoardViewport;
  visibleCards: BoardSceneCard[];
}

interface OrderedSeat {
  lane: "away" | "home";
  seat: MatchView["seats"][number];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSeatOrder(view: MatchView): OrderedSeat[] {
  const seats = [...view.seats];

  if (seats.length <= 1) {
    return seats.map((seat) => ({
      lane: "home" as const,
      seat,
    }));
  }

  let homeSeatId: SeatId | null = null;
  if (view.kind === "seat") {
    homeSeatId = view.viewerSeat;
  } else {
    homeSeatId = view.match.activeSeat ?? seats[0]?.seat ?? null;
  }

  const homeIndex = seats.findIndex((seat) => seat.seat === homeSeatId);
  if (homeIndex <= 0) {
    return seats.map((seat, index) => ({
      lane: index === seats.length - 1 ? "home" : "away",
      seat,
    }));
  }

  const homeSeat = seats.splice(homeIndex, 1)[0];
  if (!homeSeat) {
    return seats.map((seat, index) => ({
      lane: index === seats.length - 1 ? "home" : "away",
      seat,
    }));
  }

  return [...seats, homeSeat].map((seat, index, ordered) => ({
    lane: index === ordered.length - 1 ? "home" : "away",
    seat,
  }));
}

function describeCard(card: MatchCardView) {
  const statLine =
    card.statLine !== null
      ? `${card.statLine.power ?? "?"}/${card.statLine.toughness ?? "?"}`
      : null;

  return {
    keywords: card.keywords,
    label:
      card.visibility === "public" || card.visibility === "private-self"
        ? card.name
        : "Hidden card",
    statLine,
  };
}

function createPlaceholderCards(input: {
  cardCount: number;
  lane: "away" | "home";
  ownerSeat: SeatId;
  viewport: BoardViewport;
  zone: ZoneKind;
}): BoardSceneCard[] {
  const count = clamp(input.cardCount, 1, 7);
  const spacing = clamp(input.viewport.width * 0.08, 42, 74);
  const width = clamp(input.viewport.width * 0.092, 60, 96);
  const height = width * 1.38;
  const baseY =
    input.lane === "home"
      ? input.viewport.height * 0.79
      : input.viewport.height * 0.07;
  const startX = input.viewport.width * 0.5 - ((count - 1) * spacing) / 2;

  return Array.from({ length: count }, (_, index) => ({
    cardId: `${input.zone}:hidden`,
    controllerSeat: input.ownerSeat,
    height,
    instanceId: `${input.ownerSeat}:${input.zone}:hidden:${index + 1}`,
    interactive: false,
    isFaceUp: false,
    isSelected: false,
    keywords: [],
    label: "Hidden card",
    lane: input.lane,
    statLine: null,
    width,
    x: startX + index * spacing,
    y: baseY,
    zone: input.zone,
  }));
}

function layoutZoneCards(input: {
  cards: MatchCardView[];
  lane: "away" | "home";
  selectedCardId: string | null;
  viewport: BoardViewport;
  zone: ZoneKind;
}): BoardSceneCard[] {
  if (input.cards.length === 0) {
    return [];
  }

  const zoneWidth =
    input.zone === "battlefield"
      ? clamp(input.viewport.width * 0.62, 320, 760)
      : clamp(input.viewport.width * 0.54, 260, 620);
  const spacing =
    input.zone === "battlefield"
      ? clamp(zoneWidth / Math.max(input.cards.length, 1), 78, 114)
      : clamp(zoneWidth / Math.max(input.cards.length, 1), 34, 66);
  const width =
    input.zone === "battlefield"
      ? clamp(input.viewport.width * 0.1, 74, 104)
      : clamp(input.viewport.width * 0.085, 58, 92);
  const height = width * 1.38;
  const startX =
    input.viewport.width * 0.5 - ((input.cards.length - 1) * spacing) / 2;
  const baseY =
    input.zone === "battlefield"
      ? input.lane === "home"
        ? input.viewport.height * 0.52
        : input.viewport.height * 0.24
      : input.lane === "home"
        ? input.viewport.height * 0.79
        : input.viewport.height * 0.07;

  return input.cards.map((card, index) => {
    const description = describeCard(card);
    const selectedOffset = input.selectedCardId === card.instanceId ? 18 : 0;

    return {
      cardId: card.cardId,
      controllerSeat: card.controllerSeat,
      height,
      instanceId: card.instanceId,
      interactive: input.zone === "battlefield" || input.zone === "hand",
      isFaceUp:
        card.visibility === "public" || card.visibility === "private-self",
      isSelected: input.selectedCardId === card.instanceId,
      keywords: description.keywords,
      label: description.label,
      lane: input.lane,
      statLine: description.statLine,
      width,
      x: startX + index * spacing,
      y: baseY - selectedOffset,
      zone: input.zone,
    };
  });
}

function getZoneCards(
  view: MatchView,
  ownerSeat: SeatId,
  zone: ZoneKind,
): MatchCardView[] {
  return (
    view.zones.find(
      (candidate) =>
        candidate.ownerSeat === ownerSeat && candidate.zone === zone,
    )?.cards ?? []
  );
}

function getZoneCount(view: MatchView, ownerSeat: SeatId, zone: ZoneKind) {
  return (
    view.zones.find(
      (candidate) =>
        candidate.ownerSeat === ownerSeat && candidate.zone === zone,
    )?.cardCount ?? 0
  );
}

function buildZoneCards(input: {
  lane: "away" | "home";
  ownerSeat: SeatId;
  selectedCardId: string | null;
  view: MatchView;
  viewport: BoardViewport;
  zone: ZoneKind;
}): BoardSceneCard[] {
  const visibleCards = getZoneCards(input.view, input.ownerSeat, input.zone);
  if (visibleCards.length > 0) {
    return layoutZoneCards({
      cards: visibleCards,
      lane: input.lane,
      selectedCardId: input.selectedCardId,
      viewport: input.viewport,
      zone: input.zone,
    });
  }

  const cardCount = getZoneCount(input.view, input.ownerSeat, input.zone);
  if (cardCount === 0) {
    return [];
  }

  return createPlaceholderCards({
    cardCount,
    lane: input.lane,
    ownerSeat: input.ownerSeat,
    viewport: input.viewport,
    zone: input.zone,
  });
}

export function deriveBoardCue(
  recentEvents: MatchEventSummary[],
  phase: string,
): BoardCue | null {
  const latest = recentEvents.at(-1);
  if (!latest) {
    if (phase === "attack" || phase === "block" || phase === "damage") {
      return {
        accentSeat: null,
        eventSequence: 0,
        kind: "combat",
        label: `Combat window · ${phase}`,
      };
    }

    return null;
  }

  if (
    latest.kind === "stackObjectCreated" ||
    latest.kind === "stackObjectResolved" ||
    latest.kind === "abilityActivated"
  ) {
    return {
      accentSeat: latest.seat,
      eventSequence: latest.sequence,
      kind: "stack",
      label: latest.label,
    };
  }

  if (
    latest.kind === "attackersDeclared" ||
    latest.kind === "blockersDeclared" ||
    latest.kind === "combatDamageAssigned"
  ) {
    return {
      accentSeat: latest.seat,
      eventSequence: latest.sequence,
      kind: "combat",
      label: latest.label,
    };
  }

  if (latest.kind === "cardPlayed" || latest.kind === "cardMoved") {
    return {
      accentSeat: latest.seat,
      eventSequence: latest.sequence,
      kind: "entry",
      label: latest.label,
    };
  }

  if (latest.kind === "phaseAdvanced") {
    return {
      accentSeat: latest.seat,
      eventSequence: latest.sequence,
      kind: "phase",
      label: latest.label,
    };
  }

  if (latest.kind === "turnAdvanced") {
    return {
      accentSeat: latest.seat,
      eventSequence: latest.sequence,
      kind: "turn",
      label: latest.label,
    };
  }

  return {
    accentSeat: latest.seat,
    eventSequence: latest.sequence,
    kind: "warning",
    label: latest.label,
  };
}

export function createBoardSceneModel(input: {
  selectedCardId: string | null;
  view: MatchView;
  viewport: BoardViewport;
}): BoardSceneModel {
  const orderedSeats = getSeatOrder(input.view);
  const seats = orderedSeats.map(({ lane, seat }) => ({
    lane,
    lifeTotal: seat.lifeTotal,
    name: seat.username ?? seat.seat,
    resourceLabel: seat.resources[0]?.label ?? "Resource",
    resourceText:
      seat.resources.length > 0
        ? seat.resources
            .map((resource) =>
              resource.maximum === null
                ? `${resource.label} ${resource.current}`
                : `${resource.label} ${resource.current}/${resource.maximum}`,
            )
            .join(" · ")
        : "No resources",
    seat: seat.seat,
  }));

  const visibleCards = orderedSeats.flatMap(({ lane, seat }) => [
    ...buildZoneCards({
      lane,
      ownerSeat: seat.seat,
      selectedCardId: input.selectedCardId,
      view: input.view,
      viewport: input.viewport,
      zone: "battlefield",
    }),
    ...buildZoneCards({
      lane,
      ownerSeat: seat.seat,
      selectedCardId: input.selectedCardId,
      view: input.view,
      viewport: input.viewport,
      zone: "hand",
    }),
  ]);

  const stack = input.view.stack.map((item, index) => ({
    label: item.label,
    stackId: item.stackId,
    x: input.viewport.width * 0.84,
    y: input.viewport.height * 0.34 + index * 48,
  }));

  return {
    cardCount: visibleCards.length,
    cue: deriveBoardCue(input.view.recentEvents, input.view.match.phase),
    headline:
      input.view.kind === "seat"
        ? `${input.view.viewerSeat} seat board`
        : "Spectator battlefield",
    homeSeat: seats.find((seat) => seat.lane === "home") ?? null,
    seats,
    stack,
    viewport: input.viewport,
    visibleCards,
  };
}
