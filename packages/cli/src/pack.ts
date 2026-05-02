import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  type GamePackValidationIssueCode,
  type TabletopObject,
  type TabletopObjectKind,
  type TabletopSeat,
  type TabletopVisibility,
  type TabletopZone,
  validatePortableGamePack,
} from "@lunchtable/games-tabletop";

export interface PortablePackValidationIssue {
  code:
    | GamePackValidationIssueCode
    | "invalidGameManifest"
    | "invalidObjectsFile"
    | "invalidRulesetFile"
    | "missingFile"
    | "runtimeMismatch";
  message: string;
  path: string;
  severity: "error";
}

export interface PortablePackValidationSummary {
  legalIntentCount: number;
  objectCount: number;
  seatCount: number;
  zoneCount: number;
}

export interface PortablePackValidationResult {
  issues: PortablePackValidationIssue[];
  ok: boolean;
  summary: PortablePackValidationSummary;
}

export interface PortablePackEvaluationCheck {
  name:
    | "agent-parity-test"
    | "agent-skills"
    | "llms-map"
    | "mcp-server"
    | "pack-valid"
    | "self-play-test";
  ok: boolean;
}

export interface PortablePackEvaluationResult {
  checks: PortablePackEvaluationCheck[];
  ok: boolean;
  score: number;
}

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

interface PackObjectsFile {
  objects: TabletopObject[];
  seats: TabletopSeat[];
  zones: TabletopZone[];
}

interface PackRulesetFile {
  legalIntents: Array<{ kind: string }>;
  phases: string[];
  victory: JsonObject;
}

const requiredPackFiles = [
  "game.json",
  "objects.json",
  "ruleset.json",
] as const;

export async function validatePortablePackDirectory(
  directory: string,
): Promise<PortablePackValidationResult> {
  const missingIssues = await collectMissingFileIssues(directory);
  if (missingIssues.length > 0) {
    return createValidationResult(missingIssues, {
      legalIntentCount: 0,
      objectCount: 0,
      seatCount: 0,
      zoneCount: 0,
    });
  }

  const gameJson = await readJsonFile(join(directory, "game.json"));
  const objectsJson = await readJsonFile(join(directory, "objects.json"));
  const rulesetJson = await readJsonFile(join(directory, "ruleset.json"));
  const gameIssues = validateGameManifest(gameJson);
  const objectsFile = parseObjectsFile(objectsJson);
  const rulesetFile = parseRulesetFile(rulesetJson);
  const objectsValidation =
    objectsFile === null ? null : validatePortableGamePack(objectsFile);
  const objectsIssues =
    objectsValidation === null
      ? [
          createIssue(
            "invalidObjectsFile",
            "objects.json must contain typed seats, zones, and objects arrays",
            "objects.json",
          ),
        ]
      : objectsValidation.issues.map((issue) => ({
          ...issue,
          severity: "error" as const,
        }));
  const rulesetIssues =
    rulesetFile === null
      ? [
          createIssue(
            "invalidRulesetFile",
            "ruleset.json must contain phases, legalIntents, and victory",
            "ruleset.json",
          ),
        ]
      : validateRulesetFile(rulesetFile);

  return createValidationResult(
    [...gameIssues, ...objectsIssues, ...rulesetIssues],
    {
      legalIntentCount: rulesetFile?.legalIntents.length ?? 0,
      objectCount: objectsValidation?.summary.objectCount ?? 0,
      seatCount: objectsValidation?.summary.seatCount ?? 0,
      zoneCount: objectsValidation?.summary.zoneCount ?? 0,
    },
  );
}

