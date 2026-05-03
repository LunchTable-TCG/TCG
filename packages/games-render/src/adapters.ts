import type { RenderCameraMode } from "./camera";
import type { RenderSceneModel, RenderViewport } from "./scene";

export type RendererAdapterKind = "dom" | "pixi" | "three";

export interface RendererAdapterDescriptor {
  id: string;
  kind: RendererAdapterKind;
  label: string;
  priority: number;
  supportedCameraModes: RenderCameraMode[];
}

export type RendererLayerKind =
  | "accessibility"
  | "cinematics"
  | "hud"
  | "interactions"
  | "world";

export interface RendererPerformanceBudget {
  maxInteractiveObjects: number;
  maxSceneObjects: number;
  targetFrameMs: number;
}

export interface RendererAdapterPlan {
  budget: RendererPerformanceBudget;
  fallbackAdapters: RendererAdapterDescriptor[];
  layers: RendererLayerKind[];
  primaryAdapter: RendererAdapterDescriptor;
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
      priority: 10,
      supportedCameraModes: ["orthographic-2d", "side-scroller"],
    },
    {
      id: "pixi-2d",
      kind: "pixi",
      label: "Pixi 2D and 2.5D",
      priority: 20,
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
      priority: 30,
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

export function createRendererAdapterPlan(
  scene: RenderSceneModel,
  registry: RendererAdapterRegistry,
): RendererAdapterPlan {
  const cameraMode = scene.camera?.mode ?? "orthographic-2d";
  const compatibleAdapters = registry.adapters.filter((adapter) =>
    adapter.supportedCameraModes.includes(cameraMode),
  );
  const primaryAdapter = choosePrimaryAdapter(cameraMode, compatibleAdapters);

  if (primaryAdapter === null) {
    throw new Error(`No renderer adapter supports ${cameraMode}`);
  }

  return {
    budget: createPerformanceBudget(primaryAdapter),
    fallbackAdapters: compatibleAdapters
      .filter((adapter) => adapter.id !== primaryAdapter.id)
      .sort((left, right) => right.priority - left.priority),
    layers: createRendererLayers(scene),
    primaryAdapter,
  };
}

function choosePrimaryAdapter(
  cameraMode: RenderCameraMode,
  adapters: RendererAdapterDescriptor[],
): RendererAdapterDescriptor | null {
  const preferredKind = getPreferredAdapterKind(cameraMode);
  const preferredAdapter =
    adapters.find((adapter) => adapter.kind === preferredKind) ?? null;
  if (preferredAdapter !== null) {
    return preferredAdapter;
  }

  return (
    [...adapters].sort((left, right) => right.priority - left.priority)[0] ??
    null
  );
}

function getPreferredAdapterKind(
  cameraMode: RenderCameraMode,
): RendererAdapterKind {
  if (cameraMode === "first-person" || cameraMode === "perspective-3d") {
    return "three";
  }
  if (cameraMode === "isometric-2.5d" || cameraMode === "side-scroller") {
    return "pixi";
  }
  return "dom";
}

function createRendererLayers(scene: RenderSceneModel): RendererLayerKind[] {
  const layers: RendererLayerKind[] = ["world"];
  if ((scene.interactions?.length ?? 0) > 0) {
    layers.push("interactions");
  }
  if (scene.cue !== null) {
    layers.push("cinematics");
  }
  layers.push("hud", "accessibility");
  return layers;
}

function createPerformanceBudget(
  adapter: RendererAdapterDescriptor,
): RendererPerformanceBudget {
  if (adapter.kind === "three") {
    return {
      maxInteractiveObjects: 200,
      maxSceneObjects: 1200,
      targetFrameMs: 16,
    };
  }
  if (adapter.kind === "pixi") {
    return {
      maxInteractiveObjects: 500,
      maxSceneObjects: 2500,
      targetFrameMs: 16,
    };
  }
  return {
    maxInteractiveObjects: 150,
    maxSceneObjects: 600,
    targetFrameMs: 33,
  };
}
