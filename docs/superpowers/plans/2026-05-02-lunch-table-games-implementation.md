# Lunch Table Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract reusable Lunch Table Games primitives inside the monorepo while keeping the existing TCG playable and testable.

**Architecture:** Add generic packages first, then move TCG code onto those boundaries one slice at a time. Generic packages stay free of TCG, Convex, React, Pixi, Three.js, and app imports; TCG packages adapt inward to generic contracts.

**Tech Stack:** Bun workspaces, TypeScript, Vitest, React, PixiJS, Convex.

---

## File Structure

- Create `packages/games-core/`: deterministic runtime types, seeded RNG, ruleset contract, replay helpers.
- Create `packages/games-tabletop/`: seats, zones, tabletop object primitives, visibility helpers, pack manifest types.
- Create `packages/games-render/`: renderer-neutral scene model and cue types.
- Create `packages/games-ai/`: legal action descriptors, decision frames, external response resolution.
- Modify `tsconfig.json`: add paths for the four new packages.
- Modify `packages/game-core/`: consume `@lunchtable/games-core` RNG/transition contracts without changing current public behavior.
- Modify `packages/bot-sdk/`: consume `@lunchtable/games-ai` contracts while preserving current bot SDK exports.
- Modify `packages/render-pixi/`: consume `@lunchtable/games-render` scene types while preserving the current Pixi component API.
- Modify `packages/card-content/`: add generated card/tabletop duel pack admission helpers and tests.
- Add boundary tests under `tests/lunch-table-games-boundaries.test.ts`.

## Task 0: Prepare The Worktree Baseline

**Files:**
- Read: `package.json`
- Read: `bun.lock`
- Read: `docs/superpowers/specs/2026-05-02-lunch-table-games-design.md`

- [ ] **Step 1: Install locked dependencies**

Run:

```bash
bun install --frozen-lockfile
```

Expected: command exits `0` and does not rewrite `bun.lock`.

- [ ] **Step 2: Run focused baseline tests**

Run:

```bash
bun run test:rules
```

Expected: existing game-core tests pass before extraction begins.

- [ ] **Step 3: Confirm clean worktree**

Run:

```bash
git status --short
```

Expected: no output.

## Task 1: Add `@lunchtable/games-core`

**Files:**
- Create: `packages/games-core/package.json`
- Create: `packages/games-core/src/index.ts`
- Create: `packages/games-core/src/random.ts`
- Create: `packages/games-core/src/ruleset.ts`
- Create: `packages/games-core/src/replay.ts`
- Create: `packages/games-core/src/random.test.ts`
- Create: `packages/games-core/src/ruleset.test.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write failing RNG and ruleset tests**

Create `packages/games-core/src/random.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { deriveDeterministicNumber } from "./random";

describe("deriveDeterministicNumber", () => {
  it("returns repeatable values for the same seed and cursor", () => {
    const first = deriveDeterministicNumber({ cursor: 0, seed: "seed:alpha" });
    const repeat = deriveDeterministicNumber({ cursor: 0, seed: "seed:alpha" });

    expect(first).toEqual(repeat);
  });

  it("advances the cursor without mutating the input", () => {
    const initial = { cursor: 7, seed: "seed:alpha" };
    const [, next] = deriveDeterministicNumber(initial);

    expect(initial).toEqual({ cursor: 7, seed: "seed:alpha" });
    expect(next).toEqual({ cursor: 8, seed: "seed:alpha" });
  });
});
```

Create `packages/games-core/src/ruleset.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { GameRuleset, GameTransition } from "./ruleset";

interface CounterConfig {
  initialValue: number;
}

interface CounterState {
  value: number;
}

interface IncrementIntent {
  amount: number;
  kind: "increment";
}

interface CounterView {
  value: number;
}

const counterRuleset: GameRuleset<
  CounterConfig,
  CounterState,
  IncrementIntent,
  CounterView,
  CounterView,
  CounterView
