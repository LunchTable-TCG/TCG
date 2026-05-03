import type { SideScrollerAssetBundle } from "@lunchtable/games-assets";
import type { GameRuleset, GameShell, Viewport } from "@lunchtable/games-core";
import type {
  RenderCameraHint,
  RenderObjectModel,
  RenderSceneModel,
} from "@lunchtable/games-render";
import type { TabletopComponent } from "@lunchtable/games-tabletop";

export interface SideScrollerGameConfig {
  seed: string;
}

export type SideScrollerSeatId = string;

export type SideScrollerFacing = "left" | "right";

export interface SideScrollerRunnerState {
  dashCooldown: number;
  facing: SideScrollerFacing;
  grounded: boolean;
  health: number;
  id: SideScrollerSeatId;
  score: number;
  velocityX: number;
  velocityY: number;
  x: number;
  y: number;
}

export interface SideScrollerHazardState {
  damage: number;
  defeated: boolean;
  id: string;
  x: number;
  y: number;
}

export interface SideScrollerCollectibleState {
  collectedBy: SideScrollerSeatId | null;
  id: string;
  value: number;
  x: number;
  y: number;
}

export interface SideScrollerGoalState {
  id: string;
  x: number;
  y: number;
}

export interface SideScrollerPlatform {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
}

export interface SideScrollerRunnerSpawn {
  facing?: SideScrollerFacing;
  health: number;
  seatId: SideScrollerSeatId;
  x: number;
  y: number;
}

export interface SideScrollerPhysicsConfig {
  attackRange: number;
  collectibleRange: number;
  dashCooldownTicks: number;
  dashSpeed: number;
  gravity: number;
  hazardRange: number;
  jumpVelocity: number;
  maxFallSpeed: number;
  moveSpeed: number;
}

export interface SideScrollerLevelConfig {
  goals: SideScrollerGoalState[];
  groundY: number;
  hazards: Array<Omit<SideScrollerHazardState, "defeated">>;
  height: number;
  id: string;
  name: string;
  platforms: SideScrollerPlatform[];
  runners: SideScrollerRunnerSpawn[];
  collectibles: Array<Omit<SideScrollerCollectibleState, "collectedBy">>;
  width: number;
}

export interface SideScrollerEngineConfig {
  assets?: SideScrollerAssetBundle;
  level: SideScrollerLevelConfig;
  physics: SideScrollerPhysicsConfig;
  rulesetId: string;
  title: string;
  version: string;
}

export interface SideScrollerState {
  collectibles: SideScrollerCollectibleState[];
  goals: SideScrollerGoalState[];
  hazards: SideScrollerHazardState[];
  platforms: SideScrollerPlatform[];
  runners: Record<SideScrollerSeatId, SideScrollerRunnerState>;
  shell: GameShell;
  tick: number;
}

export type SideScrollerIntent =
  | { kind: "attack"; seatId: SideScrollerSeatId }
  | { kind: "dash"; seatId: SideScrollerSeatId }
  | { kind: "jump"; seatId: SideScrollerSeatId }
  | { kind: "moveLeft"; seatId: SideScrollerSeatId }
  | { kind: "moveRight"; seatId: SideScrollerSeatId }
  | { kind: "wait"; seatId: SideScrollerSeatId };

export type SideScrollerEvent =
  | {
      collectibleId: string;
      kind: "collectibleClaimed";
      seatId: SideScrollerSeatId;
      value: number;
    }
  | { kind: "goalReached"; seatId: SideScrollerSeatId }
  | { hazardId: string; kind: "hazardDefeated"; seatId: SideScrollerSeatId }
  | {
      damage: number;
      hazardId: string;
      kind: "runnerDamaged";
      seatId: SideScrollerSeatId;
    }
  | { kind: "runnerDashed"; seatId: SideScrollerSeatId }
  | { kind: "runnerJumped"; seatId: SideScrollerSeatId }
  | { kind: "runnerMoved"; seatId: SideScrollerSeatId; x: number; y: number };

