# Lunch Table Games Design

Date: 2026-05-02
Status: Approved design
Repository: LunchTable-TCG/TCG

## Goal

Build Lunch Table Games as a modern browser-first tabletop game library inside the current TCG monorepo first. The library should provide portable primitives, deterministic runtime utilities, AI-compatible action surfaces, renderer-neutral scene models, and generated-game admission tools.

The first proof game is a rules-authoritative card/tabletop duel. It reuses the current TCG implementation while extracting generic primitives that can later support broader tabletop games, 2.5D views, 3D table views, side-scroller ruleset families, and FPS-like arena ruleset families.

## Chosen Approach

Extract generic Lunch Table Games packages in place. The current TCG remains the working proof surface while reusable boundaries are proven.

This path has the lowest product risk because the existing app, Convex backend, replay fixtures, bot SDK, Pixi renderer, and card content continue to verify the extraction. A separate repo or package publishing step should wait until the generic package boundaries are stable.

## Package Architecture

Generic packages:

- `@lunchtable/games-core`: deterministic state, RNG, intents, events, transitions, prompts, replay.
- `@lunchtable/games-tabletop`: seats, zones, tabletop objects, decks, dice, boards, permissions, visibility primitives.
- `@lunchtable/games-ai`: legal actions, decision frames, external agent envelopes, parity helpers.
- `@lunchtable/games-render`: renderer-neutral scene models, interaction hints, cue models, camera hints.
- `lunchtable`: CLI entry point for `bunx lunchtable init` starter scaffolds.

First proof game packages and surfaces:

- `@lunchtable/tcg-rules`: card DSL, abilities, formats, deck legality, TCG-specific ruleset implementation.
- `@lunchtable/card-content`: starter cards, starter decks, generated card/tabletop duel packs.
- `apps/web`: browser proof client using React, Pixi, and optional Three.js cinematic overlays.
- `convex/`: authoritative persistence, realtime transport, identity, match submission, projections.

Dependency direction:

- TCG-specific packages may depend on generic Lunch Table Games packages.
- Generic packages must not import TCG rules, card content, Convex functions, React components, Pixi components, Three.js components, or app code.
- Product apps and Convex orchestration depend inward on generic and TCG-specific packages.

## Authoritative Runtime

Every game runs through one deterministic authority loop:

1. A player, AI seat, or spectator receives a scoped view.
2. A player or AI submits an intent.
3. The ruleset validates state version, seat ownership, phase, permissions, costs, targets, and prompt requirements.
4. The runtime applies the transition and emits next state, events, prompts, and replay data.
5. Projection functions derive seat views, spectator views, render scenes, and AI decision frames.

Renderers and AI never mutate authoritative game state directly.

## Core Primitives

`GameShell` owns identity and lifecycle fields:

- id
- status
- phase
- active seat
- priority seat where applicable
- turn or round number
- state version
- timers
- format or ruleset summary

`Seat` owns player-facing authority fields:

- actor type
- status
- visibility scope
- permissions
- resources
- private/public zones
- timers

`Zone` represents ordered or unordered spaces:

- deck
- hand
- board
- bag
- discard
- stack
- command or objective spaces
- custom named spaces

`TabletopObject` represents interactive game pieces:

- cards
- tokens
- dice
- pieces
- boards
- counters
- attachments
- model or asset references

`Prompt` represents unresolved decisions:

- choice prompts
- target prompts
- cost prompts
- mode prompts
- attacker/blocker prompts
- forced default prompts

`Replay` represents deterministic reconstruction:

- initial seed
- initial state reference
- intent log
- event log
- snapshot checkpoints
- replay metadata

## Ruleset Plugin Contract

Each game family implements a ruleset contract:

```ts
interface GameRuleset<TConfig, TState, TIntent, TSeatView, TSpectatorView, TScene> {
  createInitialState(config: TConfig): TState;
  listLegalIntents(state: TState, seat: string): TIntent[];
  applyIntent(state: TState, intent: TIntent): GameTransition<TState>;
  deriveSeatView(state: TState, seat: string): TSeatView;
  deriveSpectatorView(state: TState): TSpectatorView;
  deriveRenderScene(view: TSeatView | TSpectatorView, viewport: Viewport): TScene;
}
```

The current TCG reducer, state version checks, hidden-zone projections, replay helpers, prompts, legal bot action descriptors, and Pixi scene model become the first concrete implementation.

## CLI Starter Contract

The `lunchtable` CLI is the public project entry point. It starts with:

```bash
bunx lunchtable init
```

Generated starters can be admitted and evaluated with:

```bash
bunx lunchtable validate <directory>
bunx lunchtable eval <directory>
```

The CLI presents starter choices and can run non-interactively through
`--template` and `--yes`. The supported starter choices are:

- `tcg`: card/tabletop duel starter using zones, card-like objects, and priority intents.
- `dice`: deterministic dice/tabletop starter using dice components and board surfaces.
- `side-scroller`: side-scroller starter shell using side-scroller camera hints and movement intents.
- `shooter-3d`: first-person arena starter shell using 3D camera hints, arena pieces, and action intents.

