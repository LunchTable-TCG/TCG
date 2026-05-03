# Lunch Table Games Packages

The package tree is organized around public reusable library packages first,
then proof-game and app support packages.

## Public Packages

These packages are released from the monorepo and must stay portable.

- `@lunchtable/games-core`: deterministic state, RNG, intents, events,
  transitions, prompts, replay, and ruleset contracts.
- `@lunchtable/games-render`: renderer-neutral scene models, interaction hints,
  cameras, cues, and asset references.
- `@lunchtable/games-ai`: legal action frames, agent envelopes, SSE snapshots,
  elizaOS Cloud orchestration helpers, and parity validation.
- `@lunchtable/games-api`: HTTP, SSE, A2A, and agent-facing API adapters.
- `@lunchtable/games-assets`: asset bundles, sprite metadata, hitboxes,
  tilemaps, timelines, atlas export, and generated asset requests.
- `@lunchtable/games-tabletop`: seats, zones, decks, dice, boards, visibility,
  and tabletop object primitives.
- `@lunchtable/games-side-scroller`: deterministic two-seat side-scroller
  runtime, legal actions, scenes, asset integration, and self-play helpers.
- `lunchtable`: CLI for `bunx lunchtable init`, validation, and generated-game
  evaluation.

## Proof And Support Packages

These packages keep the current TCG proof app working while reusable boundaries
are extracted.

- `@lunchtable/game-core`: current TCG rules engine proof surface.
- `@lunchtable/card-content`: starter TCG cards, formats, and decks.
- `@lunchtable/bot-sdk`: TCG bot seat adapters and evaluation harnesses.
- `@lunchtable/render-pixi`: Pixi renderer for the browser proof app.
- `@lunchtable/shared-types`: Convex and app DTO contracts.

## Dependency Direction

Generic `@lunchtable/games-*` packages must not import app code, Convex
functions, React components, Pixi components, Three.js components, TCG rules,
or card content. Apps, Convex orchestration, and proof-game packages depend
inward on the reusable library packages.