> = {
  applyIntent(state, intent): GameTransition<CounterState> {
    return {
      events: [{ kind: intent.kind }],
      nextState: { value: state.value + intent.amount },
      outcome: "applied",
    };
  },
  createInitialState(config) {
    return { value: config.initialValue };
  },
  deriveRenderScene(view) {
    return view;
  },
  deriveSeatView(state) {
    return { value: state.value };
  },
  deriveSpectatorView(state) {
    return { value: state.value };
  },
  listLegalIntents() {
    return [{ amount: 1, kind: "increment" }];
  },
};

describe("GameRuleset", () => {
  it("supports a deterministic transition contract", () => {
    const initial = counterRuleset.createInitialState({ initialValue: 2 });
    const [intent] = counterRuleset.listLegalIntents(initial, "seat-0");

    expect(intent).toEqual({ amount: 1, kind: "increment" });
    expect(counterRuleset.applyIntent(initial, intent).nextState).toEqual({
      value: 3,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bunx vitest run packages/games-core/src
```

Expected: FAIL because `./random` and `./ruleset` do not exist.

- [ ] **Step 3: Add package metadata and path mapping**

Create `packages/games-core/package.json`:

```json
{
  "name": "@lunchtable/games-core",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Add this entry to `compilerOptions.paths` in `tsconfig.json`:

```json
"@lunchtable/games-core": ["packages/games-core/src/index.ts"]
```

- [ ] **Step 4: Implement deterministic runtime files**

Create `packages/games-core/src/random.ts`:

```ts
export interface DeterministicRandomState {
  cursor: number;
  seed: string;
}

export function deriveDeterministicNumber(
  random: DeterministicRandomState,
): [number, DeterministicRandomState] {
  const input = `${random.seed}:${random.cursor}`;
  let hash = 2166136261;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return [
    (hash >>> 0) / 4294967295,
    {
      cursor: random.cursor + 1,
      seed: random.seed,
    },
  ];
}
```

Create `packages/games-core/src/ruleset.ts`:

```ts
export type GameTransitionOutcome = "applied" | "noop" | "rejected";

export interface GameTransition<TState, TEvent = { kind: string }> {
  events: TEvent[];
  nextState: TState;
  outcome: GameTransitionOutcome;
  reason?: string;
}

export interface Viewport {
  height: number;
  width: number;
}

export interface GameRuleset<
  TConfig,
  TState,
  TIntent,
  TSeatView,
  TSpectatorView,
  TScene,
> {
  applyIntent(state: TState, intent: TIntent): GameTransition<TState>;
  createInitialState(config: TConfig): TState;
  deriveRenderScene(
    view: TSeatView | TSpectatorView,
    viewport: Viewport,
  ): TScene;
  deriveSeatView(state: TState, seat: string): TSeatView;
  deriveSpectatorView(state: TState): TSpectatorView;
  listLegalIntents(state: TState, seat: string): TIntent[];
}
```

Create `packages/games-core/src/replay.ts`:

```ts
import type { GameTransition } from "./ruleset";

export interface ReplayResult<TState, TEvent, TTransition> {
  events: TEvent[];
  state: TState;
  transitions: TTransition[];
}

export function replayGameIntents<TState, TIntent, TEvent>(
  initialState: TState,
  intents: TIntent[],
  applyIntent: (
    state: TState,
    intent: TIntent,
  ) => GameTransition<TState, TEvent>,
): ReplayResult<TState, TEvent, GameTransition<TState, TEvent>> {
  return intents.reduce<ReplayResult<TState, TEvent, GameTransition<TState, TEvent>>>(
    (result, intent) => {
      const transition = applyIntent(result.state, intent);
      return {
        events: [...result.events, ...transition.events],
        state: transition.nextState,
        transitions: [...result.transitions, transition],
      };
    },
    {
      events: [],
      state: initialState,
      transitions: [],
    },
  );
}
```

Create `packages/games-core/src/index.ts`:

```ts
export {
  deriveDeterministicNumber,
} from "./random";
export {
  replayGameIntents,
} from "./replay";
export type {
  DeterministicRandomState,
} from "./random";
export type {
  GameRuleset,
  GameTransition,
  GameTransitionOutcome,
  Viewport,
} from "./ruleset";
export type {
  ReplayResult,
} from "./replay";
```

- [ ] **Step 5: Run package tests**

Run:

```bash
bunx vitest run packages/games-core/src
```

Expected: PASS for `random.test.ts` and `ruleset.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json packages/games-core
git commit -m "feat: add generic games core"
```

## Task 2: Add `@lunchtable/games-tabletop`

**Files:**
- Create: `packages/games-tabletop/package.json`
- Create: `packages/games-tabletop/src/index.ts`
- Create: `packages/games-tabletop/src/primitives.ts`
- Create: `packages/games-tabletop/src/visibility.ts`
- Create: `packages/games-tabletop/src/pack.ts`
- Create: `packages/games-tabletop/src/visibility.test.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write failing visibility tests**

Create `packages/games-tabletop/src/visibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { canSeatViewObject } from "./visibility";
import type { TabletopObject } from "./primitives";

const privateCard: TabletopObject = {
  id: "card-1",
  kind: "card",
  name: "Private Card",
  ownerSeat: "seat-0",
  state: "ready",
  visibility: "private-owner",
  zoneId: "hand-seat-0",
};

describe("canSeatViewObject", () => {
  it("allows owners to view private-owner objects", () => {
    expect(canSeatViewObject(privateCard, "seat-0")).toBe(true);
  });

  it("prevents non-owners from viewing private-owner objects", () => {
    expect(canSeatViewObject(privateCard, "seat-1")).toBe(false);
  });

  it("allows every seat to view public objects", () => {
    expect(
      canSeatViewObject(
        {
          ...privateCard,
          visibility: "public",
        },
        "seat-1",
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bunx vitest run packages/games-tabletop/src
```

Expected: FAIL because `./visibility` and `./primitives` do not exist.

- [ ] **Step 3: Add package metadata and path mapping**

Create `packages/games-tabletop/package.json`:

```json
{
  "name": "@lunchtable/games-tabletop",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@lunchtable/games-core": "workspace:*"
  }
}
```

Add this entry to `compilerOptions.paths` in `tsconfig.json`:

```json
"@lunchtable/games-tabletop": ["packages/games-tabletop/src/index.ts"]
```

- [ ] **Step 4: Implement tabletop primitives**

Create `packages/games-tabletop/src/primitives.ts`:

```ts
export type SeatId = string;
export type TabletopObjectId = string;
export type ZoneId = string;

export type TabletopObjectKind =
  | "board"
  | "card"
  | "counter"
  | "die"
  | "piece"
  | "token";

export type TabletopVisibility =
  | "count-only"
  | "hidden"
  | "private-owner"
  | "public";

export interface TabletopSeat {
  actorType: "ai" | "human";
  id: SeatId;
  name: string | null;
  permissions: string[];
  status: "active" | "eliminated" | "joining" | "ready";
}

export interface TabletopZone {
  id: ZoneId;
  kind:
    | "bag"
    | "board"
    | "deck"
    | "discard"
    | "hand"
    | "objective"
    | "stack";
  name: string;
  ownerSeat: SeatId | null;
  ordering: "ordered" | "unordered";
  visibility: TabletopVisibility;
}

export interface TabletopObject {
  id: TabletopObjectId;
  kind: TabletopObjectKind;
  name: string;
  ownerSeat: SeatId | null;
  state: "exhausted" | "ready" | "removed";
  visibility: TabletopVisibility;
  zoneId: ZoneId;
}
```

Create `packages/games-tabletop/src/visibility.ts`:

```ts
import type { SeatId, TabletopObject } from "./primitives";

export function canSeatViewObject(
  object: TabletopObject,
  viewerSeat: SeatId,
): boolean {
  if (object.visibility === "public" || object.visibility === "count-only") {
    return true;
  }

  if (object.visibility === "hidden") {
    return false;
  }

  return object.ownerSeat === viewerSeat;
}
```

Create `packages/games-tabletop/src/pack.ts`:

```ts
import type { TabletopObject, TabletopSeat, TabletopZone } from "./primitives";

export interface GamePackManifest {
  id: string;
  runtimeVersion: string;
  title: string;
  version: string;
}

export interface GamePack {
  manifest: GamePackManifest;
  objects: TabletopObject[];
  seats: TabletopSeat[];
  zones: TabletopZone[];
}

export interface GamePackValidationIssue {
  code: "duplicateObjectId" | "duplicateSeatId" | "duplicateZoneId";
  message: string;
}

export interface GamePackValidationResult {
  issues: GamePackValidationIssue[];
  ok: boolean;
}
```

Create `packages/games-tabletop/src/index.ts`:

```ts
export {
  canSeatViewObject,
} from "./visibility";
export type {
  SeatId,
  TabletopObject,
  TabletopObjectId,
  TabletopObjectKind,
  TabletopSeat,
  TabletopVisibility,
  TabletopZone,
  ZoneId,
} from "./primitives";
export type {
  GamePack,
  GamePackManifest,
  GamePackValidationIssue,
  GamePackValidationResult,
} from "./pack";
```

- [ ] **Step 5: Run package tests**

Run:

```bash
bunx vitest run packages/games-tabletop/src
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json packages/games-tabletop
git commit -m "feat: add tabletop primitives"
```

## Task 3: Wire TCG Core To Generic Runtime

**Files:**
- Modify: `packages/game-core/package.json`
- Modify: `packages/game-core/src/state.ts`
- Modify: `packages/game-core/src/reducer.ts`
- Modify: `packages/game-core/src/engine.ts`
- Modify: `packages/game-core/src/index.ts`
- Test: `packages/game-core/src/state.test.ts`
- Test: `packages/game-core/src/reducer.test.ts`

- [ ] **Step 1: Write import-boundary expectations**

Run:

```bash
rg -n "deriveDeterministicNumber|interface MatchTransition|ReplayResult" packages/game-core/src
```

Expected before edits: `deriveDeterministicNumber` is defined in `state.ts`, `MatchTransition` is defined in `reducer.ts`, and `ReplayResult` is defined in `engine.ts`.

- [ ] **Step 2: Add the package dependency**

Modify `packages/game-core/package.json` dependencies:

```json
"dependencies": {
  "@lunchtable/games-core": "workspace:*",
  "@lunchtable/shared-types": "workspace:*"
}
```

- [ ] **Step 3: Move RNG usage to `@lunchtable/games-core`**

In `packages/game-core/src/state.ts`, import the generic RNG type and function:

```ts
import {
  deriveDeterministicNumber as deriveGenericDeterministicNumber,
  type DeterministicRandomState,
} from "@lunchtable/games-core";
```

Change `MatchRandomState`:

```ts
export interface MatchRandomState extends DeterministicRandomState {}
```

Replace the existing `deriveDeterministicNumber` function body:

```ts
export function deriveDeterministicNumber(
  random: MatchRandomState,
): [number, MatchRandomState] {
  return deriveGenericDeterministicNumber(random);
}
```

- [ ] **Step 4: Use the generic transition type**

In `packages/game-core/src/reducer.ts`, import the generic transition type:

```ts
import type { GameTransition } from "@lunchtable/games-core";
```

Replace the `MatchTransition` interface:

```ts
export interface MatchTransition extends GameTransition<MatchState, MatchEvent> {
  reason?: MatchTransitionReason;
}
```

- [ ] **Step 5: Use the generic replay helper**

In `packages/game-core/src/engine.ts`, import the helper:

```ts
import { replayGameIntents } from "@lunchtable/games-core";
```

Replace the `replayGameplayIntents` implementation:

```ts
export function replayGameplayIntents(
  initialState: MatchState,
  intents: GameplayIntent[],
): ReplayResult {
  return replayGameIntents(initialState, intents, applyGameplayIntent);
}
```

- [ ] **Step 6: Run rules tests**

Run:

```bash
bun run test:rules
```

Expected: PASS with existing reducer, state, card DSL, and view tests.

- [ ] **Step 7: Commit**

```bash
git add packages/game-core packages/games-core
git commit -m "refactor: use generic games runtime in tcg core"
```

## Task 4: Add `@lunchtable/games-render`

**Files:**
- Create: `packages/games-render/package.json`
- Create: `packages/games-render/src/index.ts`
- Create: `packages/games-render/src/scene.ts`
- Create: `packages/games-render/src/scene.test.ts`
- Modify: `tsconfig.json`
- Modify: `packages/render-pixi/package.json`
- Modify: `packages/render-pixi/src/model.ts`

- [ ] **Step 1: Write failing scene tests**

Create `packages/games-render/src/scene.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createSceneCue } from "./scene";

describe("createSceneCue", () => {
  it("creates a deterministic render cue", () => {
    expect(
      createSceneCue({
        accentSeat: "seat-0",
        eventSequence: 4,
        kind: "phase",
        label: "Main phase",
      }),
    ).toEqual({
      accentSeat: "seat-0",
      eventSequence: 4,
      kind: "phase",
      label: "Main phase",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bunx vitest run packages/games-render/src
```

Expected: FAIL because `./scene` does not exist.

- [ ] **Step 3: Add package metadata and path mapping**

Create `packages/games-render/package.json`:

```json
{
  "name": "@lunchtable/games-render",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Add this entry to `compilerOptions.paths` in `tsconfig.json`:

```json
"@lunchtable/games-render": ["packages/games-render/src/index.ts"]
```

- [ ] **Step 4: Implement renderer-neutral scene types**

Create `packages/games-render/src/scene.ts`:

```ts
export interface RenderViewport {
  height: number;
  width: number;
}

export type RenderCueKind =
  | "combat"
  | "entry"
  | "phase"
  | "stack"
  | "turn"
  | "warning";

export interface RenderCue {
  accentSeat: string | null;
  eventSequence: number;
  kind: RenderCueKind;
  label: string;
}

export interface RenderObjectModel {
  id: string;
  interactive: boolean;
  label: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  size: {
    height: number;
    width: number;
  };
}

export interface RenderSceneModel {
  cue: RenderCue | null;
  objects: RenderObjectModel[];
  viewport: RenderViewport;
}

export function createSceneCue(cue: RenderCue): RenderCue {
  return {
    accentSeat: cue.accentSeat,
    eventSequence: cue.eventSequence,
    kind: cue.kind,
    label: cue.label,
  };
}
```

Create `packages/games-render/src/index.ts`:

```ts
export {
  createSceneCue,
} from "./scene";
export type {
  RenderCue,
  RenderCueKind,
  RenderObjectModel,
  RenderSceneModel,
  RenderViewport,
} from "./scene";
```

- [ ] **Step 5: Wire Pixi model types**

Modify `packages/render-pixi/package.json` dependencies:

```json
"dependencies": {
  "@lunchtable/games-render": "workspace:*",
  "@lunchtable/shared-types": "workspace:*",
  "@pixi/react": "^8.0.3",
  "pixi.js": "^8.2.6",
  "react": "^19.2.0"
}
```

In `packages/render-pixi/src/model.ts`, import and extend generic render types:

```ts
import type {
  RenderCue,
  RenderCueKind,
  RenderViewport,
} from "@lunchtable/games-render";
```

Change these type declarations:

```ts
export interface BoardViewport extends RenderViewport {}
export type BoardCueKind = RenderCueKind;
export interface BoardCue extends RenderCue {}
```

- [ ] **Step 6: Run renderer tests**

Run:

```bash
bunx vitest run packages/games-render/src tests/match-renderer.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json packages/games-render packages/render-pixi
git commit -m "feat: add renderer-neutral scene model"
```

## Task 5: Add `@lunchtable/games-ai`

**Files:**
- Create: `packages/games-ai/package.json`
- Create: `packages/games-ai/src/index.ts`
- Create: `packages/games-ai/src/actions.ts`
- Create: `packages/games-ai/src/external.ts`
- Create: `packages/games-ai/src/external.test.ts`
- Modify: `tsconfig.json`
- Modify: `packages/bot-sdk/package.json`
- Modify: `packages/bot-sdk/src/types.ts`
- Modify: `packages/bot-sdk/src/external.ts`

- [ ] **Step 1: Write failing external decision tests**

Create `packages/games-ai/src/external.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { resolveExternalActionId } from "./external";
import type { LegalActionDescriptor } from "./actions";

const actions: LegalActionDescriptor[] = [
  {
    actionId: "action-pass",
    humanLabel: "Pass priority",
    intent: { kind: "passPriority" },
    kind: "passPriority",
    machineLabel: "pass_priority()",
    priority: 1,
  },
];

describe("resolveExternalActionId", () => {
  it("returns the matching legal action", () => {
    expect(resolveExternalActionId(actions, "action-pass")).toEqual(actions[0]);
  });

  it("returns null for null responses", () => {
    expect(resolveExternalActionId(actions, null)).toBeNull();
  });

  it("throws for unrecognized action ids", () => {
    expect(() => resolveExternalActionId(actions, "missing")).toThrow(
      "External agent returned an unrecognized actionId",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bunx vitest run packages/games-ai/src
```

Expected: FAIL because `./external` and `./actions` do not exist.

- [ ] **Step 3: Add package metadata and path mapping**

Create `packages/games-ai/package.json`:

```json
{
  "name": "@lunchtable/games-ai",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Add this entry to `compilerOptions.paths` in `tsconfig.json`:

```json
"@lunchtable/games-ai": ["packages/games-ai/src/index.ts"]
```

- [ ] **Step 4: Implement generic AI contracts**

Create `packages/games-ai/src/actions.ts`:

```ts
export interface LegalActionDescriptor<TIntent = { kind: string }> {
  actionId: string;
  humanLabel: string;
  intent: TIntent;
  kind: string;
  machineLabel: string;
  priority: number;
}

export interface DecisionFrame<TView, TAction extends LegalActionDescriptor> {
  deadlineAt: number | null;
  legalActions: TAction[];
  receivedAt: number;
  seat: string;
  view: TView;
}
```

Create `packages/games-ai/src/external.ts`:

```ts
import type { LegalActionDescriptor } from "./actions";

export function resolveExternalActionId<TAction extends LegalActionDescriptor>(
  actions: TAction[],
  actionId: string | null,
): TAction | null {
  if (actionId === null) {
    return null;
  }

  const action = actions.find((candidate) => candidate.actionId === actionId);
  if (!action) {
    throw new Error("External agent returned an unrecognized actionId");
  }

  return action;
}
```

Create `packages/games-ai/src/index.ts`:

```ts
export {
  resolveExternalActionId,
} from "./external";
export type {
  DecisionFrame,
  LegalActionDescriptor,
} from "./actions";
```

- [ ] **Step 5: Wire bot SDK types to generic AI contracts**

Modify `packages/bot-sdk/package.json` dependencies:

```json
"dependencies": {
  "@lunchtable/card-content": "workspace:*",
  "@lunchtable/games-ai": "workspace:*",
  "@lunchtable/shared-types": "workspace:*"
}
```

In `packages/bot-sdk/src/types.ts`, import generic types:

```ts
import type {
  DecisionFrame,
  LegalActionDescriptor,
} from "@lunchtable/games-ai";
```

Change `BotDecisionFrame`:

```ts
export interface BotDecisionFrame
  extends DecisionFrame<MatchSeatView, BotLegalAction> {
  availableIntentKinds: GameplayIntentKind[];
  catalog: CardCatalogEntry[];
  context: AgentMatchContextV1;
  matchId: MatchId;
  seat: BotSeatId;
}
```

Change `BotLegalAction`:

```ts
export type BotLegalAction = Omit<
  LegalActionDescriptor<BotSupportedIntent>,
  "intent"
> &
  Omit<LegalActionDescriptorV1, "intent"> & {
    intent: BotSupportedIntent;
  };
```

In `packages/bot-sdk/src/external.ts`, import the resolver:

```ts
import { resolveExternalActionId } from "@lunchtable/games-ai";
```

Replace the action lookup:

```ts
const action = resolveExternalActionId(
  listLegalBotActions(input.frame),
  parsed.actionId,
);
if (!action) {
  return null;
}
```

- [ ] **Step 6: Run AI and bot tests**

Run:

```bash
bunx vitest run packages/games-ai/src tests/bot-foundation.test.ts tests/bot-runner-policy.test.ts tests/agent-playability.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json packages/games-ai packages/bot-sdk
git commit -m "feat: add generic games ai contracts"
```

## Task 6: Add Generated Card/Tabletop Pack Admission

**Files:**
- Create: `packages/card-content/src/generated-pack.ts`
- Create: `tests/generated-card-tabletop-pack.test.ts`
- Modify: `packages/card-content/src/index.ts`

- [ ] **Step 1: Write failing admission test**

Create `tests/generated-card-tabletop-pack.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  createGeneratedCardTabletopPack,
  validateGeneratedCardTabletopPack,
} from "@lunchtable/card-content";

describe("generated card tabletop packs", () => {
  it("admits the starter format as a generated pack", () => {
    const pack = createGeneratedCardTabletopPack();
    const result = validateGeneratedCardTabletopPack(pack);

    expect(result).toEqual({ issues: [], ok: true });
    expect(pack.manifest.id).toBe("standard-alpha-card-duel");
    expect(pack.objects.some((object) => object.kind === "card")).toBe(true);
    expect(pack.zones.some((zone) => zone.kind === "deck")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bunx vitest run tests/generated-card-tabletop-pack.test.ts
```

Expected: FAIL because `createGeneratedCardTabletopPack` is not exported.

- [ ] **Step 3: Implement generated pack helpers**

Create `packages/card-content/src/generated-pack.ts`:

```ts
import type {
  GamePack,
  GamePackValidationResult,
  TabletopObject,
  TabletopZone,
} from "@lunchtable/games-tabletop";

import { starterFormat } from "./formats";

function createStarterZones(): TabletopZone[] {
  return ["seat-0", "seat-1"].flatMap((seat) => [
    {
      id: `${seat}:deck`,
      kind: "deck",
      name: `${seat} deck`,
      ordering: "ordered",
      ownerSeat: seat,
      visibility: "private-owner",
    },
    {
      id: `${seat}:hand`,
      kind: "hand",
      name: `${seat} hand`,
      ordering: "ordered",
      ownerSeat: seat,
      visibility: "private-owner",
    },
    {
      id: `${seat}:board`,
      kind: "board",
      name: `${seat} board`,
      ordering: "unordered",
      ownerSeat: seat,
      visibility: "public",
    },
    {
      id: `${seat}:discard`,
      kind: "discard",
      name: `${seat} discard`,
      ordering: "ordered",
      ownerSeat: seat,
      visibility: "public",
    },
  ]);
}

function createStarterObjects(): TabletopObject[] {
  return starterFormat.cardPool.map((card) => ({
    id: card.id,
    kind: "card",
    name: card.name,
    ownerSeat: null,
    state: "ready",
    visibility: "public",
    zoneId: "catalog",
  }));
}

export function createGeneratedCardTabletopPack(): GamePack {
  return {
    manifest: {
      id: "standard-alpha-card-duel",
      runtimeVersion: "0.1.0",
      title: "Standard Alpha Card Duel",
      version: "0.1.0",
    },
    objects: createStarterObjects(),
    seats: [
      {
        actorType: "human",
        id: "seat-0",
        name: "Seat 0",
        permissions: ["submitIntent"],
        status: "ready",
      },
      {
        actorType: "human",
        id: "seat-1",
        name: "Seat 1",
        permissions: ["submitIntent"],
        status: "ready",
      },
    ],
    zones: createStarterZones(),
  };
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort();
}

export function validateGeneratedCardTabletopPack(
  pack: GamePack,
): GamePackValidationResult {
  const duplicateObjectIds = findDuplicates(
    pack.objects.map((object) => object.id),
  );
  const duplicateSeatIds = findDuplicates(pack.seats.map((seat) => seat.id));
  const duplicateZoneIds = findDuplicates(pack.zones.map((zone) => zone.id));

  return {
    issues: [
      ...duplicateObjectIds.map((id) => ({
        code: "duplicateObjectId" as const,
        message: `${id}: duplicate object id`,
      })),
      ...duplicateSeatIds.map((id) => ({
        code: "duplicateSeatId" as const,
        message: `${id}: duplicate seat id`,
      })),
      ...duplicateZoneIds.map((id) => ({
        code: "duplicateZoneId" as const,
        message: `${id}: duplicate zone id`,
      })),
    ],
    ok:
      duplicateObjectIds.length === 0 &&
      duplicateSeatIds.length === 0 &&
      duplicateZoneIds.length === 0,
  };
}
```

Modify `packages/card-content/src/index.ts`:

```ts
export {
  createGeneratedCardTabletopPack,
  validateGeneratedCardTabletopPack,
} from "./generated-pack";
```

- [ ] **Step 4: Add dependency**

Modify `packages/card-content/package.json` dependencies:

```json
"dependencies": {
  "@lunchtable/game-core": "workspace:*",
  "@lunchtable/games-tabletop": "workspace:*",
  "@lunchtable/shared-types": "workspace:*"
}
```

- [ ] **Step 5: Run admission test**

Run:

```bash
bunx vitest run tests/generated-card-tabletop-pack.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/card-content tests/generated-card-tabletop-pack.test.ts
git commit -m "feat: admit generated card tabletop packs"
```

## Task 7: Add Dependency Boundary Tests

**Files:**
- Create: `tests/lunch-table-games-boundaries.test.ts`

- [ ] **Step 1: Write boundary tests**

Create `tests/lunch-table-games-boundaries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const genericPackageRoots = [
  "packages/games-core/src",
  "packages/games-tabletop/src",
  "packages/games-ai/src",
  "packages/games-render/src",
];

const forbiddenImports = [
  "@lunchtable/bot-sdk",
  "@lunchtable/card-content",
  "@lunchtable/game-core",
  "@lunchtable/render-pixi",
  "@lunchtable/shared-types",
  "@pixi/react",
  "convex",
  "pixi.js",
  "react",
  "three",
];

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return listSourceFiles(path);
    }
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

describe("Lunch Table Games generic package boundaries", () => {
  it("keeps generic packages independent from product and renderer imports", () => {
    const violations = genericPackageRoots.flatMap((root) =>
      listSourceFiles(root).flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return forbiddenImports
          .filter((importPath) => source.includes(`from "${importPath}"`))
          .map((importPath) => `${file} imports ${importPath}`);
      }),
    );

    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run boundary test**

Run:

```bash
bunx vitest run tests/lunch-table-games-boundaries.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/lunch-table-games-boundaries.test.ts
git commit -m "test: enforce games package boundaries"
```

## Task 8: Run Final Verification

**Files:**
- Read: `package.json`
- Read: `tsconfig.json`
- Read: `docs/superpowers/specs/2026-05-02-lunch-table-games-design.md`

- [ ] **Step 1: Run targeted tests**

Run:

```bash
bunx vitest run packages/games-core/src packages/games-tabletop/src packages/games-render/src packages/games-ai/src tests/generated-card-tabletop-pack.test.ts tests/lunch-table-games-boundaries.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run existing proof tests**

Run:

```bash
bun run test:rules
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run broader unit suite**

Run:

```bash
bun run test:unit
```

Expected: PASS.

- [ ] **Step 5: Confirm git state**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: `git status --short` has no output after commits; recent commits show each task commit.
