import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const workflowPath = join(rootDir, ".github", "workflows", "phase-gates.yml");
const setupActionPath = join(
  rootDir,
  ".github",
  "actions",
  "setup-bun-workspace",
  "action.yml",
);
const phaseCheckPath = join(rootDir, "scripts", "phase-check.sh");
const packageJsonPath = join(rootDir, "package.json");

function readFile(path: string) {
  return readFileSync(path, "utf8");
}

describe("phase gates workflow contract", () => {
  it("keeps the workflow fork-safe and delegates Bun pinning to the shared setup action", () => {
    const workflow = readFile(workflowPath);
    const setupAction = readFile(setupActionPath);

    expect(workflow).toContain("permissions:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true");
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("timeout-minutes: 25");
    expect(workflow).toContain("uses: ./.github/actions/setup-bun-workspace");
    expect(setupAction).toContain("id: bun-version");
    expect(setupAction).toContain("packageManager");
    expect(setupAction).toContain('if not package_manager.startswith("bun@")');
    expect(setupAction).toContain(
      "bun-version: ${{ steps.bun-version.outputs.version }}",
    );
    expect(setupAction).not.toContain("bun-version: latest");
  });

  it("runs the canonical full and regression gates in CI", () => {
    const workflow = readFile(workflowPath);

    expect(workflow).toContain("./scripts/phase-check.sh full");
    expect(workflow).toContain("./scripts/phase-check.sh regression");
  });

  it("keeps build and workflow drift checks inside the gate script", () => {
    const phaseCheck = readFile(phaseCheckPath);
    const packageJson = readFile(packageJsonPath);

    expect(phaseCheck).toContain("candidates=(lint typecheck test build)");
    expect(phaseCheck).toContain(
      "candidates=(test:workflow test:rules test:convex test:replay benchmark:deterministic test:e2e)",
    );
    expect(packageJson).toContain(
      '"test:workflow": "vitest run tests/phase-gates-workflow.test.ts tests/github-platform-setup.test.ts tests/program-docs-contract.test.ts tests/release-proof-contract.test.ts tests/npm-publishing-contract.test.ts tests/vitest-alias-contract.test.ts"',
    );
    expect(packageJson).toContain(
      '"benchmark:deterministic": "bun run scripts/run-deterministic-benchmarks.ts"',
    );
  });
});
