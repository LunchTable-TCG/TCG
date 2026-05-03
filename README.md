# Lunch Table Games

Browser-first game library for generated games, tabletop games, side-scrollers,
agent-playable game packs, renderer-neutral scenes, and the current
rules-authoritative trading card game proof app.

Lunch Table Games is the umbrella platform in this repository. The TCG remains
the first full proof surface, while the public `@lunchtable/games-*` packages
and `lunchtable` CLI provide reusable primitives, scaffolds, APIs, asset
tooling, MCP/SSE/A2A agent surfaces, and release-ready npm packages for broader
game families.

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
  games-api/
  games-assets/
  games-render/
  games-side-scroller/
  game-core/
  card-content/
  render-pixi/
convex/
docs/
  platform/
  product/
  program/
  superpowers/
scripts/
```

The package map is documented in
[packages/README.md](packages/README.md). The docs map is documented in
[docs/README.md](docs/README.md).

## Core Scripts

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

Generated starters include portable pack files and can be checked without
executing arbitrary generated code:

```bash
bunx lunchtable validate my-dice-game
bunx lunchtable eval my-dice-game
```

Generated-game authoring now has an executable workflow for browser editors,
CLIs, renderers, and hosted agents. See
[docs/platform/GENERATED_GAME_AUTHORING.md](docs/platform/GENERATED_GAME_AUTHORING.md) and
[examples/generated-game-authoring.ts](examples/generated-game-authoring.ts).

Release proof packs the CLI and runs the packed artifact through `bunx` before
the full release gates:

```bash
bun run release:proof
```

Each scaffold is agent-native from day one: it includes a baseline local agent,
external HTTP envelopes, SSE context snapshots, a runnable stdio MCP server,
MCP tool metadata, an A2A agent card, self-play, and agent parity tests. Agents
submit legal action ids through the same ruleset path as human seats.

The side-scroller scaffold uses `@lunchtable/games-side-scroller`, a reusable
deterministic runner engine with two equal seats, movement, dash, jump, attack,
gravity, platforms, hazards, collectibles, goals, tabletop components, and
renderer-neutral side-scroller scenes.

Generated starters expose `bun run --silent mcp:stdio` so local MCP clients and
developer agent tools can connect immediately without script banners on stdout.
The server supports initialize,
`tools/list`, `tools/call`, `resources/list`, and `resources/read`, with
`submitAction` still gated by the current legal action catalog and state version.

The monorepo and every scaffold also ship LLM-readable maps and repo-local
skills:

- `llms.txt`
- `llms-full.txt`
- `.agents/skills/play-lunchtable-game/SKILL.md`
- `.agents/skills/build-lunchtable-game/SKILL.md`
- `.agents/skills/evaluate-lunchtable-agent/SKILL.md`

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
[docs/platform/MILADY_INTEGRATION.md](docs/platform/MILADY_INTEGRATION.md).

Hosted gameplay agents should use the elizaOS Cloud adapter in
`@lunchtable/games-ai`. It creates elizaOS Cloud agent profiles and
OpenAI-compatible decision requests, then resolves responses against the known
legal action catalog before a match intent can be submitted.

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
licenses are listed in [docs/product/CINEMATIC_ASSETS.md](docs/product/CINEMATIC_ASSETS.md).

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

Use the phase loop scripts to work through `docs/program/IMPLEMENTATION_PHASES.md`:

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

The full release handoff is documented in [docs/platform/RELEASE.md](docs/platform/RELEASE.md).

Generate release notes or cut an annotated tag locally:

```bash
bun run release:notes -- v0.1.1
bun run release:cut -- v0.1.1 --dry-run
```

The `v0.1.1` release workflow dry-runs and publishes `lunchtable`,
`@lunchtable/games-core`, `@lunchtable/games-render`,
`@lunchtable/games-ai`, `@lunchtable/games-api`,
`@lunchtable/games-assets`, `@lunchtable/games-tabletop`, and
`@lunchtable/games-side-scroller` to npm after the GitHub release gate passes.
The first npm publish requires the repository `NPM_TOKEN` secret; switch the
same packages to npm trusted publishing after their package records exist.

## GitHub Repository Setup

The GitHub repo is configured as the Lunch Table Games library home, not only
as a TCG app repo. The expected repo health setup is documented in
[docs/platform/GITHUB_SETUP.md](docs/platform/GITHUB_SETUP.md) and covered by workflow contract
tests. It includes Phase Gates for every push/PR, tag-based release publishing,
library-wide issue/PR templates, Dependabot for Actions and npm manifests, repo
topics, and branch protection for `main`.
