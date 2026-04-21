# Agent-Playable Current-Format Churn Tracker

This tracker mirrors the active Phase 19-24 program state. Keep it aligned with
`SESSION.md`.

## Current Churn

- **Active Phase**: Phase 19
- **Stage**: In Progress
- **Goal**: Land the control-plane docs, structured agent contract, deterministic
  goldens, and benchmark gates needed to complete the agent-playable program.

## Phase Status

| Phase | Status | Primary Deliverable | Proof |
| --- | --- | --- | --- |
| 19 | In Progress | `docs/program/*` source of truth | workflow contract tests |
| 20 | In Progress | `AgentMatchContextV1` + legal action catalog + telemetry | Vitest + bot runner telemetry |
| 21 | Pending | full gameplay-agent lifecycle parity | lifecycle integration coverage |
| 22 | In Progress | card reasoning metadata + current-format goldens | metadata validator + golden fixtures |
| 23 | Pending | full browser and resilience lifecycle coverage | Playwright and replay verification |
| 24 | In Progress | deterministic benchmark harness + regression gates | `phase-check.sh regression` |

## Phase 19 Checklist

- [x] Create program docs under `docs/program/`
- [x] Extend the repo phase model to cover Phases 19-24
- [x] Point `README.md`, `SESSION.md`, and `docs/PHASE_LOOP.md` at the program docs
- [ ] Rerun workflow contract tests after the doc contract lands

## Phase 20 Checklist

- [x] Add `AgentMatchContextV1`
- [x] Add `LegalActionDescriptorV1`
- [x] Add `PromptDecisionSchemaV1`
- [x] Add `BotDecisionTraceV1`
- [x] Replace prose-only advisory context with structured overlays
- [x] Record decision lifecycle telemetry
- [ ] Expand observability assertions beyond targeted unit coverage

## Phase 21 Checklist

- [x] Make gameplay policy select stable legal action ids
- [x] Validate selected action ids before `matches.submitIntent`
- [ ] Cover all authoritative intent kinds end to end
- [ ] Add reconnect, timeout, resume, and post-match archival proof

## Phase 22 Checklist

- [x] Add `CardReasoningMetadataV1`
- [x] Validate metadata when building the current catalog
- [x] Add curated Standard Alpha golden fixtures for deterministic agent play
- [ ] Add new-card admission flow coverage

## Phase 23 Checklist

- [x] Cover signup, deck creation, practice, queue, lobby, operator, and agent
  helper happy paths
- [x] Extend browser coverage to full match completion and replay verification
- [x] Add browser proof for stale-state operator recovery
- [x] Add reconnect resilience proof for active live matches
- [x] Add bot-runner restart lifecycle proof

## Phase 24 Checklist

- [x] Add deterministic benchmark harness
- [x] Add `benchmark:deterministic` to the regression gate
- [ ] Add browser performance budgets for representative match surfaces
- [ ] Record final `project-health` rerun before merge or handoff
