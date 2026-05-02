import type { RenderCameraMode } from "./camera";
import type { RenderSceneModel, RenderViewport } from "./scene";

export type RendererAdapterKind = "dom" | "pixi" | "three";

export interface RendererAdapterDescriptor {
  id: string;
  kind: RendererAdapterKind;
  label: string;
  supportedCameraModes: RenderCameraMode[];
}

export interface RendererAdapterRegistry {
  adapters: RendererAdapterDescriptor[];
  findByCameraMode: (
    cameraMode: RenderCameraMode,
  ) => RendererAdapterDescriptor | null;
  getSceneViewport: (scene: RenderSceneModel) => RenderViewport;
}

export function createDefaultRendererAdapters(): RendererAdapterDescriptor[] {
  return [
    {
      id: "dom-accessible",
      kind: "dom",
      label: "Accessible DOM",
      supportedCameraModes: ["orthographic-2d", "side-scroller"],
    },
    {
      id: "pixi-2d",
      kind: "pixi",
      label: "Pixi 2D and 2.5D",
      supportedCameraModes: [
        "orthographic-2d",
        "isometric-2.5d",
        "side-scroller",
      ],
    },
    {
      id: "three-3d",
      kind: "three",
      label: "Three.js 3D",
      supportedCameraModes: ["perspective-3d", "first-person"],
    },
  ];
}

export function createRendererAdapterRegistry(
  adapters: RendererAdapterDescriptor[],
): RendererAdapterRegistry {
  const registeredAdapters = adapters.map((adapter) => ({
    ...adapter,
    supportedCameraModes: [...adapter.supportedCameraModes],
  }));

  return {
    adapters: registeredAdapters,
    findByCameraMode(cameraMode) {
      return (
        registeredAdapters.find((adapter) =>
          adapter.supportedCameraModes.includes(cameraMode),
        ) ?? null
      );
    },
    getSceneViewport(scene) {
      return { ...scene.viewport };
    },
  };
}
