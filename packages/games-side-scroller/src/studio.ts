import { validateAssetBundle } from "@lunchtable/games-assets";
import type { Viewport } from "@lunchtable/games-core";
import type { RenderSceneModel } from "@lunchtable/games-render";

import {
  type SideScrollerEngineConfig,
  type SideScrollerEvent,
  type SideScrollerIntent,
  type SideScrollerSeatId,
  type SideScrollerState,
  applySideScrollerIntent,
  createSideScrollerInitialState,
  createSideScrollerPlatformsFromAssetBundle,
  deriveSideScrollerRenderScene,
  listSideScrollerLegalIntents,
} from "./engine";

export interface SideScrollerStudioFrame {
  assets: {
    boundObjectCount: number;
    boundObjectIds: string[];
    generatedPlatformCount: number;
    missingBindingObjectIds: string[];
    ready: boolean;
    spriteCount: number;
  };
  level: {
    collectibleCount: number;
    goalCount: number;
    hazardCount: number;
    height: number;
    id: string;
    name: string;
    platformCount: number;
    runnerCount: number;
    width: number;
  };
  scene: {
    cameraTarget: RenderSceneModel["camera"] extends null | undefined
      ? null
      : { x: number; y: number; z: number } | null;
    interactiveObjectIds: string[];
    objectCount: number;
  };
  seats: SideScrollerStudioSeat[];
}

export interface SideScrollerStudioSeat {
  agentReady: boolean;
  health: number;
  legalIntentKinds: Array<SideScrollerIntent["kind"]>;
  score: number;
  seatId: SideScrollerSeatId;
  x: number;
  y: number;
}

export interface SideScrollerAgentFrame {
  activeSeatId: SideScrollerSeatId | null;
  assets: SideScrollerStudioFrame["assets"];
  legalIntents: SideScrollerIntent[];
  objective: {
    collectiblesRemaining: number;
    goalsRemaining: number;
    hazardsRemaining: number;
  };
  renderScene: RenderSceneModel;
  scene: SideScrollerStudioFrame["scene"];
  seat: SideScrollerStudioSeat;
  seatId: SideScrollerSeatId;
  stateVersion: number;
  tick: number;
}

export interface SideScrollerSelfPlayInput {
  maxTurns: number;
  state?: SideScrollerState;
}

export interface SideScrollerSelfPlayStep {
  action: SideScrollerIntent;
  events: SideScrollerEvent[];
  seatId: SideScrollerSeatId;
  stateVersion: number;
  tick: number;
}

export interface SideScrollerSelfPlayResult {
  completed: boolean;
  finalState: SideScrollerState;
  steps: SideScrollerSelfPlayStep[];
  winnerSeatId: SideScrollerSeatId | null;
}

export function createSideScrollerStudioFrame(
  config: SideScrollerEngineConfig,
  viewport: Viewport,
  state?: SideScrollerState,
): SideScrollerStudioFrame {
  const assetValidation =
    config.assets === undefined ? null : validateAssetBundle(config.assets);
  const frameState =
    state ??
    createSideScrollerInitialState(
      assetValidation?.ok === false ? { ...config, assets: undefined } : config,
    );
  const scene = deriveSideScrollerRenderScene(config, frameState, viewport);
  const boundObjectIds = scene.objects
    .filter((object) => object.asset !== undefined)
    .map((object) => object.id);
  const missingBindingObjectIds = scene.objects
    .filter((object) => object.asset === undefined)
    .map((object) => object.id);
  const generatedPlatformCount =
    config.assets === undefined || assetValidation?.ok !== true
      ? 0
      : createSideScrollerPlatformsFromAssetBundle(config.assets).length;

  return {
    assets: {
      boundObjectCount: boundObjectIds.length,
      boundObjectIds,
      generatedPlatformCount,
      missingBindingObjectIds,
      ready: assetValidation?.ok ?? false,
      spriteCount: config.assets?.sprites.length ?? 0,
    },
    level: {
      collectibleCount: config.level.collectibles.length,
      goalCount: config.level.goals.length,
      hazardCount: config.level.hazards.length,
      height: config.level.height,
      id: config.level.id,
      name: config.level.name,
      platformCount: config.level.platforms.length,
      runnerCount: config.level.runners.length,
      width: config.level.width,
    },
    scene: {
      cameraTarget: scene.camera?.target ?? null,
      interactiveObjectIds: scene.objects
        .filter((object) => object.interactive)
        .map((object) => object.id),
      objectCount: scene.objects.length,
    },
    seats: Object.values(frameState.runners).map((runner) => {
      const legalIntentKinds = listSideScrollerLegalIntents(
        config,
        frameState,
        runner.id,
      ).map((intent) => intent.kind);

      return {
        agentReady: legalIntentKinds.length > 0,
        health: runner.health,
        legalIntentKinds,
        score: runner.score,
        seatId: runner.id,
        x: runner.x,
        y: runner.y,
      };
    }),
  };
}

