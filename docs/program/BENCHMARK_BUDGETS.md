# Benchmark Budgets

Deterministic benchmark budgets are merge-gating for the agent-playable current
format program.

## Command

```bash
bun run benchmark:deterministic
```

Artifacts are written to:

```text
.phase-loop/benchmarks/agent-playable-current-format.json
```

## Current Budgets

| Benchmark | Mean Budget | Why it matters |
| --- | --- | --- |
| `agent-context-build` | `<= 2.00 ms` | structured seat context must stay cheap enough for per-turn rebuilding |
| `legal-action-catalog` | `<= 1.00 ms` | policy selection depends on regenerating legal actions quickly |
| `scripted-current-format-match` | `<= 6.00 ms` | deterministic full-match playback must stay fast enough for goldens and CI |

## Budget Rules

- These budgets are deterministic local budgets, not live-model latency targets.
- Failing this harness blocks the regression gate.
- If a budget must change, update this file and the benchmark script in the same
  patch.
- Live-model telemetry such as token counts, invalid-response rate, and p95 turn
  latency is informative but non-gating.