export const sideScrollerStarterConfig: SideScrollerEngineConfig = {
  level: {
    collectibles: [
      {
        id: "token:collectible-1",
        value: 1,
        x: 420,
        y: 28,
      },
    ],
    goals: [{ id: "token:goal", x: 960, y: 0 }],
    groundY: 0,
    hazards: [{ damage: 1, id: "token:hazard-1", x: 640, y: 0 }],
    height: 720,
    id: "level-1",
    name: "Level 1",
    platforms: [
      { height: 48, id: "platform:ground", width: 2400, x: 1200, y: -24 },
      { height: 24, id: "platform:ledge-1", width: 240, x: 520, y: 140 },
    ],
    runners: [
      { facing: "right", health: 3, seatId: "seat-0", x: 0, y: 0 },
      { facing: "right", health: 3, seatId: "seat-1", x: 0, y: 0 },
    ],
    width: 2400,
  },
  physics: {
    attackRange: 96,
    collectibleRange: 64,
    dashCooldownTicks: 3,
    dashSpeed: 144,
    gravity: 8,
    hazardRange: 40,
    jumpVelocity: 132,
    maxFallSpeed: 96,
    moveSpeed: 72,
  },
  rulesetId: "side-scroller",
  title: "Side-Scroller Starter",
  version: "0.1.0",
};

export function createSideScrollerInitialState(
  config: SideScrollerEngineConfig,
  seed = "seed:side-scroller",
): SideScrollerState {
  return {
    collectibles: config.level.collectibles.map((collectible) => ({
      ...collectible,
      collectedBy: null,
    })),
    goals: config.level.goals.map((goal) => ({ ...goal })),
    hazards: config.level.hazards.map((hazard) => ({
      ...hazard,
      defeated: false,
    })),
    platforms: config.level.platforms.map((platform) => ({ ...platform })),
    runners: Object.fromEntries(
      config.level.runners.map((runner) => [
        runner.seatId,
        createRunnerState(runner),
      ]),
    ),
    shell: createShell(config, seed),
    tick: 0,
  };
}

export function listSideScrollerLegalIntents(
  config: SideScrollerEngineConfig,
  state: SideScrollerState,
  seatId: SideScrollerSeatId,
): SideScrollerIntent[] {
  const runner = state.runners[seatId];
  if (runner === undefined || state.shell.status !== "playing") {
    return [];
  }

  const intents: SideScrollerIntent[] = [
    { kind: "moveLeft", seatId },
    { kind: "moveRight", seatId },
  ];

  if (runner.dashCooldown === 0) {
    intents.push({ kind: "dash", seatId });
  }

  if (runner.grounded) {
    intents.push({ kind: "jump", seatId });
  }

  if (findAttackableHazard(config, state, seatId) !== null) {
    intents.push({ kind: "attack", seatId });
  }

  intents.push({ kind: "wait", seatId });
  return intents;
}

export function applySideScrollerIntent(
  config: SideScrollerEngineConfig,
  state: SideScrollerState,
  intent: SideScrollerIntent,
) {
  if (!isSideScrollerIntentLegal(config, state, intent)) {
    return {
      events: [],
      nextState: state,
      outcome: "rejected" as const,
      reason: "Intent is not legal for this runner.",
    };
  }

  const actionResult = applyRunnerAction(config, state, intent);
  const stepped = stepSideScrollerWorld(
    config,
    actionResult.state,
    intent.seatId,
    actionResult.events,
  );
  const nextActiveSeatId = getNextSeatId(stepped.nextState, intent.seatId);

  return {
    events: stepped.events,
    nextState: {
      ...stepped.nextState,
      shell: {
        ...stepped.nextState.shell,
        activeSeatId: nextActiveSeatId,
        prioritySeatId: nextActiveSeatId,
        round:
          nextActiveSeatId === getFirstSeatId(stepped.nextState)
            ? stepped.nextState.shell.round + 1
            : stepped.nextState.shell.round,
      },
    },
    outcome: "applied" as const,
  };
}

