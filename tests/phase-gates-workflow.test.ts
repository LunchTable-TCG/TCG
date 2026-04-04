import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const workflowPath = join(rootDir, ".github", "workflows", "phase-gates.yml");
const phaseCheckPath = join(rootDir, "scripts", "phase-check.sh");
const packageJsonPath = join(rootDir, "package.json");

function readFile(path: string) {
  return readFileSync(path, "utf8");
}

describe("phase gates workflow contract", () => {
  it("pins Bun from packageManager and keeps the workflow fork-safe", () => {
    const workflow = readFile(workflowPath);

    expect(workflow).toContain("permissions:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("timeout-minutes: 25");
    expect(workflow).toContain("id: bun-version");
    expect(workflow).toContain("packageManager");
    expect(workflow).toContain('if not package_manager.startswith("bun@")');
    expect(workflow).toContain(
      "bun-version: ${{ steps.bun-version.outputs.version }}",
    );
    expect(workflow).not.toContain("bun-version: latest");
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
      "candidates=(test:workflow test:rules test:convex test:replay test:e2e)",
    );
    expect(packageJson).toContain(
      '"test:workflow": "vitest run tests/phase-gates-workflow.test.ts"',
    );
  });
});
