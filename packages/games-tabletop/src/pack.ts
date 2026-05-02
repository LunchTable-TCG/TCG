import type { GameRuleset } from "@lunchtable/games-core";
import type { TabletopAssetRef, TabletopComponent } from "./components";
import type { TabletopObject, TabletopSeat, TabletopZone } from "./primitives";

export type GameGenre =
  | "arena-shooter-3d"
  | "card-tabletop"
  | "custom"
  | "dice-tabletop"
  | "side-scroller";

export type GamePackExtensionLevel = 1 | 2 | 3 | 4;

export interface GamePackManifest {
  description: string;
  extensionLevel?: GamePackExtensionLevel;
  genre?: GameGenre;
  id: string;
  name: string;
  runtimeVersion?: string;
  version: string;
}

export interface GamePack<
  TConfig,
  TState,
  TIntent,
  TEvent,
  TSeatView,
  TSpectatorView,
  TScene,
> {
  manifest: GamePackManifest;
  ruleset: GameRuleset<
    TConfig,
    TState,
    TIntent,
    TEvent,
    TSeatView,
    TSpectatorView,
    TScene
  >;
}

export interface GamePackValidationIssue {
  message: string;
  path: string;
  severity: "error" | "warning";
}

export interface GamePackValidationResult {
  issues: GamePackValidationIssue[];
  valid: boolean;
}

export interface GamePackScenario {
  id: string;
  name: string;
  setupId: string;
}

export interface PortableGamePack {
  assets: TabletopAssetRef[];
  components?: TabletopComponent[];
  manifest: GamePackManifest;
  objects: TabletopObject[];
  scenarios: GamePackScenario[];
  seats: TabletopSeat[];
  zones: TabletopZone[];
}
