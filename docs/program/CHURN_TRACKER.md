# Agent-Playable Current-Format Churn Tracker

This tracker mirrors the active Phase 19-24 program state. Keep it aligned with
`docs/program/SESSION.md`.

## Current Churn

- **Active Phase**: Phase 24
- **Stage**: Complete
- **Goal**: The current-format agent-playable closeout is complete and release
  ready. Next optional work is release/tag/deploy choreography or broader
  format expansion.

## Phase Status

| Phase | Status | Primary Deliverable | Proof |
| --- | --- | --- | --- |
| 19 | Complete | `docs/program/*` source of truth | workflow contract tests |
| 20 | Complete | `AgentMatchContextV1` + legal action catalog + telemetry | Vitest + bot runner telemetry |
| 21 | Complete | full gameplay-agent lifecycle parity for the current authoritative intent surface | reducer, persisted-intent, bot lifecycle, and browser coverage |
| 22 | Complete | card reasoning metadata + current-format goldens | metadata validator + golden fixtures |
| 23 | Complete | full browser and resilience lifecycle coverage | Playwright and replay verification |
| 24 | Complete | deterministic benchmark harness + regression gates | `phase-check.sh regression` + `bun run release:proof` |

## Phase 19 Checklist

- [x] Create program docs under `docs/program/`
- [x] Extend the repo phase model to cover Phases 19-24
- [x] Point `README.md`, `docs/program/SESSION.md`, and `docs/program/PHASE_LOOP.md` at the program docs
- [x] Rerun workflow contract tests after the doc contract lands

## Phase 20 Checklist

- [x] Add `AgentMatchContextV1`
- [x] Add `LegalActionDescriptorV1`
- [x] Add `PromptDecisionSchemaV1`
- [x] Add `BotDecisionTraceV1`
- [x] Replace prose-only advisory context with structured overlays
- [x] Record decision lifecycle telemetry
- [x] Expand observability assertions beyond targeted unit coverage

## Phase 21 Checklist

- [x] Make gameplay policy select stable legal action ids
- [x] Validate selected action ids before `matches.submitIntent`
- [x] Cover all authoritative intent kinds end to end
- [x] Add reconnect, resume, restart, and decision-trace proof for live gameplay agents

## Phase 22 Checklist

- [x] Add `CardReasoningMetadataV1`
- [x] Validate metadata when building the current catalog
- [x] Add curated Standard Alpha golden fixtures for deterministic agent play
- [x] Add new-card admission flow coverage

## Phase 23 Checklist

- [x] Cover signup, deck creation, practice, queue, lobby, operator, and agent
  helper happy paths
- [x] Extend browser coverage to full match completion and replay verification
- [x] Cover casual queue completion and replay restoration for both players
- [x] Add browser proof for stale-state operator recovery
- [x] Add reconnect resilience proof for active live matches
- [x] Add bot-runner restart lifecycle proof

## Phase 24 Checklist

- [x] Add deterministic benchmark harness
- [x] Add `benchmark:deterministic` to the regression gate
- [x] Add browser performance budgets for representative match surfaces
- [x] Record final health audit before merge or handoff

## Program Closeout

- **Recorded At**: 2026-04-21
- **Release Proof**: `bun run release:proof`
- **Regression Gate**: `./scripts/phase-check.sh regression`
- **Health Audit**: recorded in `docs/program/SESSION.md`
