# Game Rules Spec

**Goal**: define the authoritative rules model so the game can support multiple card systems without rewriting the engine.

## Rules Principles

1. The rules engine is deterministic and pure.
2. Clients submit intents, not state patches.
3. The engine owns legality, targeting, costs, and sequencing.
4. Hidden information is derived from one authoritative state into scoped views.
5. All random choices come from a seeded RNG recorded in the event stream.

## Canonical Entities

### `MatchState`

- `matchId`
- `formatId`
- `seed`
- `version`
- `status`
- `turnNumber`
- `activePlayer`
- `priorityPlayer`
- `phase`
- `step`
- `players`
- `zones`
- `stack`
- `pendingTriggers`
- `continuousEffects`
- `replacementEffects`
- `prompt`
- `winner`

### `PlayerState`

- `seat`
- `userId`
- `agentId?`
- `life`
- `resourcePool`
- `resourceCapacity`
- `counters`
- `mulligansTaken`
- `timers`
- `flags`

### `CardInstance`

- `instanceId`
- `cardId`
- `ownerSeat`
- `controllerSeat`
- `zone`
- `visibility`
- `baseCharacteristics`
- `derivedCharacteristics`
- `damage`
- `counters`
- `attachments`
- `tappedOrExhausted`
- `summoningOrEntryFlags`

### `StackObject`

- `stackId`
- `sourceInstanceId`
- `controllerSeat`
- `abilityId?`
- `payload`
- `chosenModes`
- `chosenTargets`
- `costsPaid`

## Zones

Required zones for MVP:

- deck
- hand
- battlefield
- discard
- exile
- stack
- revealed
- token holding area

Optional future zones:

- sideboard
- commander zone
- objective zone
- lane reserve

## Visibility Rules

- Public: battlefield, stack, public graveyard metadata, life totals, timers, event log summaries.
- Private per seat: hand contents, hidden deck order, unresolved prompt details, secret choices.
- Staff or replay-owner only: debug state, full hidden history, RNG trace.

## Turn and Timing Model

Default TCG format ships with:

1. mulligan
2. ready or untap
3. upkeep
4. draw
5. main 1
6. attack
7. block or defense assignment
8. damage resolution
9. main 2
10. end
11. cleanup

Each phase can define zero or more response windows.

## Priority Model

The default timing model is stack-based:

- when a player takes an action that uses the stack, priority passes to the opposing seat
- both players passing on an empty stack advances the phase
- both players passing with stack content resolves the top object
- triggered abilities are collected, ordered, and placed before normal priority resumes

Alternative timing models are allowed by format:

- `fullStack`
- `fastSlow`
- `burstOnly`
- `noResponses`

## Intent Model

The only way to change authoritative state is through an intent:

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

Each intent must include:

- `matchId`
- `stateVersion`
- `seat`
- `intentId`
- `kind`
- `payload`

`stateVersion` prevents stale clients from applying actions against an old prompt or phase.

## Command Resolution Pipeline

1. Authenticate caller and seat.
2. Load current `MatchState`.
3. Validate state version and prompt ownership.
4. Validate legality:
   - card exists in correct zone
   - controller is correct
   - costs are payable
   - timing window allows action
   - targets satisfy restrictions
5. Produce deterministic state transition.
6. Emit normalized events.
7. Recompute derived characteristics.
8. Detect state-based actions.
9. Enqueue triggers and replacement windows.
10. Persist next snapshot and log.

## Ability Model

Every card ability must normalize to one of these forms:

### Activated

```ts
{
  kind: "activated";
  speed: "slow" | "fast";
  costs: CostSpec[];
  targets?: TargetSpec[];
  effect: EffectNode[];
}
```

### Triggered

```ts
{
  kind: "triggered";
  trigger: TriggerSpec;
  condition?: ConditionNode;
  effect: EffectNode[];
}
```

### Static

```ts
{
  kind: "static";
  layer: ContinuousLayer;
  effect: ContinuousEffectNode;
}
```

### Replacement

```ts
{
  kind: "replacement";
  watches: EventPattern;
  replace: ReplacementNode;
}
```

### Keyword

Keywords compile into one or more of the four forms above.

Examples:

- `flying` -> targeting or blocking restriction
- `haste` -> static continuous rule override
- `deathrattle` -> triggered
- `ward` -> replacement or tax effect

## Effect Vocabulary

The engine should not allow arbitrary card code. Cards compile into a restricted effect DSL:

- move card between zones
- draw
- discard
- reveal
- shuffle
- create token
- spend or gain resource
- deal damage
- heal
- destroy
- banish or exile
- modify stats
- grant or remove keyword
- change control
- copy spell or ability
- counter spell or ability
- search zone
- attach or detach
- create delayed trigger
- create replacement effect
- ask for a choice
- random selection using seeded RNG

## Continuous Effects

Continuous effects are applied in deterministic layers:

1. controller and ownership changes
2. card type and trait changes
3. rule text and keyword changes
4. base power, health, or durability changes
5. additive and multiplicative stat changes
6. restrictions and permission overrides

Formats can add layers but cannot bypass ordering.

## Replacement Effects

Replacement effects intercept events before commit.

Examples:

- "if this would die, exile it instead"
- "the first damage to this each turn is prevented"
- "cards drawn beyond the first are revealed"

Rules:

- they inspect pending events, not rendered state
- they can modify, cancel, or split events
- they must resolve conflicts by a deterministic priority rule

## State-Based Actions

These run after every committed effect batch:

- entities with lethal damage die
- invalid attachments fall off
- zero-life player loses
- impossible tokens are removed
- illegal targets on unresolved objects fizzle or partially resolve by format rules

## RNG and Replay

- Shuffle and random-choice functions consume values from a logged seed stream.
- Replay inputs are:
  - initial deck orders
  - initial seed
  - ordered intent list
- Replays must reconstruct the exact same event log.

## Format Definition Contract

Each format exports:

- `formatId`
- `deckRules`
- `timingModel`
- `boardModel`
- `resourceModel`
- `victoryModel`
- `mulliganModel`
- `keywordRegistry`
- `cardPool`
- `banList`
- `uiHints`

## Correctness Rules

- Never compute legality in the renderer.
- Never store unresolved natural-language card text as execution logic.
- Never let bots bypass prompt order or timing windows.
- Never reveal hidden information in public replay exports by default.