export function runSideScrollerSelfPlay(
  config: SideScrollerEngineConfig,
  input: SideScrollerSelfPlayInput,
): SideScrollerSelfPlayResult {
  let state = input.state ?? createSideScrollerInitialState(config);
  const steps: SideScrollerSelfPlayStep[] = [];

  for (let index = 0; index < input.maxTurns; index += 1) {
    if (state.shell.status !== "playing") {
      break;
    }

    const seatId = state.shell.activeSeatId ?? getFirstSeatId(state);
    const action = chooseStudioAction(
      listSideScrollerLegalIntents(config, state, seatId),
    );
    if (action === null) {
      break;
    }

    const transition = applySideScrollerIntent(config, state, action);
    state = transition.nextState;
    steps.push({
      action,
      events: transition.events,
      seatId,
      stateVersion: state.shell.version,
      tick: state.tick,
    });
  }

  return {
    completed: state.shell.status === "complete",
    finalState: state,
    steps,
    winnerSeatId: findWinnerSeatId(state),
  };
}

export function createSideScrollerAgentFrame(
  config: SideScrollerEngineConfig,
  state: SideScrollerState | undefined,
  seatId: SideScrollerSeatId,
  viewport: Viewport,
): SideScrollerAgentFrame {
  const frameState = state ?? createSideScrollerInitialState(config);
  const studioFrame = createSideScrollerStudioFrame(
    config,
    viewport,
    frameState,
  );
  const seat = studioFrame.seats.find(
    (candidate) => candidate.seatId === seatId,
  );
  if (seat === undefined) {
    throw new Error(`Unknown side-scroller seat: ${seatId}`);
  }

  return {
    activeSeatId: frameState.shell.activeSeatId,
    assets: studioFrame.assets,
    legalIntents: listSideScrollerLegalIntents(config, frameState, seatId),
    objective: {
      collectiblesRemaining: frameState.collectibles.filter(
        (collectible) => collectible.collectedBy === null,
      ).length,
      goalsRemaining:
        frameState.shell.status === "complete" ? 0 : frameState.goals.length,
      hazardsRemaining: frameState.hazards.filter((hazard) => !hazard.defeated)
        .length,
    },
    renderScene: deriveSideScrollerRenderScene(config, frameState, viewport),
    scene: studioFrame.scene,
    seat,
    seatId,
    stateVersion: frameState.shell.version,
    tick: frameState.tick,
  };
}

function chooseStudioAction(
  legalIntents: SideScrollerIntent[],
): SideScrollerIntent | null {
  for (const kind of [
    "attack",
    "moveRight",
    "dash",
    "jump",
    "wait",
    "moveLeft",
  ] as const) {
    const intent = legalIntents.find((candidate) => candidate.kind === kind);
    if (intent !== undefined) {
      return intent;
    }
  }

  return null;
}

function findWinnerSeatId(state: SideScrollerState): SideScrollerSeatId | null {
  const winner = Object.values(state.runners).find(
    (runner) =>
      state.shell.status === "complete" && runner.x >= state.goals[0].x,
  );
  return winner?.id ?? null;
}

function getFirstSeatId(state: SideScrollerState): SideScrollerSeatId {
  const seatId = Object.keys(state.runners)[0];
  if (seatId === undefined) {
    throw new Error("Side-scroller self-play requires at least one runner");
  }
  return seatId;
}
