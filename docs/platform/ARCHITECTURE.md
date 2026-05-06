# Lunch Table Games Architecture Spec

**Last updated**: 2026-05-05
**Scope**: Browser-first Lunch Table Games suite with deterministic game
runtimes, generated-game packs, agent parity, renderer-neutral scenes, asset
pipelines, and proof apps across tabletop/card, dice, side-scroller, and 3D
arena families.

## Assumptions

- The current TCG is the first full proof surface, not the repository boundary.
- Public `@lunchtable/games-*` packages must stay portable across game
  families, renderers, apps, and hosted agents.
- Generated games enter through validated packs, scaffolds, simulations, and
  replay fixtures instead of arbitrary runtime code.
- Every human, local bot, hosted Eliza agent, MCP client, SSE consumer, and API
  caller uses the same legal action contracts.
- The renderer is not the source of truth.
- Proof apps, Convex orchestration, Pixi, Three.js, and TCG-specific packages
  depend inward on the reusable suite packages.

## Product Goals

1. Deterministic, replayable game runtimes for multiple genres.
2. First-class human and AI participation through scoped views and legal
   action ids.
3. Renderer-neutral scene output that can drive DOM, Pixi, Three.js, and future
   adapters.
4. Generated-game admission with schema validation, simulation, self-play,
   assets, MCP/SSE/API surfaces, and LLM-readable context.
5. Strong suite-level testability: generic package boundary tests, scaffold
   proofs, replay goldens, release package dry-runs, and app continuity gates.

## Chosen Stack

- Runtime and tooling: Bun, TypeScript, Vitest, Playwright.
- Web app shell: Vite + React 19.
- 2D and 2.5D proof renderer: PixiJS 8 with `@pixi/react`.
- 3D and cinematic proof renderer: Three.js / React Three Fiber.
- Backend and realtime state sync: Convex.
- Human auth: self-custodied local BSC wallet auth with custom JWT sessions in Convex.
- Bot and service auth: custom JWT provider in Convex auth config.
- Styling: tokens-first CSS variables, React DOM for all text-heavy UI.

## Why This Architecture

- Generated games need deterministic authority, typed pack contracts, and
  renderer-neutral scenes before they need one monolithic browser engine.
- AI agents need stable, inspectable action surfaces. They should receive the
  same legal intents, scoped views, and version checks as humans.
- Convex gives reactive queries, transactional mutations, subscriptions, and
  durable scheduling, which fit lobbies, seat views, match logs, replay
  indexing, generated assets, and hosted agent orchestration.
- PixiJS and Three.js remain adapters over scene models. They make the proof
  apps rich without letting canvas or WebGL become game authority.

## Monorepo Layout

```text
apps/
  web/                    React product shell + match client
  bot-runner/             Long-running AI seat workers using ConvexClient
convex/
  schema.ts
  auth.config.ts
  users.ts
  cards.ts
  decks.ts
  lobbies.ts
  matches.ts
  replays.ts
  agents.ts
  internal/
packages/
  games-core/             Deterministic state, RNG, intents, events, replay
  games-tabletop/         Seats, zones, objects, decks, dice, visibility
  games-ai/               Legal actions, agent envelopes, SSE/A2A helpers
  games-api/              Agent-facing HTTP, SSE, A2A, and MCP API adapters
  games-assets/           Sprite, tilemap, timeline, atlas, and asset bundles
  games-render/           Renderer-neutral scenes, cameras, cues, interactions
  games-side-scroller/    Two-seat deterministic side-scroller ruleset
  cli/                    bunx lunchtable init, validation, and eval
  game-core/              Current TCG rules engine proof surface
  card-content/           Typed TCG card definitions, formats, decks
  render-pixi/            Browser proof renderer
  shared-types/           Convex and app DTO contracts
  bot-sdk/                TCG seat adapters and evaluation harness
docs/
  platform/               Reusable library architecture and operations
  product/                Browser proof product specs
  program/                Implementation phases, status, and verification
  superpowers/            Local methodology docs
```

## Suite Boundaries

### 1. Public `@lunchtable/games-*` packages

Owns:

- deterministic shells, RNG, lifecycle, intents, transitions, prompts, and replay
- tabletop seats, zones, objects, decks, dice, boards, permissions, and visibility
- legal action frames, agent envelopes, external decision resolution, SSE, A2A,
  and elizaOS Cloud helpers
- HTTP, SSE, MCP, and API adapters for agent and developer access
- asset bundles, sprite sheets, tilemaps, hitboxes, pivots, timelines, and atlas export
- renderer-neutral scene models, cameras, cues, interactions, and asset hints
- side-scroller runtime, self-play helpers, scenes, and asset integration

Does not own:

- product routes or Convex functions
- TCG rules or card content
- React components
- Pixi or Three.js components
- privileged hosted-service credentials

### 2. `lunchtable` CLI

Owns:

- `bunx lunchtable init`
- TCG, dice, side-scroller, and 3D shooter starter scaffolds
- generated pack validation and evaluation commands
- scaffolded MCP servers, LLM context files, agent skills, and self-play tests
- starter asset manifests and side-scroller asset studio examples

Does not own:

- authoritative hosted match state
- npm package publication credentials
- renderer-specific game logic

### 3. Proof-game packages

Owns:

