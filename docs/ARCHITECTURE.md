# Lunchtable Architecture Spec

**Last updated**: 2026-04-03
**Scope**: Web-first trading card game platform with realtime online play, deterministic rules, replay support, and AI seats with human parity.

## Assumptions

- MVP is a 1v1 synchronous online TCG with hidden information.
- The rules kernel must support multiple future game styles without rewriting the engine:
  - stack-based response windows
  - lane battlers
  - tactics-card hybrids
  - simplified async PvE formats
- The renderer is not the source of truth.
- AI players must use the same public gameplay surface as humans, with the same seat restrictions and no bot-only game actions.

## Product Goals

1. Deterministic and replayable rules.
2. Premium visuals in the match surface without forcing all UI into canvas.
3. Fast realtime updates for humans, spectators, and bots.
4. Format-level extensibility for rules, card styles, and match structure.
5. Strong testability: pure rules package, backend contract tests, replay goldens.

## Chosen Stack

- Runtime and tooling: Bun, TypeScript, Vitest, Playwright.
- Web app shell: Vite + React 19.
- Match renderer: PixiJS 8 with `@pixi/react`.
- Premium hero moments only: Three.js / React Three Fiber.
- Backend and realtime state sync: Convex.
- Human auth: self-custodied local BSC wallet auth with custom JWT sessions in Convex.
- Bot and service auth: custom JWT provider in Convex auth config.
- Styling: tokens-first CSS variables, React DOM for all text-heavy UI.

## Why This Architecture

- TCGs are rules-heavy and UI-heavy. They benefit more from a pure simulation core and a high-end renderer than from a monolithic "game engine owns everything" model.
- Convex gives reactive queries, transactional mutations, subscriptions, and durable scheduling, which fit lobbies, seat views, match logs, and replay indexing.
- PixiJS gives the best balance for web TCG visuals: layered boards, particles, foil shaders, procedural FX, and animated cards without turning deckbuilder and collection screens into canvas apps.

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
  game-core/              Pure deterministic rules engine
  card-content/           Typed card definitions, formats, sets, keywords
  render-pixi/            Board, hand, stack, particles, shaders, animations
  shared-types/           Commands, DTOs, telemetry event names
  bot-sdk/                Seat view adapters, intent helpers, evaluation harness
docs/
  *.md
```

## Core Boundaries

### 1. `packages/game-core`

Owns:

- full authoritative match state
- turn structure
- priority and timing windows
- command validation
- ability resolution
- continuous and replacement effects
- deterministic RNG
- replay generation

Does not own:

- persistence
- auth
- network transport
- rendering
- sound
- timers as wall-clock primitives

### 2. `convex/`

Owns:

- user identity and authorization
- canonical user, wallet, and challenge records
- persistence of decks, collections, lobbies, matches, replays
- command ingestion
- transactional application of intents
- public/private seat projections
- matchmaking and scheduling
- telemetry and moderation hooks

Does not own:

- game logic implementation details beyond orchestration
- client animation state
- raw private keys

### 3. `apps/web` + `packages/render-pixi`

Owns:

- route-level product UI
- match presentation
- animation timelines
- local interaction affordances
- accessibility surfaces

Does not own:

- authoritative card legality
- hidden information derivation
- turn order

### 4. `apps/bot-runner`

Owns:

- subscribing to bot seat views
- choosing intents via model or heuristic policy
- submitting the same public gameplay intents as humans
- offline evaluation loops and self-play orchestration

Does not own:

- privileged writes to match state
- alternate gameplay mutations

## Authoritative Match Flow

1. A human or bot subscribes to a seat-scoped query.
2. The client submits a single intent through `matches.submitIntent`.
3. Convex validates identity, seat ownership, timing, and command shape.
4. `game-core` applies the command to the current authoritative state.
5. `game-core` emits:
   - next state snapshot
   - event log entries
   - hidden/public projection inputs
   - follow-up tasks such as pending triggers or delayed effects
6. The mutation commits snapshot, events, derived indices, and queueable work atomically.
7. Convex subscriptions update:
   - both seat views
   - spectator view
   - match shell
   - replay slices
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

## Extensibility Axes

The engine must not hardcode one card game. Each format plugs these axes:

- `turnModel`: alternating, rounds, simultaneous planning
- `timingModel`: full stack, fast/slow windows, no-response
- `boardModel`: open board, lanes, grid, objectives
- `resourceModel`: mana curve, energy, action points, auto-ramp
- `victoryModel`: life total, objectives, score race, boss defeat
- `deckRules`: deck size, sideboard, duplicate limits, commander rules
- `mulliganModel`: London, partial redraw, roguelite node draft
- `cardPool`: set legality and ban list

## Match Surface Split

- DOM/React:
  - navigation
  - deckbuilder
  - collection
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

## Non-Functional Requirements

- Determinism: same snapshot + same intent sequence + same seed = same replay.
- Hidden information safety: unauthorized clients never receive private zones.
- Recoverability: any live match can be reconstructed from snapshot + event stream.
- Rate control: all public gameplay mutations are idempotency-aware and seat-scoped.
- Performance: no live match path depends on full-table scans or text/vector search.
- Observability: every command application emits latency, state version, and failure reason.

## Anti-Patterns To Avoid

- Putting game rules into React state or Pixi scene objects.
- Letting bots call internal-only mutations.
- Storing giant fully rendered board DTOs as the only source of truth.
- Using LLM agent threads as the authoritative match state.
- Putting deckbuilder, collection, or settings into canvas by default.
