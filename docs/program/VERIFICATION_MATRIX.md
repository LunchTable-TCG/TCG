# Verification Matrix

This matrix is the merge-gating source of truth for the agent-playable current
format program.

## Gate Commands

### Fast

```bash
./scripts/phase-check.sh fast
```

Expected scripts:
- `bun run typecheck`
- `bun run test:unit` when present, otherwise `bun run test`

### Full

```bash
./scripts/phase-check.sh full
```

Expected scripts:
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`

### Regression

```bash
./scripts/phase-check.sh regression
```

Expected scripts:
- `bun run test:workflow`
- `bun run test:rules`
- `bun run test:convex`
- `bun run test:replay`
- `bun run benchmark:deterministic`
- `bun run test:e2e`

## Proof Layers

| Layer | Proof Target | Primary Command | Representative Files |
| --- | --- | --- | --- |
| Docs contract | phase scripts and source-of-truth docs stay aligned | `bun run test:workflow` | `tests/phase-gates-workflow.test.ts`, `tests/program-docs-contract.test.ts` |
| Engine and types | authoritative rules and DTOs stay deterministic | `bun run test:rules` | `packages/game-core/src/**/*.test.ts`, `tests/shared-domain-types.test.ts` |
| Convex and bot transport | seat views, intents, bot transport, and advisory helpers stay aligned | `bun run test:convex` | `tests/bot-foundation.test.ts`, `tests/agent-lab-helpers.test.ts`, `tests/match-intent-helpers.test.ts` |
| Replay | stored events reproduce expected replay outputs | `bun run test:replay` | `tests/replay-contract.test.ts`, `tests/replay-golden.test.ts` |
| Goldens | current-format agent choices and match outcomes stay stable | targeted Vitest | `tests/agent-playability.test.ts`, `tests/fixtures/agent-playability.standard-alpha.json` |
| Browser lifecycle | signup, decks, match entry, agents, queue, lobby, operator flows work | `bun run test:e2e` | `e2e/app-happy-path.spec.ts`, `e2e/cinematic-preview.spec.ts` |
| Benchmarks | deterministic performance budgets remain within limits | `bun run benchmark:deterministic` | `scripts/run-deterministic-benchmarks.ts` |

## Handoff Requirement

Before handoff or merge of Phase 19-24 work:
- rerun the relevant fast/full/regression gates
- rerun the `project-health` skill against `docs/program/EXECUTION_PLAN.md`
- record the health-audit outcome in `SESSION.md`
