# Agent Gameplay Contract

This document defines the production contract for gameplay agents and advisory
agents.

## Authority Rules

- The engine remains authoritative.
- `matches.submitIntent` remains the only public gameplay mutation.
- Production gameplay agents choose a `LegalActionDescriptorV1.actionId`, not an
  arbitrary raw intent payload.
- The bot transport resolves that action id against the current legal-action
  catalog before submitting the associated authoritative intent.

## Structured Context Surfaces

### `AgentMatchContextV1`

Seat-legal structured context built from a live seat or spectator view.

Includes:
- match metadata and seat metadata
- `stateVersion`
- public board state
- local private state for the owned seat only
- normalized prompt state
- stack summary
- timers
- recent event summaries
- visible card metadata and reasoning metadata
- stable legal-action catalog

### `LegalActionDescriptorV1`

Stable legal-action entries used by gameplay policies.

Includes:
- `actionId`
- authoritative intent kind
- required argument map
- human label
- machine label
- priority
- legality fingerprint

### `PromptDecisionSchemaV1`

Normalized prompt decision schema for:
- target selection
- option selection
- mode selection
- cost selection
- attacker declaration
- blocker declaration
- combat damage assignment

### `BotDecisionTraceV1`

Stored decision trace for a single policy turn.

Includes:
- prompt template version
- policy key and model label
- context hash
- chosen action id
- rejected output reasons
- token counts when available
- decision latency
- submission result

## Card Reasoning Contract

Every visible current-format card must export `CardReasoningMetadataV1`
alongside its rules data.

Required normalized fields:
- `summary`
- `keywords`
- `timingAffordances`
- `targetClasses`
- `promptSurfaces`
- `effectKinds`

The metadata must describe what the agent is allowed to infer from visible card
text and rules, not hidden game state.

## Gameplay-Agent Lifecycle

1. Seat view changes.
2. Bot transport builds `AgentMatchContextV1`.
3. Telemetry records context build stats.
4. Policy chooses an `actionId` from the current legal-action catalog.
5. Transport validates that `actionId` against the current legal set.
6. Transport submits the associated authoritative intent through
   `matches.submitIntent`.
7. Telemetry records decision traces, invalid outputs, and submission results.

## Advisory-Agent Lifecycle

- Coach threads consume owned-seat `AgentMatchContextV1`.
- Commentator threads consume spectator-safe `AgentMatchContextV1`.
- Advisory replies may render a thin prose overlay, but the structured context
  remains the source of truth.
- Advisory agents must never submit live gameplay intents.

## Intent Parity Target

The gameplay-agent stack must reach parity with all human-authoritative intent
kinds supported by the public mutation contract:
- `toggleAutoPass`
- `concede`
- `keepOpeningHand`
- `takeMulligan`
- `playCard`
- `activateAbility`
- `passPriority`
- `declareAttackers`
- `declareBlockers`
- `assignCombatDamage`
- `choosePromptOptions`
- `chooseTargets`
- `chooseModes`
- `chooseCosts`
