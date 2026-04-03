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
bun install
bun run setup:convex-auth-local --sync
bun run dev:web
bun run dev:bot
```

## Convex Local Auth

Bootstrap the local wallet-auth issuer and sync those variables into the local
Convex deployment:

```bash
bun run setup:convex-auth-local --sync
bun run dev:convex
```

The generated `.env.local` lives at the repository root. The Vite app is
configured to read root-level env files, so you do not need to copy
`VITE_CONVEX_URL` into `apps/web/`. The same setup step also seeds
`BOT_RUNNER_SECRET` for the local bot runner and syncs it into the Convex
deployment so `agents.issueBotSession` can work locally.

## Session Loop

Use the phase loop scripts to work through `IMPLEMENTATION_PHASES.md`:

```bash
./scripts/resume.sh
./scripts/phase-check.sh full
./scripts/phase-loop.sh --status "In Progress" --summary "..." --next "..."
```
