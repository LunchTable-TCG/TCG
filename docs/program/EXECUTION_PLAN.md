# Agent-Playable Current-Format Execution Plan

This document is the control plane for Phases 19-24 of Lunchtable.

## Goal

Make the current Standard Alpha format fully playable by humans and live LLM
seats, with seat-legal structured context, deterministic goldens, browser
golden paths, benchmark budgets, and regression gates that prove the system
stays playable as cards and workflows evolve.

## Authority Model

- `packages/game-core` remains the sole rules authority.
- `matches.submitIntent` remains the only public state writer for live gameplay.
- Production gameplay agents select from enumerated legal actions only.
- Coach and commentator agents consume the same structured match context, but
  remain non-authoritative.

## Program Phases

### Phase 19: Program Control Plane and Source of Truth

**Skill Chain**: `project-health` -> `project-planning` ->
`project-session-management` -> `docs-source-of-truth`

**Scope**
- Create and maintain the program doc set under `docs/program/`.
- Extend `IMPLEMENTATION_PHASES.md`, `SESSION.md`, and the phase-loop scripts so
  they point at the active program docs.
- Add contract tests that lock doc references and gate wiring.

**Required Artifacts**
- [CHURN_TRACKER.md](./CHURN_TRACKER.md)
- [AGENT_GAMEPLAY_CONTRACT.md](./AGENT_GAMEPLAY_CONTRACT.md)
- [VERIFICATION_MATRIX.md](./VERIFICATION_MATRIX.md)
- [BENCHMARK_BUDGETS.md](./BENCHMARK_BUDGETS.md)

**Exit Criteria**
- Every active phase script points to the program docs.
- Workflow drift tests cover the new source-of-truth docs.
- Future sessions can resume Phase 19+ work directly from repo docs.

### Phase 20: Structured Gameplay-Agent Context and Observability

**Skill Chain**: `game-studio:web-game-foundations` -> `api-design` ->
`convex-performance-audit`

**Scope**
- Ship `AgentMatchContextV1`, `LegalActionDescriptorV1`,
  `PromptDecisionSchemaV1`, and `BotDecisionTraceV1`.
- Generate structured seat-legal context from live seat views.
- Record agent telemetry for context build cost, invalid outputs, and seat
  decision lifecycle timings.

**Required Artifacts**
- Shared type definitions in `packages/shared-types/src/`
- Context builders in `packages/bot-sdk/src/`
- Telemetry hooks in `convex/agents.ts` and `apps/bot-runner/src/index.ts`
- Deterministic tests and fixtures for context and legal-action generation

**Exit Criteria**
- Bot policies consume structured context, not prose-only summaries.
- Advisory agents render the same context contract for human inspection.
- Context generation and decision lifecycle telemetry is queryable.

### Phase 21: Full Intent Parity and Live LLM Player Lifecycle

**Skill Chain**: `agent-development` -> `game-studio:web-game-foundations` ->
`convex-performance-audit`

**Scope**
- Support every human-authoritative intent in the gameplay-agent stack.
- Keep transport, adapter, and policy boundaries explicit.
- Validate policy-selected action ids against the current legal action catalog
  before submission.
- Cover reconnect, retry, timeout/default-choice, and post-match trace archival.

**Required Artifacts**
- Expanded `packages/bot-sdk` intent support
- Bot transport lifecycle coverage
- Lifecycle traces and telemetry records

**Exit Criteria**
- Practice, lobby, and queue seats can all be driven by gameplay agents.
- Production agents never bypass legal-action selection.
- Stale state and timeout paths resolve with deterministic fallback behavior.

### Phase 22: Card Addition Contract and Golden Results

**Skill Chain**: `docs-source-of-truth` -> `vitest` -> `code-reviewer`

**Scope**
- Require `CardReasoningMetadataV1` for every visible current-format card.
- Add a new-card admission path with metadata validation, scenario tests, and
  replay golden refresh.
- Maintain canonical current-format goldens for agent-selected action ids and
  authoritative match outcomes.

**Required Artifacts**
- Card reasoning metadata validators
- Golden fixtures for curated Standard Alpha match states
- Regression tests that fail when new cards skip metadata or break goldens

**Exit Criteria**
- Current-format cards expose normalized reasoning metadata.
- Golden-result fixtures prove deterministic outcomes for curated scenarios.
- Adding a card requires passing the same structured-context and golden checks.

### Phase 23: Complete E2E Lifecycle Coverage

**Skill Chain**: `senior-qa` -> `vitest` -> `playwright-pro` ->
`testing-patterns`

**Scope**
- Cover browser golden paths for practice, private lobby, casual queue, replay,
  and operator/admin flows.
- Add resilience coverage for reconnect, stale state, restart recovery, and
  match resume.
- Add agent-specific lifecycle tests for mulligan, combat, prompt handling,
  timeout/default handling, and concede flows.

**Required Artifacts**
- Playwright suites under `e2e/`
- Deterministic integration tests around bot transport and replay
- Golden-result assertions for authoritative outcomes

**Exit Criteria**
- Golden-path browser flows complete from signup to match or replay endpoints.
- Agent lifecycle tests cover seat join through match completion.
- Replay goldens prove stored events reproduce expected state.

### Phase 24: Benchmarks, Regression Gates, and Release Readiness

**Skill Chain**: `performance-testing` -> `browser-build-boundaries` ->
`project-health` -> `code-reviewer`

**Scope**
- Maintain deterministic benchmark harnesses for context generation,
  legal-action catalog generation, and scripted full-match lifecycles.
- Keep browser performance budgets explicit.
- Make `phase-check fast/full/regression` the authoritative local merge gates.
- Require a fresh `project-health` rerun before handoff or merge of this
  program.

**Required Artifacts**
- `bun run benchmark:deterministic`
- Regression-gate documentation and contract tests
- Health-audit notes captured in `SESSION.md` or the active churn tracker

**Exit Criteria**
- Deterministic benchmark budgets are enforced locally.
- Regression gates include workflow, rules, Convex, replay, benchmarks, and
  browser tests.
- The program can be handed off with a fresh health audit and session wrap.

## Operating Rules

- Update [CHURN_TRACKER.md](./CHURN_TRACKER.md) and `SESSION.md` whenever the
  active phase changes meaningfully.
- Treat [VERIFICATION_MATRIX.md](./VERIFICATION_MATRIX.md) as the source of
  truth for merge-gating commands.
- Treat [BENCHMARK_BUDGETS.md](./BENCHMARK_BUDGETS.md) as the source of truth
  for deterministic benchmark expectations.
- Before handoff or merge, rerun the `project-health` skill against the active
  program docs and record the result in `SESSION.md`.
