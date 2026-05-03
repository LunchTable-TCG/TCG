import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const packageJsonPath = join(rootDir, "package.json");
const readmePath = join(rootDir, "README.md");
const releaseDocPath = join(rootDir, "docs", "platform", "RELEASE.md");
const releaseScriptPath = join(rootDir, "scripts", "release-proof.sh");
const releaseWorkflowPath = join(
  rootDir,
  ".github",
  "workflows",
  "release.yml",
);
const publicPackageScriptPath = join(
  rootDir,
  "scripts",
  "release-public-packages.ts",
);
const cliPackageProofScriptPath = join(
  rootDir,
  "scripts",
  "proof-lunchtable-cli-package.sh",
);

function readFile(path: string) {
  return readFileSync(path, "utf8");
}

describe("release proof contract", () => {
  it("exposes the release proof command in package.json and README", () => {
    const packageJson = readFile(packageJsonPath);
    const readme = readFile(readmePath);

    expect(packageJson).toContain(
      '"release:proof": "bash ./scripts/release-proof.sh"',
    );
    expect(readme).toContain("bun run release:proof");
  });

  it("keeps the scripted release proof aligned with the documented gate order", () => {
    const releaseDoc = readFile(releaseDocPath);
    const releaseScript = readFile(releaseScriptPath);

    expect(releaseDoc).toContain("bunx convex codegen");
    expect(releaseDoc).toContain("Playwright Chromium");
    expect(releaseDoc).toContain("./scripts/phase-check.sh full");
    expect(releaseDoc).toContain("./scripts/phase-check.sh regression");
    expect(releaseScript).toContain("bun run setup:convex-auth-local --sync");
    expect(releaseScript).toContain("for attempt in 1 2 3");
    expect(releaseScript).toContain("Convex backend start failed");
    expect(releaseScript).toContain("bunx convex codegen");
    expect(releaseScript).toContain("playwright install --with-deps chromium");
    expect(releaseScript).toContain(
      "./scripts/proof-lunchtable-cli-package.sh",
    );
    expect(releaseScript).toContain("./scripts/phase-check.sh full");
    expect(releaseScript).toContain("./scripts/phase-check.sh regression");
    expect(releaseScript).toContain("git tag -a v0.1.1");
  });

  it("proves the packed lunchtable CLI through bunx", () => {
    const cliPackageProofScript = readFile(cliPackageProofScriptPath);

    expect(cliPackageProofScript).toContain(
      "scripts/release-public-packages.ts --dry-run --pack-destination",
    );
    expect(cliPackageProofScript).toContain(
      'bunx --package "$TARBALL" lunchtable init',
    );
    expect(cliPackageProofScript).toContain(
      'bunx --package "$TARBALL" lunchtable validate',
    );
    expect(cliPackageProofScript).toContain(
      'bunx --package "$TARBALL" lunchtable eval',
    );
    expect(cliPackageProofScript).toContain("--template side-scroller");
    expect(cliPackageProofScript).toContain(
      "lunchtable-games-assets-0.1.1.tgz",
    );
    expect(cliPackageProofScript).toContain("lunchtable-games-api-0.1.1.tgz");
    expect(cliPackageProofScript).toContain('"listAssets"');
    expect(cliPackageProofScript).toContain('"validateAssets"');
    expect(cliPackageProofScript).toContain('"exportSpriteAtlas"');
    expect(cliPackageProofScript).toContain('"requestImageGeneration"');
    expect(cliPackageProofScript).toContain("bun run --silent mcp:stdio");
  });

  it("publishes GitHub releases and npm packages from the tag workflow", () => {
    const releaseWorkflow = readFile(releaseWorkflowPath);
    const packageJson = readFile(packageJsonPath);
    const publicPackageScript = readFile(publicPackageScriptPath);

    expect(packageJson).toContain(
      '"build:packages": "bun run scripts/build-public-packages.ts"',
    );
    expect(packageJson).toContain(
      '"release:packages:dry-run": "bun run scripts/release-public-packages.ts --dry-run"',
    );
    expect(packageJson).toContain(
      '"release:packages:publish": "bun run scripts/release-public-packages.ts --publish"',
    );
    expect(releaseWorkflow).toContain("id-token: write");
    expect(releaseWorkflow).toContain(
      "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true",
    );
    expect(releaseWorkflow).toContain("release_ref");
    expect(releaseWorkflow).toContain("RELEASE_REF");
    expect(releaseWorkflow).toContain("ref: ${{ env.RELEASE_REF }}");
    expect(releaseWorkflow).toContain(
      'bash ./scripts/generate-release-notes.sh "$RELEASE_REF"',
    );
    expect(releaseWorkflow).toContain("getReleaseByTag");
    expect(releaseWorkflow).toContain("updateRelease");
    expect(releaseWorkflow).toContain("setup-node@v4");
    expect(releaseWorkflow).toContain("node-version: 24");
    expect(releaseWorkflow).toContain("npm install -g npm@^11");
    expect(releaseWorkflow).toContain("bun run release:packages:dry-run");
    expect(releaseWorkflow).toContain("bun run release:packages:publish");
    expect(releaseWorkflow).toContain(
      "NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}",
    );
    expect(publicPackageScript).toContain(
      '"@lunchtable/games-core",\n  "@lunchtable/games-render",\n  "@lunchtable/games-ai",\n  "@lunchtable/games-api",\n  "@lunchtable/games-assets",\n  "@lunchtable/games-tabletop",\n  "@lunchtable/games-side-scroller",\n  "lunchtable"',
    );
    expect(publicPackageScript).toContain("hasTokenAuth");
    expect(publicPackageScript).toContain(
      '["publish", stagedDirectory, "--access", "public", "--provenance"]',
    );
    expect(publicPackageScript).toContain('["publish", stagedDirectory]');
    expect(publicPackageScript).toContain("--provenance");
    expect(publicPackageScript).toContain("workspace:*");
    expect(publicPackageScript).toContain("test file");
  });
});
