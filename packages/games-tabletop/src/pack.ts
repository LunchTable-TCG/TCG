import type { GameRuleset } from "@lunchtable/games-core";

export interface GamePackManifest {
  description: string;
  id: string;
  name: string;
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