export async function evaluatePortablePackDirectory(
  directory: string,
): Promise<PortablePackEvaluationResult> {
  const validation = await validatePortablePackDirectory(directory);
  const checks: PortablePackEvaluationCheck[] = [
    { name: "pack-valid", ok: validation.ok },
    {
      name: "agent-parity-test",
      ok: await pathExists(join(directory, "tests", "agent-parity.test.ts")),
    },
    {
      name: "self-play-test",
      ok: await pathExists(join(directory, "tests", "self-play.test.ts")),
    },
    {
      name: "mcp-server",
      ok:
        (await pathExists(join(directory, "src", "mcp", "server.ts"))) &&
        (await pathExists(join(directory, "tests", "mcp-server.test.ts"))),
    },
    {
      name: "llms-map",
      ok:
        (await pathExists(join(directory, "llms.txt"))) &&
        (await pathExists(join(directory, "llms-full.txt"))),
    },
    {
      name: "agent-skills",
      ok:
        (await pathExists(
          join(
            directory,
            ".agents",
            "skills",
            "play-lunchtable-game",
            "SKILL.md",
          ),
        )) &&
        (await pathExists(
          join(
            directory,
            ".agents",
            "skills",
            "build-lunchtable-game",
            "SKILL.md",
          ),
        )) &&
        (await pathExists(
          join(
            directory,
            ".agents",
            "skills",
            "evaluate-lunchtable-agent",
            "SKILL.md",
          ),
        )),
    },
  ];
  const passedChecks = checks.filter((check) => check.ok).length;

  return {
    checks,
    ok: passedChecks === checks.length,
    score: Math.round((passedChecks / checks.length) * 100),
  };
}

function createValidationResult(
  issues: PortablePackValidationIssue[],
  summary: PortablePackValidationSummary,
): PortablePackValidationResult {
  return {
    issues,
    ok: issues.length === 0,
    summary,
  };
}

async function collectMissingFileIssues(
  directory: string,
): Promise<PortablePackValidationIssue[]> {
  const issues: PortablePackValidationIssue[] = [];

  for (const fileName of requiredPackFiles) {
    if (await pathExists(join(directory, fileName))) {
      continue;
    }

    issues.push(
      createIssue("missingFile", `${fileName} is required`, fileName),
    );
  }

  return issues;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(path: string): Promise<JsonValue> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as JsonValue;
}

function validateGameManifest(value: JsonValue): PortablePackValidationIssue[] {
  if (!isJsonObject(value)) {
    return [
      createIssue(
        "invalidGameManifest",
        "game.json must be an object",
        "game.json",
      ),
    ];
  }

  const requiredStrings = ["description", "id", "name", "runtime", "version"];
  const missingField = requiredStrings.find(
    (field) => !isString(value[field]) || value[field].length === 0,
  );

  if (missingField !== undefined) {
    return [
      createIssue(
        "invalidGameManifest",
        `${missingField} must be a non-empty string`,
        `game.json.${missingField}`,
      ),
    ];
  }

  if (value.runtime !== "lunchtable") {
    return [
      createIssue(
        "runtimeMismatch",
        "runtime must be lunchtable",
        "game.json.runtime",
      ),
    ];
  }

  return [];
}

function parseObjectsFile(value: JsonValue): PackObjectsFile | null {
  if (!isJsonObject(value)) {
    return null;
  }

  if (
    !Array.isArray(value.objects) ||
    !Array.isArray(value.seats) ||
    !Array.isArray(value.zones)
  ) {
    return null;
  }

  const seats = value.seats.map(parseSeat);
  const zones = value.zones.map(parseZone);
  const objects = value.objects.map(parseObject);

  if (
    seats.some((seat) => seat === null) ||
    zones.some((zone) => zone === null) ||
    objects.some((object) => object === null)
  ) {
    return null;
  }

  return {
    objects: objects.filter(isDefined),
    seats: seats.filter(isDefined),
    zones: zones.filter(isDefined),
  };
}

function parseRulesetFile(value: JsonValue): PackRulesetFile | null {
  if (!isJsonObject(value)) {
    return null;
  }

  if (
    !Array.isArray(value.phases) ||
    !value.phases.every(isString) ||
    value.phases.length === 0 ||
    !Array.isArray(value.legalIntents) ||
    value.legalIntents.length === 0 ||
    !isJsonObject(value.victory)
  ) {
    return null;
  }

  const legalIntents = value.legalIntents.map(parseLegalIntent);
  if (legalIntents.some((intent) => intent === null)) {
    return null;
  }

  return {
    legalIntents: legalIntents.filter(isDefined),
    phases: value.phases,
    victory: value.victory,
  };
}

