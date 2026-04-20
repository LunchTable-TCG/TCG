# Phase Loop

This repo uses a repeatable execution loop for each implementation phase:

1. Resume the current state.
2. Implement the scoped work for the current phase.
3. Run fast feedback checks.
4. Run full validation.
5. Run regression checks.
6. Create a structured checkpoint commit.
7. Push if a remote exists.
8. Advance `SESSION.md` to the next phase.
9. Repeat.

## Program Docs

For the agent-playable current-format program in Phases 19-24, the control
plane lives under `docs/program/`:

- `docs/program/EXECUTION_PLAN.md`
- `docs/program/CHURN_TRACKER.md`
- `docs/program/VERIFICATION_MATRIX.md`
- `docs/program/BENCHMARK_BUDGETS.md`

Before handoff or merge of Phase 19-24 work, rerun the `project-health` skill
against those docs and record the result in `SESSION.md`.

## Commands

Resume the current state:

```bash
./scripts/resume.sh
```

Run checks manually:

```bash
./scripts/phase-check.sh fast
./scripts/phase-check.sh full
./scripts/phase-check.sh regression
```

Create a checkpoint commit without advancing:

```bash
./scripts/checkpoint.sh \
  --status "In Progress" \
  --stage "Implementation" \
  --summary "Implemented the first half of the current phase" \
  --next "Continue in the current phase from the next unchecked task."
```

Advance the tracker after a completed phase:

```bash
./scripts/advance-phase.sh \
  --next-action "Start the first task in the new current phase."
```

Run the full loop in one command:

```bash
./scripts/phase-loop.sh \
  --status "Complete" \
  --stage "Verification" \
  --summary "Completed the current phase and passed all gates." \
  --next "Start the next phase from its first task." \
  --advance \
  --push
```

## Expected Behavior

- `phase-check.sh` writes logs under `.phase-loop/logs/`.
- `checkpoint.sh` stages all changes, creates a structured commit, and then updates `SESSION.md` with the last checkpoint hash as an uncommitted change.
- `advance-phase.sh` marks the current phase complete, promotes the next pending phase to in progress, and updates the top-level session header.
- `phase-loop.sh` runs the gates in order, checkpoints, optionally pushes, and optionally advances.

## Regression Prevention

The loop assumes three validation layers:

- `fast`: narrow checks with the shortest runtime.
- `full`: standard project validation such as lint, typecheck, and test.
- `regression`: deeper suites such as replay goldens, backend contract tests, and end-to-end tests.

If `phase-loop.conf` exists, the scripts use the commands declared there. Otherwise they auto-detect common Bun scripts from `package.json`.

## CI

The GitHub Actions workflow at `.github/workflows/phase-gates.yml` runs the same `full` and `regression` gates on push and pull request once the workspace is bootstrapped.
