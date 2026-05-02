import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createScaffoldProject,
  listScaffoldTemplates,
  parseInitArgs,
} from "./scaffold";

describe("lunchtable init scaffolding", () => {
  it("lists the supported starter templates", () => {
    expect(listScaffoldTemplates().map((template) => template.id)).toEqual([
      "tcg",
      "dice",
      "side-scroller",
      "shooter-3d",
    ]);
  });

  it("parses init flags for a non-interactive scaffold", () => {
    expect(
      parseInitArgs([
        "init",
        "arcade-duel",
        "--template",
        "side-scroller",
        "--yes",
      ]),
    ).toEqual({
      command: "init",
      force: false,
      packageManager: "bun",
      targetDirectory: "arcade-duel",
      templateId: "side-scroller",
      yes: true,
    });
  });

  it("creates a scaffolded dice game project", async () => {
    const root = await mkdtemp(join(tmpdir(), "lunchtable-cli-"));
    const targetDirectory = join(root, "dice-duel");

    try {
      const result = await createScaffoldProject({
        force: false,
        packageManager: "bun",
        targetDirectory,
        templateId: "dice",
      });

      expect(result.templateId).toBe("dice");
      expect(result.files).toEqual([
        ".gitignore",
        "README.md",
        "package.json",
        "src/game.ts",
        "tests/game.test.ts",
        "tsconfig.json",
      ]);

      const gameSource = await readFile(
        join(targetDirectory, "src/game.ts"),
        "utf8",
      );
      expect(gameSource).toContain("createDiceDuelGame");
      expect(gameSource).toContain("@lunchtable/games-tabletop");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("creates every supported starter template", async () => {
    const root = await mkdtemp(join(tmpdir(), "lunchtable-cli-"));

    try {
      for (const template of listScaffoldTemplates()) {
        const result = await createScaffoldProject({
          force: false,
          packageManager: "bun",
          targetDirectory: join(root, template.id),
          templateId: template.id,
        });

        expect(result.files).toContain("src/game.ts");
        expect(result.templateId).toBe(template.id);
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
