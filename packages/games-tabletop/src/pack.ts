import type { GameRuleset } from "@lunchtable/games-core";
import type { TabletopAssetRef, TabletopComponent } from "./components";
import type { TabletopObject, TabletopSeat, TabletopZone } from "./primitives";

export type GameGenre =
  | "arena-shooter-3d"
  | "card-tabletop"
  | "custom"
  | "dice-tabletop"
  | "side-scroller";

export type GamePackExtensionLevel = 1 | 2 | 3 | 4;

export interface GamePackManifest {
  description: string;
  extensionLevel?: GamePackExtensionLevel;
  genre?: GameGenre;
  id: string;
  name: string;
  runtime?: "lunchtable";
  runtimeVersion?: string;
  version: string;
}

export interface GamePack<
  TConfig,
  TState,
  TIntent,
  TEvent,
  TSeatView,
  TSpectatorView,
  TScene,
> {
  manifest: GamePackManifest;
  ruleset: GameRuleset<
    TConfig,
    TState,
    TIntent,
    TEvent,
    TSeatView,
    TSpectatorView,
    TScene
  >;
}

export type GamePackValidationIssueCode =
  | "duplicateObjectId"
  | "duplicateSeatId"
  | "duplicateZoneId"
  | "unknownObjectOwnerSeat"
  | "unknownObjectZone"
  | "unknownZoneOwnerSeat";

export interface GamePackValidationIssue {
  code: GamePackValidationIssueCode;
  message: string;
  path: string;
  severity: "error" | "warning";
}

export interface GamePackValidationSummary {
  objectCount: number;
  seatCount: number;
  zoneCount: number;
}

export interface GamePackValidationResult {
  issues: GamePackValidationIssue[];
  ok: boolean;
  summary: GamePackValidationSummary;
  valid: boolean;
}

export interface GamePackScenario {
  id: string;
  name: string;
  setupId: string;
}

export interface PortableGamePack {
  assets: TabletopAssetRef[];
  components?: TabletopComponent[];
  manifest: GamePackManifest;
  objects: TabletopObject[];
  scenarios: GamePackScenario[];
  seats: TabletopSeat[];
  zones: TabletopZone[];
}

export interface PortableGamePackAdmissionInput {
  objects: readonly TabletopObject[];
  seats: readonly TabletopSeat[];
  zones: readonly TabletopZone[];
}

export function validatePortableGamePack(
  pack: PortableGamePackAdmissionInput,
): GamePackValidationResult {
  const knownSeatIds = new Set(pack.seats.map((seat) => seat.id));
  const knownZoneIds = new Set(pack.zones.map((zone) => zone.id));
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
    ...pack.objects.flatMap((object) =>
      collectObjectReferenceIssues(object, knownSeatIds, knownZoneIds),
    ),
    ...pack.zones.flatMap((zone) =>
      collectZoneReferenceIssues(zone, knownSeatIds),
    ),
  ];

  return {
    issues,
    ok: issues.length === 0,
    summary: {
      objectCount: pack.objects.length,
      seatCount: pack.seats.length,
      zoneCount: pack.zones.length,
    },
    valid: issues.length === 0,
  };
}

function collectObjectReferenceIssues(
  object: TabletopObject,
  knownSeatIds: ReadonlySet<string>,
  knownZoneIds: ReadonlySet<string>,
): GamePackValidationIssue[] {
  const issues: GamePackValidationIssue[] = [];

  if (!knownZoneIds.has(object.zoneId)) {
    issues.push(
      createGamePackValidationIssue(
        "unknownObjectZone",
        `${object.id}: unknown object zone ${object.zoneId}`,
        "object.zoneId",
      ),
    );
  }

  if (object.ownerSeat !== null && !knownSeatIds.has(object.ownerSeat)) {
    issues.push(
      createGamePackValidationIssue(
        "unknownObjectOwnerSeat",
        `${object.id}: unknown object owner seat ${object.ownerSeat}`,
        "object.ownerSeat",
      ),
    );
  }

  return issues;
}

function collectZoneReferenceIssues(
  zone: TabletopZone,
  knownSeatIds: ReadonlySet<string>,
): GamePackValidationIssue[] {
  if (zone.ownerSeat === null || knownSeatIds.has(zone.ownerSeat)) {
    return [];
  }

  return [
    createGamePackValidationIssue(
      "unknownZoneOwnerSeat",
      `${zone.id}: unknown zone owner seat ${zone.ownerSeat}`,
      "zone.ownerSeat",
    ),
  ];
}

function collectDuplicateIssues(
  ids: readonly string[],
  code: "duplicateObjectId" | "duplicateSeatId" | "duplicateZoneId",
  label: "object" | "seat" | "zone",
): GamePackValidationIssue[] {
  const seen = new Set<string>();
  const reported = new Set<string>();
  const issues: GamePackValidationIssue[] = [];

  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      continue;
    }

    if (reported.has(id)) {
      continue;
    }

    reported.add(id);
    issues.push(
      createGamePackValidationIssue(
        code,
        `${id}: duplicate ${label} id`,
        label,
      ),
    );
  }

  return issues;
}

function createGamePackValidationIssue(
  code: GamePackValidationIssueCode,
  message: string,
  path: string,
): GamePackValidationIssue {
  return {
    code,
    message,
    path,
    severity: "error",
  };
}
