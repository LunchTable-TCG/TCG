# Lunch Table Games CLI

Create a new Lunch Table Games starter project:

```bash
bunx lunchtable init
```

Use `--template` for non-interactive scaffolding:

```bash
bunx lunchtable init my-game --template dice --yes
```

Available templates:

- `tcg`
- `dice`
- `side-scroller`
- `shooter-3d`

Every starter includes:

- `src/game.ts`: deterministic ruleset, state, legal intents, and render hints.
- `src/agents/baseline.ts`: a baseline policy that chooses from legal actions.
- `src/agents/external-http.ts`: request/response envelope helpers for hosted agents.
- `src/agents/mcp.ts`: a Model Context Protocol tool manifest.
- `src/agents/a2a.ts`: an Agent2Agent card for discovery-oriented agents.
- `src/agents/self-play.ts`: deterministic two-seat self-play.
- `tests/agent-parity.test.ts`: legal-action and external-response parity checks.
- `tests/self-play.test.ts`: agent-vs-agent smoke coverage.
