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
        ".agents/skills/build-lunchtable-game/SKILL.md",
        ".agents/skills/evaluate-lunchtable-agent/SKILL.md",
        ".agents/skills/play-lunchtable-game/SKILL.md",
        "README.md",
        "llms-full.txt",
        "llms.txt",
        "package.json",
        "src/agents/a2a.ts",
        "src/agents/baseline.ts",
        "src/agents/external-http.ts",
        "src/agents/mcp.ts",
        "src/agents/self-play.ts",
        "src/game.ts",
        "tests/agent-parity.test.ts",
        "tests/game.test.ts",
        "tests/self-play.test.ts",
        "tsconfig.json",
      ]);

      const gameSource = await readFile(
        join(targetDirectory, "src/game.ts"),
        "utf8",
      );
      expect(gameSource).toContain("createDiceDuelGame");
      expect(gameSource).toContain("@lunchtable/games-tabletop");

      const baselineAgentSource = await readFile(
        join(targetDirectory, "src/agents/baseline.ts"),
        "utf8",
      );
      expect(baselineAgentSource).toContain("runAgentTurn");
      expect(baselineAgentSource).toContain("createFirstLegalActionPolicy");

      const parityTestSource = await readFile(
        join(targetDirectory, "tests/agent-parity.test.ts"),
        "utf8",
      );
      expect(parityTestSource).toContain("chooses from legal actions");

      const llmsText = await readFile(
        join(targetDirectory, "llms.txt"),
        "utf8",
      );
      expect(llmsText).toContain("# Dice tabletop game");
      expect(llmsText).toContain("> Agent-native Lunch Table Games starter");
      expect(llmsText).toContain("## Agent Skills");

      const fullLlmsText = await readFile(
        join(targetDirectory, "llms-full.txt"),
        "utf8",
      );
      expect(fullLlmsText).toContain("## Authority Model");
      expect(fullLlmsText).toContain("Agents submit legal action ids");

      const playSkill = await readFile(
        join(targetDirectory, ".agents/skills/play-lunchtable-game/SKILL.md"),
        "utf8",
      );
      expect(playSkill).toContain("name: play-lunchtable-game");
      expect(playSkill).toContain("Use when an agent needs to join");
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
        expect(result.files).toContain("llms.txt");
        expect(result.files).toContain("llms-full.txt");
        expect(result.files).toContain(
          ".agents/skills/play-lunchtable-game/SKILL.md",
        );
        expect(result.files).toContain(
          ".agents/skills/build-lunchtable-game/SKILL.md",
        );
        expect(result.files).toContain(
          ".agents/skills/evaluate-lunchtable-agent/SKILL.md",
        );
        expect(result.files).toContain("src/agents/baseline.ts");
        expect(result.files).toContain("src/agents/external-http.ts");
        expect(result.files).toContain("src/agents/mcp.ts");
        expect(result.files).toContain("src/agents/a2a.ts");
        expect(result.files).toContain("src/agents/self-play.ts");
        expect(result.files).toContain("tests/agent-parity.test.ts");
        expect(result.files).toContain("tests/self-play.test.ts");
        expect(result.templateId).toBe(template.id);
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
