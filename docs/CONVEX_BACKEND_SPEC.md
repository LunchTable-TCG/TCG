# Convex Backend Spec and Research

**Research date**: 2026-04-02
**Goal**: use Convex where it is strongest, and avoid using it in ways that fight its limits.

## Official Findings

The following points come from current Convex primary sources:

- Convex JavaScript clients support reactive query subscriptions in browsers, Node.js, and Bun through `ConvexClient`. This is important for long-running bot workers, not just browser clients.
- Convex React provides hook-based query, mutation, action, auth, file storage, and search integration for React apps.
- Auth is available inside queries, mutations, actions, and HTTP actions through `ctx.auth.getUserIdentity()`.
- Convex currently documents a first-party WorkOS AuthKit integration and supports custom JWT providers in `auth.config.ts`.
- Scheduling is split between scheduled functions and cron jobs. Convex also recommends higher-level components when stronger durable workflow guarantees are needed.
- Indexes are first-class, can be backfilled safely, and automatically include `_creationTime` as the final tie-breaker.
- Current limits matter for match modeling:
  - document size: 1 MiB
  - query and mutation user code time: 1 second
  - action time: 10 minutes
  - transaction reads: 16 MiB
  - transaction writes: 16 MiB
  - documents scanned: 32,000
  - indexes per table: 32
- Convex ships an MCP server with tools for status, tables, data inspection, function execution, logs, insights, and env management.
- Convex ships an Agent component that persists threads and messages and supports human agents, but that is an AI workflow primitive, not a replacement for the authoritative game loop.

## What Convex Is Best At For This Project

- realtime seat views
- lobby and queue coordination
- transactional command ingestion
- match snapshots and event logs
- deck and collection CRUD
- replay indexing
- live social surfaces
- bot-worker subscriptions and orchestration
- AI helpers such as coaches, commentators, and testing agents

## What Convex Should Not Own

- large rendered board blobs
- imperative animation timelines
- unrestricted arbitrary card code
- LLM reasoning loops inside the authoritative mutation path
- huge whole-match snapshots in a single document

## Chosen Convex Patterns

### Pattern 1: One Authoritative Gameplay Mutation

Use a single public mutation for match-changing intents:

- `matches.submitIntent`

Everything else is read-only, setup, or auxiliary. This keeps auditability and parity tight.

### Pattern 2: Public Queries, Internal Orchestration

- Public queries expose seat view, match shell, lobby state, replay slices.
- Internal mutations and actions do follow-up work:
  - timeout handling
  - creating derived replay chunks
  - analytics
  - bot scheduling

### Pattern 3: Snapshot + Event Log

- `match_states` stores the current authoritative snapshot.
- `match_events` stores append-only normalized events.
- `match_views` stores seat and spectator projections.

This fits Convex transaction limits better than storing one ever-growing match document.

### Pattern 4: Seat-Scoped Queries

Every live match query is one of:

- public shell
- seat private view
- spectator public view

Never return a superset and trust the client to hide fields.

### Pattern 5: Actions Only For Slow or External Work

Use actions for:

- LLM calls
- webhook integrations
- long-running bot reasoning
- batch imports

Do not put authoritative command application inside actions.

## Human and Bot Authentication

### Humans

- WorkOS AuthKit provider
- user identity loaded through `ctx.auth.getUserIdentity()`
- seat authorization checks in every mutation and sensitive query

### Bots

- configure a second auth provider for service-issued custom JWTs
- each bot gets a real `userId` and optional `agentId`
- bots subscribe and mutate through the same public functions humans use
- bot capabilities are limited by seat ownership, format permissions, and queue rules

This is the cleanest way to preserve parity while keeping bot workers server-side.

## Tables

### Core Product Tables

- `users`
- `profiles`
- `cards`
- `sets`
- `formats`
- `collections`
- `deck_lists`
- `deck_entries`
- `lobbies`
- `queue_entries`
- `matches`
- `match_states`
- `match_events`
- `match_views`
- `match_prompts`
- `replays`

### Agent and Ops Tables

- `bot_identities`
- `bot_assignments`
- `agent_threads`
- `agent_runs`
- `analytics_events`
- `moderation_events`

## Required Indexes

Minimum initial index set:

- `deck_lists.by_owner`
- `deck_entries.by_deck`
- `collections.by_user_card`
- `lobbies.by_status_format`
- `queue_entries.by_status_format`
- `matches.by_status_updatedAt`
- `matches.by_playerA`
- `matches.by_playerB`
- `match_events.by_match_sequence`
- `match_views.by_match_seat`
- `match_prompts.by_match_status`
- `replays.by_owner_createdAt`
- `bot_assignments.by_status_kind`

## Function Registry

### Public Queries

