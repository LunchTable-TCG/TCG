export type RenderCameraMode =
  | "first-person"
  | "isometric-2.5d"
  | "orthographic-2d"
  | "perspective-3d"
  | "side-scroller";

export interface RenderVector3 {
  x: number;
  y: number;
  z: number;
}

export interface RenderCameraHint {
  mode: RenderCameraMode;
  target: RenderVector3;
  zoom: number;
}

export type RenderInteractionAffordance =
  | "activate"
  | "drag"
  | "inspect"
  | "move"
  | "select";

export interface RenderInteractionHint {
  affordance: RenderInteractionAffordance;
  objectId: string;
  seatId: string | null;
}

export function createCameraHint(camera: RenderCameraHint): RenderCameraHint {
  return { ...camera, target: { ...camera.target } };
}

export function createInteractionHint(
  interaction: RenderInteractionHint,
): RenderInteractionHint {
  return { ...interaction };
}