- current TCG rules engine and proof-game state transitions
- starter cards, starter decks, formats, and generated card/tabletop packs
- TCG bot SDK adapters and evaluation harnesses
- Pixi proof renderer for the browser app

Does not own:

- generic suite primitives
- generated-game admission policy
- renderer-neutral contracts for every game family

### 4. `convex/`

Owns:

- user identity and authorization
- canonical user, wallet, and challenge records
- persistence of decks, collections, lobbies, matches, replays, assets, and agent metadata
- command ingestion
- transactional application of intents
- public/private seat projections
- matchmaking and scheduling
- generated asset storage and server-side elizaOS Cloud calls
- telemetry and moderation hooks

Does not own:

- game logic implementation details beyond orchestration
- client animation state
- raw private keys

### 5. `apps/web`

Owns:

- route-level product UI
- TCG proof client
- generated pack editor
- asset studio panel
- match presentation
- animation timelines
- local interaction affordances
- accessibility surfaces

Does not own:

- authoritative rules
- hidden information derivation
- agent-only game actions

### 6. `apps/bot-runner`

Owns:

- subscribing to bot seat views
- choosing intents via model or heuristic policy
- submitting the same public gameplay intents as humans
- offline evaluation loops and self-play orchestration

Does not own:

- privileged writes to match state
- alternate gameplay mutations

### 7. TCG rules proof surface

Owns:

- full authoritative TCG match state
- turn structure, priority, timing windows, command validation, and ability resolution
- deterministic RNG
- replay generation

Does not own:

- persistence
- auth
- network transport
- rendering
- sound
- timers as wall-clock primitives

## Authoritative Game Flow

1. A human, bot, MCP client, hosted Eliza agent, or spectator receives a
   scoped view.
2. A participant submits one legal intent through the ruleset-specific public
   action path.
3. The authority layer validates state version, seat ownership, phase,
   permissions, costs, targets, and prompt requirements.
4. The ruleset applies the intent to the current authoritative state.
5. The ruleset emits:
   - next state snapshot
   - event log entries
   - hidden/public projection inputs
   - follow-up tasks such as pending triggers or delayed effects
6. The mutation commits snapshot, events, derived indices, and queueable work atomically.
7. Projections update:
   - both seat views
   - spectator view
   - game shell
   - replay slices
   - render scenes
   - agent decision frames
8. Non-critical work runs after commit:
   - notifications
   - analytics
   - AI coach suggestions
   - cosmetic unlocks

## State Model

### Hot Match Documents

Hot documents stay small and normalized:

- `matches`: shell metadata, pointers, status, timers
- `match_states`: current authoritative snapshot
- `match_events`: append-only event log
- `match_views`: cached projections per seat and spectator
- `match_prompts`: current unresolved decision prompts

### Cold / Historical Documents

- `replays`
- `analytics_events`
- `agent_runs`
- `moderation_events`

## Game Family Axes

The suite must not hardcode one card game. Each game family plugs these axes:

- `turnModel`: alternating, rounds, simultaneous planning
- `timingModel`: full stack, fast/slow windows, no-response
- `boardModel`: open board, lanes, grid, objectives
- `resourceModel`: mana curve, energy, action points, auto-ramp
- `victoryModel`: life total, objectives, score race, boss defeat
- `deckRules`: deck size, sideboard, duplicate limits, commander rules
- `mulliganModel`: London, partial redraw, roguelite node draft
- `cardPool`: set legality and ban list
- `movementModel`: grid, platformer, lane, free arena, or tabletop placement
- `cameraModel`: orthographic 2D, isometric 2.5D, side-scroller, table 3D, or
  first-person arena
- `assetModel`: cards, dice, tokens, sprites, tilemaps, models, materials, and
  timelines
- `agentModel`: legal action descriptors, context frames, self-play, MCP, SSE,
  A2A, and external decision services

## Surface Split

- DOM/React:
  - navigation
  - deckbuilder
  - collection
  - generated pack editor
  - asset studio
  - social surfaces
  - modals
  - settings
  - text-heavy prompts
  - accessibility labels and keyboard affordances
- Pixi:
  - battlefield
  - hand layout
  - card motion
  - attack previews
  - particles
  - camera movement
  - foil effects
  - board materials
- Optional R3F:
  - booster opening
  - cinematic summon intros
  - premium arena backgrounds
  - 3D tabletop and arena prototypes

## Non-Functional Requirements

- Determinism: same snapshot + same intent sequence + same seed = same replay.
- Hidden information safety: unauthorized clients never receive private zones.
- Recoverability: any live match can be reconstructed from snapshot + event stream.
- Rate control: all public gameplay mutations are idempotency-aware and seat-scoped.
- Performance: no live match path depends on full-table scans or text/vector search.
- Observability: every command application emits latency, state version, and failure reason.
- Portability: public packages build and pack without app, Convex, renderer, or
  TCG-only imports.
- Agent parity: generated starters ship API, MCP, SSE/A2A context, LLM maps,
  skills, and self-play tests from day one.

## Anti-Patterns To Avoid

- Putting game rules into React state or Pixi scene objects.
- Letting bots call internal-only mutations.
- Storing giant fully rendered board DTOs as the only source of truth.
- Using LLM agent threads as the authoritative match state.
- Putting deckbuilder, collection, or settings into canvas by default.
