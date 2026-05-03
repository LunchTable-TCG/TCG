# Lunch Table Games CLI

Create a new Lunch Table Games starter project:

```bash
bunx lunchtable init
```

Use `--template` for non-interactive scaffolding:

```bash
bunx lunchtable init my-game --template dice --yes
```

Validate and evaluate a generated starter:

```bash
bunx lunchtable validate my-game
bunx lunchtable eval my-game
```

Available templates:

- `tcg`
- `dice`
- `side-scroller`
- `shooter-3d`

The `side-scroller` template is backed by `@lunchtable/games-side-scroller`,
which provides deterministic runner physics, two equal seats, legal movement
intents, platforms, hazards, collectibles, goals, and renderer-neutral scenes.

Every starter includes:

- `src/game.ts`: deterministic ruleset, state, legal intents, and render hints.
- `src/agents/baseline.ts`: a baseline policy that chooses from legal actions.
- `src/agents/external-http.ts`: request/response envelope helpers for hosted agents.
- `src/agents/mcp.ts`: a Model Context Protocol tool manifest.
- `src/agents/sse.ts`: Server-Sent Events context snapshots for browser and hosted agents.
- `src/agents/a2a.ts`: an Agent2Agent card for discovery-oriented agents.
- `src/agents/self-play.ts`: deterministic two-seat self-play.
- `src/mcp/server.ts`: a runnable stdio MCP server for local clients and agent tooling.
- `tests/agent-parity.test.ts`: legal-action and external-response parity checks.
- `tests/mcp-server.test.ts`: MCP initialize, resource, and legal-action tool checks.
- `tests/sse.test.ts`: scoped context and `text/event-stream` encoding checks.
- `tests/self-play.test.ts`: agent-vs-agent smoke coverage.

Use `bun run --silent mcp:stdio` when connecting a local MCP client so stdout
contains only newline-delimited JSON-RPC messages.
- `llms.txt` and `llms-full.txt`: LLM-readable starter maps.
- `.agents/skills/`: play, build, and evaluate skills for gameplay agents.
