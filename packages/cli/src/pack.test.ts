import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluatePortablePackDirectory,
  validatePortablePackDirectory,
} from "./pack";
import { createScaffoldProject } from "./scaffold";

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("portable game pack CLI helpers", () => {
  it("validates a scaffolded portable pack", async () => {
    const root = await mkdtemp(join(tmpdir(), "lunchtable-pack-"));
    const targetDirectory = join(root, "dice-duel");

    try {
      await createScaffoldProject({
        force: false,
        packageManager: "bun",
        targetDirectory,
        templateId: "dice",
      });

      await expect(
        readFile(join(targetDirectory, "game.json"), "utf8"),
      ).resolves.toContain('"runtime": "lunchtable"');

      expect(await validatePortablePackDirectory(targetDirectory)).toEqual({
        issues: [],
        ok: true,
        summary: {
          legalIntentCount: 2,
          objectCount: 2,
          seatCount: 2,
          zoneCount: 4,
        },
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects packs with invalid references", async () => {
    const root = await mkdtemp(join(tmpdir(), "lunchtable-pack-"));

    try {
      await mkdir(root, { recursive: true });
      await writeJson(join(root, "game.json"), {
        description: "Broken generated pack",
        id: "broken-pack",
        name: "Broken Pack",
        runtime: "lunchtable",
        version: "0.1.0",
      });
      await writeJson(join(root, "ruleset.json"), {
        legalIntents: [{ kind: "pass" }],
        phases: ["main"],
        victory: { kind: "last-seat-standing" },
      });
      await writeJson(join(root, "objects.json"), {
        objects: [
          {
            id: "piece:missing",
            kind: "piece",
            name: "Missing Piece",
            ownerSeat: "seat-missing",
            state: "ready",
            visibility: "public",
            zoneId: "zone-missing",
          },
        ],
        seats: [
          {
            actorType: "human",
            id: "seat-0",
            name: "Seat 0",
            permissions: ["submitIntent"],
            status: "ready",
          },
        ],
        zones: [
          {
            id: "board",
            kind: "board",
            name: "Board",
            ordering: "unordered",
            ownerSeat: null,
            visibility: "public",
          },
        ],
      });

      expect(await validatePortablePackDirectory(root)).toMatchObject({
        issues: [
          { code: "unknownObjectZone" },
          { code: "unknownObjectOwnerSeat" },
        ],
        ok: false,
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("evaluates scaffolded agent readiness", async () => {
    const root = await mkdtemp(join(tmpdir(), "lunchtable-pack-"));
    const targetDirectory = join(root, "side-scroller");

    try {
      await createScaffoldProject({
        force: false,
        packageManager: "bun",
        targetDirectory,
        templateId: "side-scroller",
      });

      expect(await evaluatePortablePackDirectory(targetDirectory)).toEqual({
        checks: [
          { name: "pack-valid", ok: true },
          { name: "agent-parity-test", ok: true },
          { name: "self-play-test", ok: true },
          { name: "llms-map", ok: true },
          { name: "agent-skills", ok: true },
        ],
        ok: true,
        score: 100,
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
