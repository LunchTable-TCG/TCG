# Implementation Phases: Lunchtable

**Project Type**: Web TCG platform
**Stack**: Bun + TypeScript + React 19 + PixiJS 8 + Convex + local BSC wallet auth
**Estimated Total**: 120-160 hours initial foundation, excluding card content production and live ops

## Phase 1: Repository Bootstrap
**Type**: Infrastructure
**Estimated**: 3 hours
**Files**: `package.json`, `bunfig.toml`, `tsconfig.json`, `apps/web/*`, `README.md`

**Tasks**:
- [ ] Initialize Bun workspace
- [ ] Create `apps/web`, `apps/bot-runner`, `packages/*`, and `convex/`
- [ ] Configure shared TypeScript paths
- [ ] Set up lint, format, and test commands
- [ ] Add base README and environment template

**Verification Criteria**:
- [ ] `bun install` completes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` executes an empty baseline successfully

**Exit Criteria**: The monorepo boots locally with stable scripts and no placeholder stack ambiguity.

## Phase 2: Convex Bootstrap and Auth
**Type**: Infrastructure
**Estimated**: 4 hours
**Files**: `convex/schema.ts`, `convex/auth.config.ts`, `convex/viewer.ts`, `apps/web/src/auth/*`, `.env.example`

**Tasks**:
- [ ] Initialize Convex project
- [ ] Implement client-generated BSC wallet signup flow
- [ ] Implement signup and login challenge issuance and verification model
- [ ] Add custom JWT provider plan for bot identities
- [ ] Add canonical `users`, `wallets`, and `wallet_challenges` table design
- [ ] Implement viewer query and auth guards
- [ ] Wire `ConvexProvider` into web app

**Verification Criteria**:
- [ ] Wallet signup works locally without sending the private key to Convex
- [ ] Wallet login works locally through signed challenges
- [ ] Authenticated queries return viewer data
- [ ] Unauthenticated access is rejected cleanly

**Exit Criteria**: Wallet-based human auth works end to end and Convex is the active backend.

## Phase 3: Shared Domain Types
**Type**: Infrastructure
**Estimated**: 3 hours
**Files**: `packages/shared-types/src/*`, `packages/game-core/src/types.ts`, `packages/bot-sdk/src/types.ts`

**Tasks**:
- [ ] Define match shell DTOs
- [ ] Define seat view DTOs
- [ ] Define intent union and event union
- [ ] Define telemetry event names

**Verification Criteria**:
- [ ] Shared types compile in web, bot, and Convex code
- [ ] No circular dependency between packages

**Exit Criteria**: All interfaces shared across runtime boundaries are centralized and typed.

## Phase 4: Rules Kernel Skeleton
**Type**: API
**Estimated**: 5 hours
**Files**: `packages/game-core/src/state.ts`, `packages/game-core/src/engine.ts`, `packages/game-core/src/reducer.ts`, `packages/game-core/src/tests/*`

**Tasks**:
- [ ] Define canonical state shape
- [ ] Implement seed handling and state versioning
- [ ] Implement reducer shell for intents
- [ ] Add baseline tests for state creation and no-op transitions

**Verification Criteria**:
- [ ] Pure engine tests pass in Vitest
- [ ] Same seed and intents reproduce same state

**Exit Criteria**: `game-core` can create and evolve a deterministic match state.

## Phase 5: Card DSL and Format Registry
**Type**: API
**Estimated**: 5 hours
**Files**: `packages/card-content/src/cards/*`, `packages/card-content/src/formats/*`, `packages/game-core/src/dsl/*`, `packages/game-core/src/tests/cardDsl.test.ts`

**Tasks**:
- [ ] Define keyword registry
- [ ] Define effect DSL
- [ ] Create one starter format
- [ ] Add validator for card definitions

**Verification Criteria**:
- [ ] Invalid card definitions fail validation
- [ ] Starter cards compile into engine-ready forms

**Exit Criteria**: Card content can be authored as data, not arbitrary imperative card code.

## Phase 6: Deck and Collection CRUD
**Type**: API
**Estimated**: 5 hours
**Files**: `convex/decks.ts`, `convex/cards.ts`, `convex/collections.ts`, `apps/web/src/routes/decks/*`, `apps/web/src/routes/collection/*`

**Tasks**:
- [ ] Build card and deck tables
- [ ] Implement deck create, edit, clone, archive
- [ ] Implement deck validation query
- [ ] Build collection and deck list screens

**Verification Criteria**:
- [ ] Deck CRUD works
- [ ] Illegal decks are flagged deterministically
- [ ] Collection filtering works without full-table scans

**Exit Criteria**: Players can build legal decks and browse cards.

## Phase 7: Match Shell Persistence
**Type**: Database
**Estimated**: 4 hours
**Files**: `convex/matches.ts`, `convex/schema.ts`, `packages/shared-types/src/match.ts`, `convex/tests/matches.test.ts`

**Tasks**:
- [ ] Add tables for match shell, state, events, views, prompts
- [ ] Add indexes for live match access paths
- [ ] Implement match shell queries

**Verification Criteria**:
- [ ] Match shell creation works
- [ ] Seat and spectator queries are isolated
- [ ] Index-backed queries pass targeted tests

**Exit Criteria**: Convex can persist live and historical matches safely.

## Phase 8: Lobby and Matchmaking
**Type**: API
**Estimated**: 5 hours
**Files**: `convex/lobbies.ts`, `convex/matchmaking.ts`, `apps/web/src/routes/play/*`, `convex/tests/lobbies.test.ts`

**Tasks**:
- [ ] Build private challenge and casual queue flows
- [ ] Implement ready states
- [ ] Implement deterministic lobby-to-match creation

**Verification Criteria**:
- [ ] Two users can create and start a private match
- [ ] Queue entry and dequeue work
- [ ] Duplicate active queue entries are rejected

**Exit Criteria**: Players can enter a match from supported queue surfaces.

## Phase 9: Core Gameplay Intent Path
**Type**: API
**Estimated**: 6 hours
**Files**: `convex/matches.ts`, `packages/game-core/src/applyIntent.ts`, `packages/game-core/src/tests/intents.test.ts`, `convex/tests/submitIntent.test.ts`

**Tasks**:
- [ ] Implement `matches.submitIntent`
- [ ] Add stale version rejection
- [ ] Add base intents: mulligan, play card, pass priority, concede
- [ ] Persist snapshot and event log atomically

**Verification Criteria**:
- [ ] Public mutation updates snapshot and events in one transaction
- [ ] Illegal intents fail with typed reasons
- [ ] Replay from stored events matches final snapshot

**Exit Criteria**: One authoritative gameplay mutation exists and works.

## Phase 10: Timing Windows and Stack
**Type**: API
**Estimated**: 6 hours
**Files**: `packages/game-core/src/priority/*`, `packages/game-core/src/stack/*`, `packages/game-core/src/tests/stack.test.ts`, `convex/tests/priority.test.ts`

**Tasks**:
- [ ] Implement priority ownership
- [ ] Implement stack objects
- [ ] Resolve pass-pass behavior
- [ ] Implement triggered ability enqueue rules

**Verification Criteria**:
- [ ] Response windows behave deterministically
- [ ] Stack resolves in correct order
- [ ] Trigger ordering tests pass

**Exit Criteria**: Core TCG timing model is functional.

## Phase 11: Static, Continuous, and Replacement Effects
**Type**: API
**Estimated**: 8 hours
**Files**: `packages/game-core/src/effects/*`, `packages/game-core/src/layers/*`, `packages/game-core/src/replacements/*`, `packages/game-core/src/tests/effects.test.ts`

**Tasks**:
- [ ] Implement continuous layer system
- [ ] Implement replacement effect interception
- [ ] Implement state-based actions
- [ ] Add coverage for control changes, buffs, death replacement, ward or tax

**Verification Criteria**:
- [ ] Layer ordering is deterministic
- [ ] Replacement effects do not create infinite loops
- [ ] State-based actions fire after each batch

**Exit Criteria**: The engine can support realistic card text without bespoke hacks.

## Phase 12: Match UI Shell
**Type**: UI
**Estimated**: 6 hours
**Files**: `apps/web/src/routes/match/*`, `apps/web/src/components/match/*`, `apps/web/src/hooks/useSeatView.ts`

**Tasks**:
- [ ] Build match page shell
- [ ] Render hand, stack rail, prompts, timers, event log
- [ ] Connect live queries and mutations
- [ ] Add reconnect and loading states

**Verification Criteria**:
- [ ] A live match can be observed and acted on from the browser
- [ ] Loading and reconnect states are correct
- [ ] Seat-private data never appears in spectator mode

**Exit Criteria**: The match is playable in a text-first shell before premium visuals.

## Phase 13: Pixi Battlefield Renderer
**Type**: UI
**Estimated**: 8 hours
**Files**: `packages/render-pixi/src/*`, `apps/web/src/components/match/BoardCanvas.tsx`, `apps/web/src/tests/matchRenderer.test.tsx`

**Tasks**:
- [ ] Build battlefield renderer
- [ ] Add hand animations and card zoom
- [ ] Add stack and attack highlights
- [ ] Add deterministic animation triggers from event log

**Verification Criteria**:
- [ ] Board state matches seat view DTOs
- [ ] Renderer does not own gameplay rules
- [ ] Performance remains acceptable with representative board load

**Exit Criteria**: The live match has premium readable visuals.

## Phase 14: Replay and Spectator Mode
**Type**: Integration
**Estimated**: 5 hours
**Files**: `convex/replays.ts`, `apps/web/src/routes/replay/*`, `apps/web/src/routes/spectate/*`, `packages/game-core/src/tests/replay.test.ts`

**Tasks**:
- [ ] Build replay summaries and frame retrieval
- [ ] Build spectator query path
- [ ] Implement replay player controls

**Verification Criteria**:
- [ ] Completed matches can replay deterministically
- [ ] Spectators never receive private seat data

**Exit Criteria**: Match history becomes inspectable and shareable.

## Phase 15: Bot Runner Foundation
**Type**: Integration
**Estimated**: 6 hours
**Files**: `apps/bot-runner/src/*`, `packages/bot-sdk/src/*`, `convex/agents.ts`, `convex/tests/bots.test.ts`

**Tasks**:
- [ ] Build bot identity model
- [ ] Build bot assignment workflow
- [ ] Subscribe bot runner to seat views with `ConvexClient`
- [ ] Submit public gameplay intents from bots

**Verification Criteria**:
- [ ] Bot seats can join and finish a private sparring match
- [ ] Bot uses only public queries and mutations
- [ ] Bot timeouts follow same rules as human seats

**Exit Criteria**: AI players can participate with human parity.

## Phase 16: Agent Lab and Non-Critical AI Helpers
**Type**: Integration
**Estimated**: 6 hours
**Files**: `convex/agents.ts`, `convex/convex.config.ts`, `apps/web/src/routes/agents/*`, `convex/tests/agentLab.test.ts`

**Tasks**:
- [ ] Install Convex Agent component
- [ ] Build coach and commentator actions
- [ ] Build agent lab management surface
- [ ] Separate agent threads from live match state

**Verification Criteria**:
- [ ] Coach and commentator features work
- [ ] No agent workflow is required to complete a live match turn

**Exit Criteria**: AI helpers exist without compromising authoritative gameplay.

## Phase 17: Test Harness and Regression Gates
**Type**: Testing
**Estimated**: 6 hours
**Files**: `vitest.config.ts`, `playwright.config.ts`, `convex/tests/*`, `packages/game-core/src/tests/*`, `apps/web/e2e/*`

**Tasks**:
- [ ] Add `convex-test` coverage for backend logic
- [ ] Add table-driven rules tests
- [ ] Add browser e2e for deckbuilder, lobby, and match happy path
- [ ] Add replay golden tests

**Verification Criteria**:
- [ ] Unit, backend, and e2e gates pass in CI
- [ ] Replay goldens catch deterministic regressions

**Exit Criteria**: Changes to rules or views can be verified before merge.

## Phase 18: Ranked Hardening and Ops
**Type**: Integration
**Estimated**: 6 hours
**Files**: `convex/admin.ts`, `convex/analytics.ts`, `apps/web/src/routes/admin/*`, `.github/workflows/*`

**Tasks**:
- [ ] Add stuck match recovery
- [ ] Add telemetry and alerting hooks
- [ ] Add format publication and ban list controls
- [ ] Add CI and deploy workflows

**Verification Criteria**:
- [ ] Match failures are inspectable
- [ ] Ranked settings are operator-controlled
- [ ] CI runs tests and typechecks deterministically

**Exit Criteria**: The project is ready for limited external testing.

## Notes

**Testing Strategy**: Pure `game-core` unit tests, `convex-test` backend tests, Playwright end-to-end, replay goldens.
**Deployment Strategy**: Convex dev deployment for local work, preview deployments for review, production locked behind phase 18 gates.
**Context Management**: Each phase is intentionally sized so implementation and verification fit in one focused session.
