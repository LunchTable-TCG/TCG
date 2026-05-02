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
  return { ...cue };
}