export function stepSideScrollerWorld(
  config: SideScrollerEngineConfig,
  state: SideScrollerState,
  seatId: SideScrollerSeatId,
  initialEvents: SideScrollerEvent[] = [],
) {
  const runner = state.runners[seatId];
  if (runner === undefined || state.shell.status !== "playing") {
    return {
      events: initialEvents,
      nextState: state,
      outcome: "noop" as const,
    };
  }

  const movedRunner = moveRunner(config, runner);
  let nextState = updateRunner(state, seatId, movedRunner);
  const events: SideScrollerEvent[] = [
    ...initialEvents,
    { kind: "runnerMoved", seatId, x: movedRunner.x, y: movedRunner.y },
  ];

  const collected = collectOverlappingItems(config, nextState, seatId);
  nextState = collected.state;
  events.push(...collected.events);

  const damaged = damageOverlappingHazards(config, nextState, seatId);
  nextState = damaged.state;
  events.push(...damaged.events);

  const reachedGoal = nextState.goals.some((goal) => movedRunner.x >= goal.x);
  if (reachedGoal) {
    events.push({ kind: "goalReached", seatId });
  }

  return {
    events,
    nextState: {
      ...nextState,
      shell: {
        ...nextState.shell,
        status: reachedGoal ? "complete" : nextState.shell.status,
        version: nextState.shell.version + 1,
      },
      tick: nextState.tick + 1,
    },
    outcome: "applied" as const,
  };
}

export function deriveSideScrollerRenderScene(
  config: SideScrollerEngineConfig,
  state: SideScrollerState,
  viewport: Viewport,
): RenderSceneModel {
  const activeRunner = getActiveRunner(state);
  const camera: RenderCameraHint = {
    mode: "side-scroller",
    target: { x: activeRunner.x, y: activeRunner.y, z: 0 },
    zoom: 1,
  };

  return {
    camera,
    cue: null,
    interactions: Object.keys(state.runners).map((seatId) => ({
      affordance: "move",
      objectId: `piece:runner-${seatId}`,
      seatId,
    })),
    objects: [
      withSideScrollerAsset(config, {
        id: `board:${config.level.id}`,
        interactive: false,
        label: config.level.name,
        position: { x: config.level.width / 2, y: -24, z: 0 },
        size: { height: config.level.height, width: config.level.width },
      }),
      ...state.platforms.map((platform) =>
        withSideScrollerAsset(config, {
          id: platform.id,
          interactive: false,
          label: platform.id,
          position: { x: platform.x, y: platform.y, z: 1 },
          size: { height: platform.height, width: platform.width },
        }),
      ),
      ...Object.values(state.runners).map((runner) =>
        withSideScrollerAsset(config, {
          id: `piece:runner-${runner.id}`,
          interactive: true,
          label: runner.id,
          position: { x: runner.x, y: runner.y, z: 2 },
          size: { height: 72, width: 36 },
        }),
      ),
      ...state.hazards.map((hazard) =>
        withSideScrollerAsset(config, {
          id: hazard.id,
          interactive: !hazard.defeated,
          label: hazard.defeated ? "Defeated Hazard" : "Hazard",
          position: { x: hazard.x, y: hazard.y, z: 2 },
          size: { height: 48, width: 48 },
        }),
      ),
      ...state.collectibles.map((collectible) =>
        withSideScrollerAsset(config, {
          id: collectible.id,
          interactive: collectible.collectedBy === null,
          label: collectible.collectedBy === null ? "Collectible" : "Collected",
          position: { x: collectible.x, y: collectible.y, z: 2 },
          size: { height: 28, width: 28 },
        }),
      ),
      ...state.goals.map((goal) =>
        withSideScrollerAsset(config, {
          id: goal.id,
          interactive: false,
          label: "Goal",
          position: { x: goal.x, y: goal.y, z: 2 },
          size: { height: 120, width: 24 },
        }),
      ),
    ],
    viewport: { ...viewport },
  };
}

