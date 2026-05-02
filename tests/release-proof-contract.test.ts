import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const packageJsonPath = join(rootDir, "package.json");
const readmePath = join(rootDir, "README.md");
const releaseDocPath = join(rootDir, "docs", "RELEASE.md");
const releaseScriptPath = join(rootDir, "scripts", "release-proof.sh");
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
    expect(releaseScript).toContain("git tag -a v0.1.0");
  });

  it("proves the packed lunchtable CLI through bunx", () => {
    const cliPackageProofScript = readFile(cliPackageProofScriptPath);

    expect(cliPackageProofScript).toContain("bun pm pack");
    expect(cliPackageProofScript).toContain(
      'bunx --package "$TARBALL" lunchtable init',
    );
    expect(cliPackageProofScript).toContain(
      'bunx --package "$TARBALL" lunchtable validate',
    );
    expect(cliPackageProofScript).toContain(
      'bunx --package "$TARBALL" lunchtable eval',
    );
  });
});
