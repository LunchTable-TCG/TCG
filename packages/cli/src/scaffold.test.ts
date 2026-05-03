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
      json: false,
      packageManager: "bun",
      targetDirectory: "arcade-duel",
      templateId: "side-scroller",
      yes: true,
    });
  });

  it("parses validate and eval commands for non-interactive generated games", () => {
    expect(parseInitArgs(["validate", "generated-pack", "--json"])).toEqual({
      command: "validate",
      force: false,
      json: true,
      packageManager: "bun",
      targetDirectory: "generated-pack",
      templateId: null,
      yes: false,
    });
    expect(parseInitArgs(["eval", "generated-pack"])).toEqual({
      command: "eval",
      force: false,
      json: false,
      packageManager: "bun",
      targetDirectory: "generated-pack",
      templateId: null,
      yes: false,
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
        "game.json",
        "llms-full.txt",
        "llms.txt",
        "objects.json",
        "package.json",
        "ruleset.json",
        "src/agents/a2a.ts",
        "src/agents/baseline.ts",
        "src/agents/external-http.ts",
        "src/agents/mcp.ts",
        "src/agents/sse.ts",
        "src/agents/self-play.ts",
        "src/api/server.ts",
        "src/game.ts",
        "tests/api-server.test.ts",
        "tests/agent-parity.test.ts",
        "tests/game.test.ts",
        "src/mcp/server.ts",
        "tests/mcp-server.test.ts",
        "tests/sse.test.ts",
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

      const apiServerSource = await readFile(
        join(targetDirectory, "src/api/server.ts"),
        "utf8",
      );
      expect(apiServerSource).toContain("@lunchtable/games-api");
      expect(apiServerSource).toContain("createAgentApiManifest");
      expect(apiServerSource).toContain("createSubmitActionResult");
      expect(apiServerSource).toContain("handleStarterApiRequest");
      expect(apiServerSource).toContain("/api/legal-actions");
      expect(apiServerSource).toContain("/api/actions/submit");

      const apiServerTestSource = await readFile(
        join(targetDirectory, "tests/api-server.test.ts"),
        "utf8",
      );
      expect(apiServerTestSource).toContain("handleStarterApiRequest");
      expect(apiServerTestSource).toContain("/api/agent/manifest");

      const packageJson = JSON.parse(
        await readFile(join(targetDirectory, "package.json"), "utf8"),
      ) as {
        dependencies: Record<string, string>;
        scripts: Record<string, string>;
      };
      expect(packageJson.dependencies["@lunchtable/games-api"]).toBe("latest");
      expect(packageJson.scripts["mcp:stdio"]).toBe("bun src/mcp/server.ts");

      const mcpServerSource = await readFile(
        join(targetDirectory, "src/mcp/server.ts"),
        "utf8",
      );
      expect(mcpServerSource).toContain('method === "tools/list"');
      expect(mcpServerSource).toContain('method === "resources/read"');
      expect(mcpServerSource).toContain('"2025-11-25"');
      expect(mcpServerSource).toContain('case "submitAction"');

      const mcpServerTestSource = await readFile(
        join(targetDirectory, "tests/mcp-server.test.ts"),
        "utf8",
      );
      expect(mcpServerTestSource).toContain("handleStarterMcpRequest");
      expect(mcpServerTestSource).toContain("tools/call");

      const sseSource = await readFile(
        join(targetDirectory, "src/agents/sse.ts"),
        "utf8",
      );
      expect(sseSource).toContain("createStarterAgentContext");
      expect(sseSource).toContain("createStarterAgentSseSnapshot");
      expect(sseSource).toContain("text/event-stream");

      const sseTestSource = await readFile(
        join(targetDirectory, "tests/sse.test.ts"),
        "utf8",
      );
      expect(sseTestSource).toContain("encodes a scoped context snapshot");

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
        expect(result.files).toContain("game.json");
        expect(result.files).toContain("objects.json");
        expect(result.files).toContain("ruleset.json");
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
        expect(result.files).toContain("src/agents/sse.ts");
        expect(result.files).toContain("src/agents/a2a.ts");
        expect(result.files).toContain("src/agents/self-play.ts");
        expect(result.files).toContain("src/api/server.ts");
        expect(result.files).toContain("src/mcp/server.ts");
        expect(result.files).toContain("tests/api-server.test.ts");
        expect(result.files).toContain("tests/agent-parity.test.ts");
        expect(result.files).toContain("tests/mcp-server.test.ts");
        expect(result.files).toContain("tests/sse.test.ts");
        expect(result.files).toContain("tests/self-play.test.ts");
        expect(result.templateId).toBe(template.id);
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("creates a playable two-seat side-scroller starter", async () => {
    const root = await mkdtemp(join(tmpdir(), "lunchtable-cli-"));
    const targetDirectory = join(root, "side-runner");

    try {
      await createScaffoldProject({
        force: false,
        packageManager: "bun",
        targetDirectory,
        templateId: "side-scroller",
      });

      const gameSource = await readFile(
        join(targetDirectory, "src/game.ts"),
        "utf8",
      );
      expect(gameSource).toContain("@lunchtable/games-side-scroller");
      expect(gameSource).toContain("createSideScrollerComponents");
      expect(gameSource).toContain("createSideScrollerRuleset");
      expect(gameSource).toContain("createSideScrollerStudioPreview");
      expect(gameSource).toContain("runSideScrollerSelfPlay");
      expect(gameSource).toContain("sideScrollerStarterConfig");

      const gameTestSource = await readFile(
        join(targetDirectory, "tests/game.test.ts"),
        "utf8",
      );
      expect(gameTestSource).toContain(
        "advances both runners through legal side-scroller actions",
      );
      expect(gameTestSource).toContain(
        "provides a studio preview for humans and agents",
      );
      expect(gameTestSource).toContain(
        "renders runners, hazards, collectibles, and the goal",
      );

      const rulesetJson = await readFile(
        join(targetDirectory, "ruleset.json"),
        "utf8",
      );
      expect(rulesetJson).toContain('"moveRight"');
      expect(rulesetJson).toContain('"dash"');
      expect(rulesetJson).toContain('"attack"');

      const objectsJson = await readFile(
        join(targetDirectory, "objects.json"),
        "utf8",
      );
      expect(objectsJson).toContain("Runner 0");
      expect(objectsJson).toContain("Runner 1");
      expect(objectsJson).toContain("Ground");
      expect(objectsJson).toContain("Ledge 1");
      expect(objectsJson).toContain("Goal");
      expect(objectsJson).toContain("Hazard");
      expect(objectsJson).toContain("Collectible");

      const packageJson = JSON.parse(
        await readFile(join(targetDirectory, "package.json"), "utf8"),
      ) as { dependencies: Record<string, string> };
      expect(packageJson.dependencies["@lunchtable/games-api"]).toBe("latest");
      expect(packageJson.dependencies["@lunchtable/games-assets"]).toBe(
        "latest",
      );

      const assetManifest = await readFile(
        join(targetDirectory, "assets/manifest.json"),
        "utf8",
      );
      expect(assetManifest).toContain("sprite:runner");
      expect(assetManifest).toContain("clip:runner:run");
      expect(assetManifest).toContain("tilemap:level-1");

      const assetTestSource = await readFile(
        join(targetDirectory, "tests/assets.test.ts"),
        "utf8",
      );
      expect(assetTestSource).toContain("validateAssetBundle");
      expect(assetTestSource).toContain("createSideScrollerAssetBundle");

      const mcpServerSource = await readFile(
        join(targetDirectory, "src/mcp/server.ts"),
        "utf8",
      );
      expect(mcpServerSource).toContain("listAssets");
      expect(mcpServerSource).toContain("validateAssets");
      expect(mcpServerSource).toContain("exportSpriteAtlas");
      expect(mcpServerSource).toContain("requestImageGeneration");
      expect(mcpServerSource).toContain("assets/manifest.json");

      const apiServerSource = await readFile(
        join(targetDirectory, "src/api/server.ts"),
        "utf8",
      );
      expect(apiServerSource).toContain("/api/assets/atlas");
      expect(apiServerSource).toContain("/api/assets/generation-request");
      expect(apiServerSource).toContain("/api/studio/preview");
      expect(apiServerSource).toContain("createSideScrollerStudioPreview");
      expect(apiServerSource).toContain("requestImageGeneration");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