export function createSideScrollerRuleset(
  config: SideScrollerEngineConfig,
): GameRuleset<
  SideScrollerGameConfig,
  SideScrollerState,
  SideScrollerIntent,
  SideScrollerEvent,
  SideScrollerState,
  SideScrollerState,
  RenderSceneModel
> {
  return {
    applyIntent(state, intent) {
      return applySideScrollerIntent(config, state, intent);
    },
    createInitialState(gameConfig) {
      return createSideScrollerInitialState(config, gameConfig.seed);
    },
    deriveRenderScene(state, viewport) {
      return deriveSideScrollerRenderScene(config, state, viewport);
    },
    deriveSeatView(state) {
      return state;
    },
    deriveSpectatorView(state) {
      return state;
    },
    listLegalIntents(state, seatId) {
      return listSideScrollerLegalIntents(config, state, seatId);
    },
  };
}

export function createSideScrollerComponents(
  config: SideScrollerEngineConfig,
): TabletopComponent[] {
  return [
    {
      id: `board:${config.level.id}`,
      kind: "board",
      name: config.level.name,
      surface: {
        height: config.level.height,
        shape: "rectangle",
        width: config.level.width,
      },
    },
    ...config.level.platforms.map(
      (platform): TabletopComponent => ({
        id: platform.id,
        kind: "board",
        name: platform.id,
        surface: {
          height: platform.height,
          shape: "rectangle",
          width: platform.width,
        },
      }),
    ),
    ...config.level.runners.map(
      (runner): TabletopComponent => ({
        id: `piece:runner-${runner.seatId}`,
        kind: "piece",
        movement: { axes: ["x", "y"], grid: "continuous" },
        name: `Runner ${runner.seatId}`,
      }),
    ),
    ...config.level.hazards.map(
      (hazard): TabletopComponent => ({
        id: hazard.id,
        kind: "token",
        name: "Hazard",
        ownerSeat: null,
        visibility: "public",
      }),
    ),
    ...config.level.collectibles.map(
      (collectible): TabletopComponent => ({
        id: collectible.id,
        kind: "token",
        name: "Collectible",
        ownerSeat: null,
        visibility: "public",
      }),
    ),
    ...config.level.goals.map(
      (goal): TabletopComponent => ({
        id: goal.id,
        kind: "token",
        name: "Goal",
        ownerSeat: null,
        visibility: "public",
      }),
    ),
  ];
}

function withSideScrollerAsset(
  config: SideScrollerEngineConfig,
  object: RenderObjectModel,
): RenderObjectModel {
  const binding = config.assets?.sideScroller.bindings.find(
    (candidate) => candidate.objectId === object.id,
  );
  if (binding === undefined) {
    return object;
  }

  return {
    ...object,
    asset: {
      assetId: binding.assetId,
      ...(binding.clip === undefined ? {} : { clip: binding.clip }),
      ...(binding.frame === undefined ? {} : { frame: binding.frame }),
      ...(binding.variant === undefined ? {} : { variant: binding.variant }),
    },
  };
}

function createRunnerState(
  spawn: SideScrollerRunnerSpawn,
): SideScrollerRunnerState {
  return {
    dashCooldown: 0,
    facing: spawn.facing ?? "right",
    grounded: spawn.y === 0,
    health: spawn.health,
    id: spawn.seatId,
    score: 0,
    velocityX: 0,
    velocityY: 0,
    x: spawn.x,
    y: spawn.y,
  };
}

function isSideScrollerIntentLegal(
  config: SideScrollerEngineConfig,
  state: SideScrollerState,
  intent: SideScrollerIntent,
): boolean {
  return listSideScrollerLegalIntents(config, state, intent.seatId).some(
    (legalIntent) => legalIntent.kind === intent.kind,
  );
}

