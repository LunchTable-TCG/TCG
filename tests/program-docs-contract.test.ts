import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const readmePath = join(rootDir, "README.md");
const implementationPhasesPath = join(rootDir, "IMPLEMENTATION_PHASES.md");
const sessionPath = join(rootDir, "SESSION.md");
const phaseLoopDocPath = join(rootDir, "docs", "PHASE_LOOP.md");
const resumeScriptPath = join(rootDir, "scripts", "resume.sh");
const packageJsonPath = join(rootDir, "package.json");
const programDir = join(rootDir, "docs", "program");

const requiredProgramDocs = [
  "EXECUTION_PLAN.md",
  "CHURN_TRACKER.md",
  "AGENT_GAMEPLAY_CONTRACT.md",
  "VERIFICATION_MATRIX.md",
  "BENCHMARK_BUDGETS.md",
] as const;

function readFile(path: string) {
  return readFileSync(path, "utf8");
}

describe("program docs contract", () => {
  it("ships the Phase 19-24 program docs as a tracked source of truth", () => {
    for (const fileName of requiredProgramDocs) {
      expect(existsSync(join(programDir, fileName))).toBe(true);
    }

    const executionPlan = readFile(join(programDir, "EXECUTION_PLAN.md"));
    const verificationMatrix = readFile(join(programDir, "VERIFICATION_MATRIX.md"));
    const benchmarkBudgets = readFile(join(programDir, "BENCHMARK_BUDGETS.md"));

    expect(executionPlan).toContain("Phase 19: Program Control Plane and Source of Truth");
    expect(executionPlan).toContain("Phase 24: Benchmarks, Regression Gates, and Release Readiness");
    expect(verificationMatrix).toContain("./scripts/phase-check.sh regression");
    expect(benchmarkBudgets).toContain("bun run benchmark:deterministic");
  });

  it("keeps repo docs and scripts pointed at the active program docs", () => {
    const readme = readFile(readmePath);
    const implementationPhases = readFile(implementationPhasesPath);
    const session = readFile(sessionPath);
    const phaseLoopDoc = readFile(phaseLoopDocPath);
    const resumeScript = readFile(resumeScriptPath);

    expect(readme).toContain("docs/program/EXECUTION_PLAN.md");
    expect(readme).toContain("bun run benchmark:deterministic");
    expect(implementationPhases).toContain("## Phase 19: Program Control Plane and Source of Truth");
    expect(implementationPhases).toContain("## Phase 24: Benchmarks, Regression Gates, and Release Readiness");
    expect(session).toContain("**Current Phase**: Phase 19");
    expect(session).toContain("docs/program/CHURN_TRACKER.md");
    expect(phaseLoopDoc).toContain("docs/program/VERIFICATION_MATRIX.md");
    expect(resumeScript).toContain("docs/program/EXECUTION_PLAN.md");
    expect(resumeScript).toContain("docs/program/BENCHMARK_BUDGETS.md");
  });

  it("keeps the workflow test command aligned with the program doc contract", () => {
    const packageJson = readFile(packageJsonPath);

    expect(packageJson).toContain(
      '"test:workflow": "vitest run tests/phase-gates-workflow.test.ts tests/program-docs-contract.test.ts tests/release-proof-contract.test.ts"',
    );
  });
});