These starters are admission-ready shells, not full game engines. Each starter
must include a typed ruleset, initial state, legal intents, render-scene hints,
tests, portable pack files, and package metadata using the generic Lunch Table
Games packages. The CLI does not execute arbitrary generated code.

Every starter must also include agent participation surfaces:

- baseline local agent policy
- external HTTP decision envelope
- MCP-compatible gameplay tool manifest
- A2A-compatible agent card
- deterministic self-play runner
- `llms.txt` and `llms-full.txt`
- repo-local `SKILL.md` files for play, build, and evaluation workflows
- agent parity tests proving agents choose from legal actions and submit through the ruleset

## Generated Game Packs

AI-generated games enter through validated game packs, not arbitrary runtime code.

The generated-game pipeline is:

1. Design brief: genre, player count, win condition, camera, asset style.
2. Game pack draft: manifest, components, rules, content, render hints.
3. Validation: schema checks, legal zones, effect support, asset references.
4. Simulation: golden replay, bot playability, determinism tests.
5. Publishable pack: portable folder or package with examples and tests.

A portable game pack contains:

- `game.json`: id, title, version, supported runtime.
- `ruleset.json`: phases, permissions, legal intents, victory model.
- `objects.json`: cards, tokens, dice, pieces, boards, bags.
- `content/`: cards, decks, scenarios, starter setups.
- `assets/`: images, models, materials, audio metadata.
- `tests/`: replay goldens and admission tests.

Extension levels:

- Level 1: data-only content such as cards, pieces, boards, dice, scenarios.
- Level 2: DSL rules such as effects, triggers, costs, targeting, prompts.
- Level 3: custom ruleset plugin with `applyIntent` and `listLegalIntents`.
- Level 4: custom renderer adapter for Pixi, Three.js, DOM, or another browser renderer.

v0 supports card/tabletop duel packs first. Side-scroller and FPS-like games remain future ruleset families.

## Rendering And Portability

Renderers consume scene models. They do not compute rules, reveal hidden information, or mutate authoritative state.

Rendering layers:

- Scene model: seats, objects, zones, cues, camera hints, interactions.
- DOM adapter: prompts, inspectors, menus, deck builders, accessibility surfaces.
- Pixi adapter: 2D and 2.5D boards, card motion, particles, table surfaces.
- Three.js adapter: 3D table views, cinematic moments, model-based arenas.

v0 view modes:

- table view
- seat view
- spectator view
- cinematic overlay

Future view families:

- side-scroller ruleset family
- FPS-like arena ruleset family
- 3D tabletop adapter
- editor tools

The current Pixi board scene model seeds renderer-neutral scene derivation. The existing Three.js cinematic summon path remains an optional overlay fed by events.

## AI Parity

AI seats use the same public intent contract and scoped seat views as human seats.

The AI package should preserve these constraints from the current TCG implementation:

- Bots may only choose from legal action descriptors derived from their seat view.
- Bots may only observe information available to their seat.
- External decision services receive envelopes of legal actions and scoped context.
- External responses resolve to one known action id or no action.
- Bot submissions use the same authoritative mutation path as human submissions.

The generic AI package additionally exposes portable agent primitives:

- `AgentCapabilityManifest`
- `AgentObservationFrame`
- `AgentPolicy`
- canonical gameplay tool descriptors
- MCP tool manifest helpers
- A2A agent card helpers
- deterministic agent-turn and self-play helpers

The Convex Agent component and future model integrations can support coaching, commentary, deck advice, tutorial help, and content generation, but they are not live match authority.

## Verification Gates

The extraction is complete only if all gates pass:

- Type boundaries: generic packages do not import TCG, Convex, React, Pixi, Three.js, or app code.
- Rules determinism: same seed plus same intents produces same states and events.
- Visibility safety: private zones never appear in unauthorized views or AI frames.
- Replay proof: golden replay fixtures survive package extraction.
- AI parity: agents use the same legal intent contract as humans.
- Renderer neutrality: scene models test without Pixi, Three.js, or DOM.
- Generated admission: a new card/tabletop duel pack validates, simulates, and produces a replay.
- App continuity: existing web match happy path keeps working.

## V0 Done Definition

v0 is done when Lunch Table Games exposes generic tabletop primitives in the monorepo, the existing TCG runs on them, and a generated card/tabletop duel pack can be validated, simulated by bots, rendered in the browser, and replayed deterministically.

The public starting point additionally includes `bunx lunchtable init` scaffolds
for TCG, dice tabletop, side-scroller, and 3D shooter shells so new generated
games can begin from the same deterministic ruleset, tabletop primitive, AI
decision, and renderer-neutral contracts.

## Out Of Scope For V0

- Marketplace.
- Broad FPS runtime.
- Physics-heavy object sandbox.
- Arbitrary generated code execution.
- Package publishing before boundaries are proven in the monorepo.
- Rewriting Convex or the web app before package boundaries require it.
