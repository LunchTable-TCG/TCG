# Generated Game Authoring

Lunch Table Games admits generated games through portable packs and fixed
verification gates. Generated content should become data, tests, renderer scene
models, agent-readable docs, and MCP tools before it becomes a playable starter.

## Authoring Flow

1. Capture a brief with genre, player count, view mode, and win condition.
2. Draft `game.json`, `ruleset.json`, `objects.json`, starter content, and tests.
3. Validate pack references and schema constraints.
4. Simulate deterministic self-play and write a replay golden.
5. Prove agent parity through legal action ids and scoped views.
6. Plan renderer adapters from the renderer-neutral scene model.
7. Ship `llms.txt`, `llms-full.txt`, MCP tests, and agent skills.

The `@lunchtable/games-tabletop` authoring helpers return the required files,
stages, gates, and publish readiness state for browser editors and CLIs.

## Renderer Planning

Renderers consume `RenderSceneModel` only. The `@lunchtable/games-render`
adapter planner chooses a primary adapter, fallback adapters, layer stack, and
production budget without importing Pixi, Three.js, React, DOM runtime code, or
game-specific rules.

## Hosted Eliza Agents

Hosted Eliza agents use the same legal action contract as local agents. The
elizaOS Cloud orchestration helper points gameplay agents at the OpenAI-compatible
chat completions endpoint, requires `ELIZA_CLOUD_API_KEY`, and keeps MCP tools
limited to `listLegalActions`, `getSeatView`, and `submitAction`.

References:

- elizaOS Cloud chat completions API:
  <https://www.elizacloud.ai/docs/api/chat>
- elizaOS docs index and Cloud deployment overview:
  <https://docs.elizaos.ai/>

## Example

See `examples/generated-game-authoring.ts` for a side-scroller authoring example
that wires authoring workflow, renderer planning, and hosted Eliza orchestration
together.
