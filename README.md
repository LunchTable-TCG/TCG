# Lunch-Table

Web-first trading card game platform built with Bun, TypeScript, React, PixiJS, Convex, and self-custodied BSC wallet auth.

## Workspace

```text
apps/
  web/
  bot-runner/
packages/
  bot-sdk/
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

## External Agent Seats

The bot runner can delegate a bot seat to an external decision service while
keeping Convex as the only match authority.

```bash
BOT_POLICY_MODE=external-http \
BOT_EXTERNAL_DECISION_URL=http://127.0.0.1:8787/lunchtable/decide \
bun run dev:bot
```

The endpoint receives a validated seat-decision envelope from
`@lunchtable/bot-sdk` and must reply with one legal `actionId` or `null`. See
[docs/MILADY_INTEGRATION.md](docs/MILADY_INTEGRATION.md).

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

## Phase 16 Agent Lab

The agent lab is intentionally non-authoritative:

- live match turns still resolve only through `matches.submitIntent`
- coach threads read the signed-in player's owned seat view
- commentator threads read spectator-safe public state only
- helper thread history is stored in the Convex Agent component, separate from
  match snapshots, events, and replay frames

The current implementation uses deterministic helper replies so the feature
works locally without any external model credentials.

## Session Loop

Use the phase loop scripts to work through `IMPLEMENTATION_PHASES.md`:

```bash
./scripts/resume.sh
./scripts/phase-check.sh full
./scripts/phase-loop.sh --status "In Progress" --summary "..." --next "..."
```

## Release Proof

Run the release-ready gate sequence and local Convex bootstrap in one command:

```bash
bun run release:proof
```

The full release handoff is documented in [docs/RELEASE.md](docs/RELEASE.md).