function validateRulesetFile(
  _file: PackRulesetFile,
): PortablePackValidationIssue[] {
  return [];
}

function parseSeat(value: JsonValue): TabletopSeat | null {
  if (
    !isJsonObject(value) ||
    !isActorType(value.actorType) ||
    !isString(value.id) ||
    (!isString(value.name) && value.name !== null) ||
    !isStringArray(value.permissions) ||
    !isSeatStatus(value.status)
  ) {
    return null;
  }

  return {
    actorType: value.actorType,
    id: value.id,
    name: value.name,
    permissions: value.permissions,
    status: value.status,
  };
}

function parseZone(value: JsonValue): TabletopZone | null {
  if (
    !isJsonObject(value) ||
    !isString(value.id) ||
    !isZoneKind(value.kind) ||
    !isString(value.name) ||
    !isOrdering(value.ordering) ||
    (!isString(value.ownerSeat) && value.ownerSeat !== null) ||
    !isTabletopVisibility(value.visibility)
  ) {
    return null;
  }

  return {
    id: value.id,
    kind: value.kind,
    name: value.name,
    ordering: value.ordering,
    ownerSeat: value.ownerSeat,
    visibility: value.visibility,
  };
}

function parseObject(value: JsonValue): TabletopObject | null {
  if (
    !isJsonObject(value) ||
    !isString(value.id) ||
    !isTabletopObjectKind(value.kind) ||
    !isString(value.name) ||
    !isString(value.zoneId) ||
    (!isString(value.ownerSeat) && value.ownerSeat !== null) ||
    !isObjectState(value.state) ||
    !isTabletopVisibility(value.visibility)
  ) {
    return null;
  }

  return {
    id: value.id,
    kind: value.kind,
    name: value.name,
    ownerSeat: value.ownerSeat,
    state: value.state,
    visibility: value.visibility,
    zoneId: value.zoneId,
  };
}

function parseLegalIntent(value: JsonValue): { kind: string } | null {
  if (!isJsonObject(value) || !isString(value.kind)) {
    return null;
  }

  return {
    kind: value.kind,
  };
}

function createIssue(
  code: PortablePackValidationIssue["code"],
  message: string,
  path: string,
): PortablePackValidationIssue {
  return {
    code,
    message,
    path,
    severity: "error",
  };
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: JsonValue | undefined): value is string {
  return typeof value === "string";
}

function isStringArray(value: JsonValue | undefined): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isActorType(value: JsonValue | undefined): value is "ai" | "human" {
  return value === "ai" || value === "human";
}

function isSeatStatus(
  value: JsonValue | undefined,
): value is TabletopSeat["status"] {
  return (
    value === "active" ||
    value === "eliminated" ||
    value === "joining" ||
    value === "ready"
  );
}

function isZoneKind(
  value: JsonValue | undefined,
): value is TabletopZone["kind"] {
  return (
    value === "bag" ||
    value === "board" ||
    value === "deck" ||
    value === "discard" ||
    value === "hand" ||
    value === "objective" ||
    value === "stack"
  );
}

function isOrdering(
  value: JsonValue | undefined,
): value is TabletopZone["ordering"] {
  return value === "ordered" || value === "unordered";
}

function isTabletopObjectKind(
  value: JsonValue | undefined,
): value is TabletopObjectKind {
  return (
    value === "board" ||
    value === "card" ||
    value === "counter" ||
    value === "die" ||
    value === "piece" ||
    value === "token"
  );
}

function isObjectState(
  value: JsonValue | undefined,
): value is TabletopObject["state"] {
  return value === "exhausted" || value === "ready" || value === "removed";
}

function isTabletopVisibility(
  value: JsonValue | undefined,
): value is TabletopVisibility {
  return (
    value === "count-only" ||
    value === "hidden" ||
    value === "private-owner" ||
    value === "public"
  );
}

function isDefined<TValue>(value: TValue | null): value is TValue {
  return value !== null;
}