function applyRunnerAction(
  config: SideScrollerEngineConfig,
  state: SideScrollerState,
  intent: SideScrollerIntent,
): { events: SideScrollerEvent[]; state: SideScrollerState } {
  const runner = state.runners[intent.seatId];
  if (runner === undefined) {
    return { events: [], state };
  }

  if (intent.kind === "moveLeft") {
    return {
      events: [],
      state: updateRunner(state, intent.seatId, {
        ...runner,
        facing: "left",
        velocityX: -config.physics.moveSpeed,
      }),
    };
  }

  if (intent.kind === "moveRight") {
    return {
      events: [],
      state: updateRunner(state, intent.seatId, {
        ...runner,
        facing: "right",
        velocityX: config.physics.moveSpeed,
      }),
    };
  }

  if (intent.kind === "dash") {
    return {
      events: [{ kind: "runnerDashed", seatId: intent.seatId }],
      state: updateRunner(state, intent.seatId, {
        ...runner,
        dashCooldown: config.physics.dashCooldownTicks,
        velocityX:
          runner.facing === "right"
            ? config.physics.dashSpeed
            : -config.physics.dashSpeed,
      }),
    };
  }

  if (intent.kind === "jump") {
    return {
      events: [{ kind: "runnerJumped", seatId: intent.seatId }],
      state: updateRunner(state, intent.seatId, {
        ...runner,
        grounded: false,
        velocityY: config.physics.jumpVelocity,
      }),
    };
  }

  if (intent.kind === "attack") {
    const hazard = findAttackableHazard(config, state, intent.seatId);
    if (hazard === null) {
      return { events: [], state };
    }

    return {
      events: [
        { hazardId: hazard.id, kind: "hazardDefeated", seatId: intent.seatId },
      ],
      state: {
        ...state,
        hazards: state.hazards.map((candidate) =>
          candidate.id === hazard.id
            ? { ...candidate, defeated: true }
            : candidate,
        ),
        runners: {
          ...state.runners,
          [intent.seatId]: {
            ...runner,
            score: runner.score + 2,
            velocityX: 0,
          },
        },
      },
    };
  }

  return {
    events: [],
    state: updateRunner(state, intent.seatId, { ...runner, velocityX: 0 }),
  };
}

function moveRunner(
  config: SideScrollerEngineConfig,
  runner: SideScrollerRunnerState,
): SideScrollerRunnerState {
  const nextX = clamp(runner.x + runner.velocityX, 0, config.level.width);
  const projectedY = runner.y + runner.velocityY;
  const nextVelocityY = Math.max(
    -config.physics.maxFallSpeed,
    runner.velocityY - config.physics.gravity,
  );
  const landingY = findLandingY(config, runner.y, projectedY, nextX);
  const nextY = landingY ?? projectedY;
  const grounded = landingY !== null;

  return {
    ...runner,
    dashCooldown: Math.max(0, runner.dashCooldown - 1),
    grounded,
    velocityX: 0,
    velocityY: grounded ? 0 : nextVelocityY,
    x: nextX,
    y: grounded ? landingY : nextY,
  };
}

function findLandingY(
  config: SideScrollerEngineConfig,
  previousY: number,
  projectedY: number,
  x: number,
): number | null {
  if (projectedY <= config.level.groundY) {
    return config.level.groundY;
  }

  const platform = config.level.platforms.find(
    (candidate) =>
      candidate.y > config.level.groundY &&
      previousY >= candidate.y &&
      projectedY <= candidate.y &&
      Math.abs(candidate.x - x) <= candidate.width / 2,
  );

  return platform?.y ?? null;
}

function collectOverlappingItems(
  config: SideScrollerEngineConfig,
  state: SideScrollerState,
  seatId: SideScrollerSeatId,
): { events: SideScrollerEvent[]; state: SideScrollerState } {
  const runner = state.runners[seatId];
  if (runner === undefined) {
    return { events: [], state };
  }

  const collectible = state.collectibles.find(
    (candidate) =>
      candidate.collectedBy === null &&
      distance(candidate.x, candidate.y, runner.x, runner.y) <=
        config.physics.collectibleRange,
  );
  if (collectible === undefined) {
    return { events: [], state };
  }

  return {
    events: [
      {
        collectibleId: collectible.id,
        kind: "collectibleClaimed",
        seatId,
        value: collectible.value,
      },
    ],
    state: {
      ...state,
      collectibles: state.collectibles.map((candidate) =>
        candidate.id === collectible.id
          ? { ...candidate, collectedBy: seatId }
          : candidate,
      ),
      runners: {
        ...state.runners,
        [seatId]: {
          ...runner,
          score: runner.score + collectible.value,
        },
      },
    },
  };
}

