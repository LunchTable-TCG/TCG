import type { GamePackManifest } from "./pack";
import {
  type GamePackValidationResult,
  type PortableGamePackAdmissionInput,
  validatePortableGamePack,
} from "./pack";
import type { TabletopObject, TabletopSeat, TabletopZone } from "./primitives";

export interface PortablePackRulesetDraft {
  legalIntents: Array<{ kind: string }>;
  phases: string[];
  victory: Record<string, string>;
}

export interface PortablePackObjectsDraft
  extends PortableGamePackAdmissionInput {
  objects: TabletopObject[];
  seats: TabletopSeat[];
  zones: TabletopZone[];
}

export interface PortablePackEditorInput {
  game: GamePackManifest;
  objects: PortablePackObjectsDraft;
  ruleset: PortablePackRulesetDraft;
}

export interface PortablePackEditorSummary {
  legalIntentCount: number;
  objectCount: number;
  phaseCount: number;
  seatCount: number;
  zoneCount: number;
}

export interface PortablePackEditorDraft extends PortablePackEditorInput {
  summary: PortablePackEditorSummary;
  validation: GamePackValidationResult;
}

export type PortablePackEditorExport = Record<
  "game.json" | "objects.json" | "ruleset.json",
  string
>;

export function createPortablePackEditorDraft(
  input: PortablePackEditorInput,
): PortablePackEditorDraft {
  return createDraft({
    game: { ...input.game },
    objects: {
      objects: input.objects.objects.map((object) => ({ ...object })),
      seats: input.objects.seats.map((seat) => ({
        ...seat,
        permissions: [...seat.permissions],
      })),
      zones: input.objects.zones.map((zone) => ({ ...zone })),
    },
    ruleset: {
      legalIntents: input.ruleset.legalIntents.map((intent) => ({
        ...intent,
      })),
      phases: [...input.ruleset.phases],
      victory: { ...input.ruleset.victory },
    },
  });
}

export function addObjectToPortablePackDraft(
  draft: PortablePackEditorDraft,
  object: TabletopObject,
): PortablePackEditorDraft {
  return createDraft({
    game: draft.game,
    objects: {
      ...draft.objects,
      objects: [...draft.objects.objects, { ...object }],
    },
    ruleset: draft.ruleset,
  });
}

export function exportPortablePackDraft(
  draft: PortablePackEditorDraft,
): PortablePackEditorExport {
  return {
    "game.json": `${JSON.stringify(draft.game, null, 2)}\n`,
    "objects.json": `${JSON.stringify(draft.objects, null, 2)}\n`,
    "ruleset.json": `${JSON.stringify(draft.ruleset, null, 2)}\n`,
  };
}

function createDraft(input: PortablePackEditorInput): PortablePackEditorDraft {
  const validation = validatePortableGamePack(input.objects);

  return {
    ...input,
    summary: {
      legalIntentCount: input.ruleset.legalIntents.length,
      objectCount: input.objects.objects.length,
      phaseCount: input.ruleset.phases.length,
      seatCount: input.objects.seats.length,
      zoneCount: input.objects.zones.length,
    },
    validation,
  };
}
