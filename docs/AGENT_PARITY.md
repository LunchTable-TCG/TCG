# AI Agent Parity Spec

**Goal**: AI seats must have the same gameplay powers as human seats, no less and no more.

## Parity Rules

1. A bot may only act through the same public intent contract as a human.
2. A bot may only observe the same seat-scoped information a human in that seat could observe.
3. A bot may not call internal Convex gameplay functions.
4. A bot may not receive unrevealed deck order, hidden hand contents from other seats, or debug state.
5. A bot may use extra compute time outside the match-critical mutation path, but not extra game powers.

## Identity Model

There are three actor classes:

- `humanUser`
- `botUser`
- `staffUser`

Every live match seat binds to exactly one actor. A seat never changes transport semantics mid-turn.

## Bot Architecture

### Production Bot Runner

- long-running Bun service
- uses `ConvexClient`
- subscribes to seat view and prompt changes
- maintains local policy state
- submits public intents through `matches.submitIntent`

### External Research Agent Adapter

- optional HTTP action entrypoint
- useful for externally hosted agents
- converts external responses into validated public intents
- never writes match state directly
- current implementation path: `apps/bot-runner` `BOT_POLICY_MODE=external-http`
  with legal-action envelopes from `packages/bot-sdk`

### Convex Agent Component

Use for:

- deck advice
- replay explanations
- tutorial companions
- QA assistants
- content tagging

Do not use it as the live authority for turn progression.

## Bot Seat View Contract

A bot receives:

- full local seat private state
- full public state
- current prompt
- timer status
- event log summaries

A bot does not receive:

- opponent hidden hand contents
- opponent hidden choices
- RNG future outputs
- internal match diagnostics

## Intent Contract

Bots submit the same intents as humans:

- `keepOpeningHand`
- `takeMulligan`
- `playCard`
- `activateAbility`
- `declareAttackers`
- `declareBlockers`
- `assignCombatDamage`
- `choosePromptOptions`
- `chooseTargets`
- `chooseModes`
- `chooseCosts`
- `passPriority`
- `toggleAutoPass`
- `concede`

No other live match mutation is allowed for a bot.

## Timeout and Auto-Pass Behavior

Bots must obey the same timer system as humans.

- prompt timers are owned by the match shell
- auto-pass is a seat flag, not a bot privilege
- if a bot times out, the same match rules apply as for a human:
  - auto-pass if legal
  - forced default choice if format defines one
  - concede on repeated timeout if queue rules say so

## Training and Evaluation Modes

### Ladder Safe

- production model version only
- audited prompt and toolset
- match telemetry enabled

### Sparring

- self-play allowed
- prompt and model experimentation allowed
- can run faster-than-real-time if both seats are bots

### Sandbox Judge

- hidden full-state access allowed only in internal QA runs
- never mixed with ranked or public matchmaking

## Fairness Controls

- rate limit bot intent submissions per seat
- require monotonic `stateVersion`
- record model/version metadata for every bot move
- lock prompt templates by deployment version for ranked play
- keep all bot transport logs for moderation and regression analysis

## Anti-Cheat Rules

- no staff override channel in production ranked matches
- no direct database edits to advance a match
- no prompt or tool that leaks unrevealed opponent data
- no MCP production access for live bot seats

The Convex MCP server is for development, debugging, and internal tooling. It exposes inspection and execution tools that are too broad for a production ladder bot.

## Recommended Bot Interfaces

### `packages/bot-sdk`

Exports:

- seat view parser
- legal action mapper
- prompt normalizer
- policy interface
- replay evaluator

### `apps/bot-runner`

Responsibilities:

- subscribe to active bot assignments
- hydrate policy implementation
- observe seat views
- decide intent
- submit intent
- handle retries and stale state gracefully

## Human-Agent Features

Separate from live play parity, the product can support "human agents" and AI assistants for:

- coaching
- draft helper overlays
- commentary
- onboarding
- deck tuning

These features must run as non-authoritative assistants. They cannot bypass the intent contract.