- `viewer.get`
- `cards.list`
- `cards.get`
- `formats.list`
- `formats.get`
- `collection.listOwned`
- `collection.getCounts`
- `decks.listMine`
- `decks.get`
- `decks.validate`
- `lobbies.listOpen`
- `lobbies.get`
- `matches.getShell`
- `matches.getSeatView`
- `matches.getSpectatorView`
- `matches.listEvents`
- `replays.getSummary`
- `replays.getFrames`
- `agents.listMine`
- `agents.getLabState`

### Public Mutations

- `profiles.completeOnboarding`
- `decks.create`
- `decks.rename`
- `decks.clone`
- `decks.upsertCards`
- `decks.archive`
- `lobbies.createPrivate`
- `lobbies.join`
- `lobbies.leave`
- `lobbies.setReady`
- `matchmaking.enqueue`
- `matchmaking.dequeue`
- `matches.submitIntent`
- `matches.toggleAutoPass`
- `matches.concede`
- `matches.sendEmote`
- `agents.createBotIdentity`
- `agents.updateBotConfig`
- `agents.launchSparring`

### Public Actions

- `agents.runCoachPrompt`
- `agents.runCommentatorPrompt`
- `imports.importDeckCode`

### Internal Mutations

- `internal.matches.createFromLobby`
- `internal.matches.applyTimeout`
- `internal.matches.close`
- `internal.matches.appendReplayChunk`
- `internal.matchmaking.createPairing`
- `internal.agents.assignSeat`
- `internal.analytics.recordMatchEvent`

### Internal Actions

- `internal.agents.computeBotIntent`
- `internal.agents.runEvaluationBatch`
- `internal.notifications.sendMatchReady`

### HTTP Actions

- `/webhooks/workos`
- `/webhooks/payments`
- `/agents/seat-token`
- `/agents/external-intent`

`/agents/external-intent` is optional. If used, it must still translate into the same gameplay intent contract enforced by `matches.submitIntent`.

## Match Transaction Design

`matches.submitIntent` performs:

1. load current match shell and authoritative state
2. authorize seat
3. validate prompt and `stateVersion`
4. call `game-core`
5. write next snapshot
6. append normalized events
7. update seat and spectator views
8. update timers and next prompt
9. schedule non-critical follow-up functions

The mutation must stay under Convex's 1-second user-code limit. That means:

- keep game-core pure and fast
- keep hot snapshots small
- avoid loading unrelated tables
- pre-index all lookup paths used during live play

## Bot and Agent Integration Model

Use two separate integration lanes:

### Lane A: Match-Critical Bot Play

- `apps/bot-runner` uses `ConvexClient` subscriptions in Bun or Node
- subscribes to `matches.getSeatView`
- computes next intent
- calls `matches.submitIntent`

This lane has full parity with human players.

### Lane B: Non-Critical AI Agents

Use the Convex Agent component for:

- deck coaching
- replay explanations
- onboarding helpers
- content tagging
- internal QA workflows

Do not make Agent threads the source of truth for live match state.

## Risks and Mitigations

### Risk: snapshot documents exceed 1 MiB

Mitigation:

- normalize zones
- store compact card instance records
- chunk replay data
- cap verbose debug info outside hot tables

### Risk: match mutation exceeds 1 second

Mitigation:

- keep rules pure and synchronous
- use indexed lookups only
- avoid search or file operations in gameplay path
- move bot reasoning and notifications into actions

### Risk: bots get privileged access

Mitigation:

- bots authenticate as normal identities
- only public queries and mutations for live play
- internal functions are never callable by bot workers

### Risk: hidden information leakage

Mitigation:

- separate seat and spectator projections
- query-level auth checks
- replay export modes with explicit visibility policy

## Recommended Convex Adoption Order

1. schema and auth
2. deck and format CRUD
3. lobby and queue
4. match shell and seat views
5. authoritative intent mutation
6. replay indexing
7. bot workers
8. AI helper agents

## Sources

- [Convex JavaScript clients](https://docs.convex.dev/client/javascript)
- [Convex Bun client](https://docs.convex.dev/client/javascript/bun)
- [Convex Node client](https://docs.convex.dev/client/javascript/node)
- [Convex React](https://docs.convex.dev/client/react)
- [Auth in Functions](https://docs.convex.dev/auth/functions-auth)
- [WorkOS AuthKit](https://docs.convex.dev/auth/authkit/)
- [Scheduling](https://docs.convex.dev/scheduling)
- [Indexes](https://docs.convex.dev/database/reading-data/indexes/)
- [Limits](https://docs.convex.dev/production/state/limits)
- [convex-test](https://docs.convex.dev/testing/convex-test)
- [Convex MCP Server](https://docs.convex.dev/ai/convex-mcp-server)
- [AI Agents](https://docs.convex.dev/agents)
- [Human Agents](https://docs.convex.dev/agents/human-agents)
