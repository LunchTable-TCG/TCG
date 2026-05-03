export type {
  SideScrollerCollectibleState,
  SideScrollerEngineConfig,
  SideScrollerEvent,
  SideScrollerFacing,
  SideScrollerGameConfig,
  SideScrollerGoalState,
  SideScrollerHazardState,
  SideScrollerIntent,
  SideScrollerLevelConfig,
  SideScrollerPhysicsConfig,
  SideScrollerPlatform,
  SideScrollerRunnerSpawn,
  SideScrollerRunnerState,
  SideScrollerSeatId,
  SideScrollerState,
} from "./engine";
export type {
  SideScrollerSelfPlayInput,
  SideScrollerSelfPlayResult,
  SideScrollerSelfPlayStep,
  SideScrollerStudioFrame,
  SideScrollerStudioSeat,
} from "./studio";
export type { SideScrollerAssetBundle } from "@lunchtable/games-assets";
export {
  applySideScrollerIntent,
  createSideScrollerComponents,
  createSideScrollerInitialState,
  createSideScrollerPlatformsFromAssetBundle,
  createSideScrollerRuleset,
  createSideScrollerRuntimePlatforms,
  deriveSideScrollerRenderScene,
  listSideScrollerLegalIntents,
  sideScrollerStarterConfig,
  stepSideScrollerWorld,
} from "./engine";
export {
  createSideScrollerStudioFrame,
  runSideScrollerSelfPlay,
} from "./studio";
