# Lunch-Table

Web-first trading card game platform built with Bun, TypeScript, React, PixiJS, Convex, and self-custodied BSC wallet auth.

## Workspace

```text
apps/
  web/
  bot-runner/
packages/
  shared-types/
  game-core/
  card-content/
  render-pixi/
convex/
docs/
scripts/
```

## Phase 1 Scripts

```bash
bun install
bun run lint
bun run typecheck
bun run test
```

## Development

```bash
bun run dev:web
bun run dev:bot
```

## Session Loop

Use the phase loop scripts to work through `IMPLEMENTATION_PHASES.md`:

```bash
./scripts/resume.sh
./scripts/phase-check.sh full
./scripts/phase-loop.sh --status "In Progress" --summary "..." --next "..."
```
