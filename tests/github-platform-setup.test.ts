import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const publicPackages = [
  "@lunchtable/games-core",
  "@lunchtable/games-render",
  "@lunchtable/games-ai",
  "@lunchtable/games-api",
  "@lunchtable/games-assets",
  "@lunchtable/games-tabletop",
  "@lunchtable/games-side-scroller",
  "lunchtable",
] as const;

function readFile(path: string) {
  return readFileSync(path, "utf8");
}

describe("GitHub platform setup", () => {
  it("frames the repository as the Lunch Table Games library", () => {
    const readme = readFile(join(rootDir, "README.md"));
    const docsReadme = readFile(join(rootDir, "docs", "README.md"));
    const packagesReadme = readFile(join(rootDir, "packages", "README.md"));
    const githubSetup = readFile(
      join(rootDir, "docs", "platform", "GITHUB_SETUP.md"),
    );

    expect(readme).toContain("# Lunch Table Games");
    expect(readme).toContain("Browser-first game library");
    expect(readme).toContain("TCG app repo");
    expect(readme).not.toContain(
      "Web-first trading card game platform built with",
    );
    expect(readme).toContain("packages/README.md");
    expect(readme).toContain("docs/README.md");
    expect(docsReadme).toContain("docs/platform/");
    expect(docsReadme).toContain("docs/product/");
    expect(docsReadme).toContain("docs/program/");
    expect(packagesReadme).toContain("## Public Packages");
    expect(packagesReadme).toContain("## Proof And Support Packages");
    expect(packagesReadme).toContain("Generic `@lunchtable/games-*` packages");
    expect(githubSetup).toContain("Lunch Table Games library home");
    expect(githubSetup).toContain("not only the original trading card game");
  });

  it("documents every public package in GitHub and release setup", () => {
    const readme = readFile(join(rootDir, "README.md"));
    const release = readFile(join(rootDir, "docs", "platform", "RELEASE.md"));
    const githubSetup = readFile(
      join(rootDir, "docs", "platform", "GITHUB_SETUP.md"),
    );

    for (const packageName of publicPackages) {
      expect(readme).toContain(packageName);
      expect(release).toContain(packageName);
      expect(githubSetup).toContain(packageName);
    }
  });

  it("ships GitHub repo health files for the full game library", () => {
    const requiredFiles = [
      ".github/pull_request_template.md",
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      ".github/ISSUE_TEMPLATE/feature_request.yml",
      ".github/ISSUE_TEMPLATE/game_family.yml",
      ".github/ISSUE_TEMPLATE/config.yml",
      ".github/dependabot.yml",
    ];

    for (const file of requiredFiles) {
      expect(existsSync(join(rootDir, file))).toBe(true);
    }

    const pullRequestTemplate = readFile(
      join(rootDir, ".github", "pull_request_template.md"),
    );
    const gameFamilyTemplate = readFile(
      join(rootDir, ".github", "ISSUE_TEMPLATE", "game_family.yml"),
    );

    expect(pullRequestTemplate).toContain("Library Surface");
    expect(pullRequestTemplate).toContain("Agent Parity");
    expect(pullRequestTemplate).toContain("Generated Games And Assets");
    expect(gameFamilyTemplate).toContain("Rules and authority model");
    expect(gameFamilyTemplate).toContain("Agent participation");
  });

  it("documents required GitHub protections and package automation", () => {
    const githubSetup = readFile(
      join(rootDir, "docs", "platform", "GITHUB_SETUP.md"),
    );
    const phaseGates = readFile(
      join(rootDir, ".github", "workflows", "phase-gates.yml"),
    );
    const releaseWorkflow = readFile(
      join(rootDir, ".github", "workflows", "release.yml"),
    );
    const dependabot = readFile(join(rootDir, ".github", "dependabot.yml"));

    expect(githubSetup).toContain("required check: `validate`");
    expect(githubSetup).toContain("NPM_TOKEN");
    expect(githubSetup).toContain("trusted");
    expect(githubSetup).toContain("publishing");
    expect(phaseGates).toContain("jobs:\n  validate:");
    expect(phaseGates).toContain("./scripts/phase-check.sh full");
    expect(phaseGates).toContain("./scripts/phase-check.sh regression");
    expect(releaseWorkflow).toContain("id-token: write");
    expect(releaseWorkflow).toContain("bun run release:packages:publish");
    expect(dependabot).toContain('package-ecosystem: "github-actions"');
    expect(dependabot).toContain('package-ecosystem: "npm"');
  });
});