function damageOverlappingHazards(
  config: SideScrollerEngineConfig,
  state: SideScrollerState,
  seatId: SideScrollerSeatId,
): { events: SideScrollerEvent[]; state: SideScrollerState } {
  const runner = state.runners[seatId];
  if (runner === undefined) {
    return { events: [], state };
  }

  const hazard = state.hazards.find(
    (candidate) =>
      !candidate.defeated &&
      distance(candidate.x, candidate.y, runner.x, runner.y) <=
        config.physics.hazardRange,
  );
  if (hazard === undefined) {
    return { events: [], state };
  }

  return {
    events: [
      {
        damage: hazard.damage,
        hazardId: hazard.id,
        kind: "runnerDamaged",
        seatId,
      },
    ],
    state: {
      ...state,
      runners: {
        ...state.runners,
        [seatId]: {
          ...runner,
          health: Math.max(0, runner.health - hazard.damage),
        },
      },
    },
  };
}

function findAttackableHazard(
  config: SideScrollerEngineConfig,
  state: SideScrollerState,
  seatId: SideScrollerSeatId,
): SideScrollerHazardState | null {
  const runner = state.runners[seatId];
  if (runner === undefined) {
    return null;
  }

  const attackX =
    runner.x +
    (runner.facing === "right"
      ? config.physics.attackRange
      : -config.physics.attackRange);

  return (
    state.hazards.find(
      (hazard) =>
        !hazard.defeated &&
        Math.abs(hazard.x - attackX) <= config.physics.attackRange &&
        Math.abs(hazard.y - runner.y) <= config.physics.attackRange,
    ) ?? null
  );
}

function updateRunner(
  state: SideScrollerState,
  seatId: SideScrollerSeatId,
  runner: SideScrollerRunnerState,
): SideScrollerState {
  return {
    ...state,
    runners: { ...state.runners, [seatId]: runner },
  };
}

function getActiveRunner(state: SideScrollerState): SideScrollerRunnerState {
  const activeSeatId = state.shell.activeSeatId ?? getFirstSeatId(state);
  return state.runners[activeSeatId] ?? state.runners[getFirstSeatId(state)];
}

function getFirstSeatId(state: SideScrollerState): SideScrollerSeatId {
  const firstSeatId = Object.keys(state.runners)[0];
  if (firstSeatId === undefined) {
    throw new Error("Side-scroller state requires at least one runner");
  }
  return firstSeatId;
}

function getNextSeatId(
  state: SideScrollerState,
  seatId: SideScrollerSeatId,
): SideScrollerSeatId {
  const seatIds = Object.keys(state.runners);
  const currentIndex = seatIds.indexOf(seatId);
  if (currentIndex === -1) {
    return getFirstSeatId(state);
  }

  return seatIds[(currentIndex + 1) % seatIds.length] ?? getFirstSeatId(state);
}

function createShell(
  config: SideScrollerEngineConfig,
  seed: string,
): GameShell {
  return {
    activeSeatId: config.level.runners[0]?.seatId ?? null,
    format: {
      id: config.rulesetId,
      name: config.title,
      rulesetId: seed,
      version: config.version,
    },
    id: `${config.rulesetId}-starter`,
    phase: "run",
    prioritySeatId: config.level.runners[0]?.seatId ?? null,
    round: 1,
    status: "playing",
    timers: [],
    version: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(
  firstX: number,
  firstY: number,
  secondX: number,
  secondY: number,
): number {
  return Math.hypot(firstX - secondX, firstY - secondY);
}
