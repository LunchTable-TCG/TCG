# Lunch-Table

Web-first trading card game platform built with Bun, TypeScript, React, PixiJS, Convex, and self-custodied BSC wallet auth.

## Workspace

```text
apps/
  web/
  bot-runner/
packages/
  cli/
  bot-sdk/
  shared-types/
  games-core/
  games-tabletop/
  games-ai/
  games-render/
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

## Lunch Table Games CLI

The publishable CLI package is `lunchtable`. Once released, users can scaffold
a starter game with:

```bash
bunx lunchtable init
```

Non-interactive scaffolding supports the current starter families:

```bash
bunx lunchtable init my-card-game --template tcg --yes
bunx lunchtable init my-dice-game --template dice --yes
bunx lunchtable init my-runner --template side-scroller --yes
bunx lunchtable init my-arena --template shooter-3d --yes
```

Each scaffold is agent-native from day one: it includes a baseline local agent,
external HTTP envelopes, MCP tool metadata, an A2A agent card, self-play, and
agent parity tests. Agents submit legal action ids through the same ruleset path
as human seats.

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

Bundled sample summon assets live under `apps/web/public/cinematics/` and load
locally by default. Set `VITE_ASSET_CDN_BASE_URL` to override that root with a
CDN. When the selected asset root includes `cards/<card-id>/summon.glb`, the
summon portal upgrades from the procedural glyph to that model and uses an
optional `cards/<card-id>/poster.*` backdrop when present. Asset sources and
licenses are listed in [docs/CINEMATIC_ASSETS.md](docs/CINEMATIC_ASSETS.md).

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

For the agent-playable current-format program, use these docs as the active
source of truth:

- [docs/program/EXECUTION_PLAN.md](docs/program/EXECUTION_PLAN.md)
- [docs/program/CHURN_TRACKER.md](docs/program/CHURN_TRACKER.md)
- [docs/program/VERIFICATION_MATRIX.md](docs/program/VERIFICATION_MATRIX.md)
- [docs/program/BENCHMARK_BUDGETS.md](docs/program/BENCHMARK_BUDGETS.md)

Run the deterministic benchmark harness directly when working on gameplay-agent
context, legal actions, or replay/golden performance:

```bash
bun run benchmark:deterministic
```

## Release Proof

Run the release-ready gate sequence and local Convex bootstrap in one command:

```bash
bun run release:proof
```

The full release handoff is documented in [docs/RELEASE.md](docs/RELEASE.md).

Generate release notes or cut an annotated tag locally:

```bash
bun run release:notes -- v0.1.0
bun run release:cut -- v0.1.0 --dry-run
```
