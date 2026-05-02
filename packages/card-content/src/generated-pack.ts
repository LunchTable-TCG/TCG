import type {
  GamePack,
  GamePackManifest,
  GamePackValidationIssue,
  GamePackValidationResult,
  TabletopObject,
  TabletopSeat,
  TabletopZone,
} from "@lunchtable/games-tabletop";

import { starterFormat } from "./formats";

type GeneratedCardTabletopPackManifest = GamePackManifest & {
  runtimeVersion: "0.1.0";
  title: "Standard Alpha Card Duel";
};

type GeneratedCardTabletopPackRuleset = GamePack<
  null,
  null,
  never,
  never,
  null,
  null,
  null
>;

export type GeneratedCardTabletopPack = GeneratedCardTabletopPackRuleset & {
  manifest: GeneratedCardTabletopPackManifest;
  objects: TabletopObject[];
  seats: TabletopSeat[];
  zones: TabletopZone[];
};

export type GeneratedCardTabletopPackValidationIssue =
  GamePackValidationIssue & {
    code: "duplicateObjectId" | "duplicateSeatId" | "duplicateZoneId";
  };

export type GeneratedCardTabletopPackValidationResult = Omit<
  GamePackValidationResult,
  "issues" | "valid"
> & {
  issues: GeneratedCardTabletopPackValidationIssue[];
  ok: boolean;
};

const seatIds = ["seat-0", "seat-1"] as const;

function createSeatZones(seatId: (typeof seatIds)[number]): TabletopZone[] {
  return [
    {
      id: `${seatId}-deck`,
      kind: "deck",
      name: `${seatId} Deck`,
      ordering: "ordered",
      ownerSeat: seatId,
      visibility: "private-owner",
    },
    {
      id: `${seatId}-hand`,
      kind: "hand",
      name: `${seatId} Hand`,
      ordering: "ordered",
      ownerSeat: seatId,
      visibility: "private-owner",
    },
    {
      id: `${seatId}-board`,
      kind: "board",
      name: `${seatId} Board`,
      ordering: "unordered",
      ownerSeat: seatId,
      visibility: "public",
    },
    {
      id: `${seatId}-discard`,
      kind: "discard",
      name: `${seatId} Discard`,
      ordering: "ordered",
      ownerSeat: seatId,
      visibility: "public",
    },
  ];
}

function collectDuplicateIssues(
  ids: string[],
  code: GeneratedCardTabletopPackValidationIssue["code"],
  label: "object" | "seat" | "zone",
): GeneratedCardTabletopPackValidationIssue[] {
  const seen = new Set<string>();
  const reported = new Set<string>();
  const issues: GeneratedCardTabletopPackValidationIssue[] = [];

  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      continue;
    }

    if (reported.has(id)) {
      continue;
    }

    reported.add(id);
    issues.push({
      code,
      message: `${id}: duplicate ${label} id`,
      path: label,
      severity: "error",
    });
  }

  return issues;
}

export function createGeneratedCardTabletopPack(): GeneratedCardTabletopPack {
  return {
    manifest: {
      description: "Generated tabletop admission pack for Standard Alpha.",
      id: "standard-alpha-card-duel",
      name: "Standard Alpha Card Duel",
      runtimeVersion: "0.1.0",
      title: "Standard Alpha Card Duel",
      version: "0.1.0",
    },
    objects: starterFormat.cardPool.map((card) => ({
      id: card.id,
      kind: "card",
      name: card.name,
      ownerSeat: null,
      state: "ready",
      visibility: "public",
      zoneId: "catalog",
    })),
    ruleset: {
      applyIntent: (state) => ({
        events: [],
        nextState: state,
        outcome: "noop",
      }),
      createInitialState: () => null,
      deriveRenderScene: () => null,
      deriveSeatView: () => null,
      deriveSpectatorView: () => null,
      listLegalIntents: () => [],
    },
    seats: seatIds.map((seatId, index) => ({
      actorType: "human",
      id: seatId,
      name: `Seat ${index}`,
      permissions: ["submitIntent"],
      status: "ready",
    })),
    zones: [
      {
        id: "catalog",
        kind: "deck",
        name: "Catalog",
        ordering: "ordered",
        ownerSeat: null,
        visibility: "public",
      },
      ...seatIds.flatMap(createSeatZones),
    ],
  };
}

export function validateGeneratedCardTabletopPack(
  pack: GeneratedCardTabletopPack,
): GeneratedCardTabletopPackValidationResult {
  const issues = [
    ...collectDuplicateIssues(
      pack.objects.map((object) => object.id),
      "duplicateObjectId",
      "object",
    ),
    ...collectDuplicateIssues(
      pack.seats.map((seat) => seat.id),
      "duplicateSeatId",
      "seat",
    ),
    ...collectDuplicateIssues(
      pack.zones.map((zone) => zone.id),
      "duplicateZoneId",
      "zone",
    ),
  ];

  return {
    issues,
    ok: issues.length === 0,
  };
}
