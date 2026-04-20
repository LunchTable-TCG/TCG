import { Canvas, useFrame } from "@react-three/fiber";
import type { ReactNode } from "react";
import { Component, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Group, Material, Mesh, Object3D, Texture } from "three";

import type {
  MatchCinematicAssetBundle,
  MatchCinematicSceneModel,
} from "./cinematics";

interface LoadedCinematicAsset {
  animations: THREE.AnimationClip[];
  modelOffsetY: number;
  modelRotationY: number;
  modelScale: number;
  scene: Group;
}

class PortalErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
  },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function disposeTexture(texture: Texture | null | undefined) {
  texture?.dispose();
}

function disposeMaterial(material: Material | Material[]) {
  const materials = Array.isArray(material) ? material : [material];

  for (const entry of materials) {
    for (const value of Object.values(entry)) {
      if (value instanceof THREE.Texture) {
        disposeTexture(value);
      }
    }

    entry.dispose();
  }
}

function disposeObject3D(root: Object3D) {
  root.traverse((node) => {
    if ("geometry" in node && node.geometry instanceof THREE.BufferGeometry) {
      node.geometry.dispose();
    }

    if ("material" in node && node.material) {
      disposeMaterial(node.material as Material | Material[]);
    }
  });
}

function useRemoteCinematicAsset(
  assetBundle: MatchCinematicAssetBundle | null,
): LoadedCinematicAsset | null {
  const [asset, setAsset] = useState<LoadedCinematicAsset | null>(null);

  useEffect(() => {
    if (!asset) {
      return;
    }

    return () => {
      disposeObject3D(asset.scene);
    };
  }, [asset]);

  useEffect(() => {
    setAsset(null);

    if (!assetBundle?.modelUrl) {
      return;
    }

    let cancelled = false;
    const loader = new GLTFLoader();
    loader.setCrossOrigin("anonymous");

    loader.load(
      assetBundle.modelUrl,
      (gltf) => {
        if (cancelled) {
          disposeObject3D(gltf.scene);
          return;
        }

        setAsset({
          animations: gltf.animations,
          modelOffsetY: assetBundle.modelOffsetY,
          modelRotationY: assetBundle.modelRotationY,
          modelScale: assetBundle.modelScale,
          scene: gltf.scene,
        });
      },
      undefined,
      (error) => {
        if (!cancelled) {
          console.warn(
            "Failed to load remote cinematic model",
            assetBundle.modelUrl,
            error,
          );
          setAsset(null);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [assetBundle]);

  return asset;
}

function HeroGlyph({ model }: { model: MatchCinematicSceneModel }) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const headRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    const core = coreRef.current;
    const head = headRef.current;
    const halo = haloRef.current;
    const elapsed = clock.elapsedTime;
    const bob = Math.sin(elapsed * 2.6) * model.bobAmplitude;

    if (group) {
      group.position.y = bob;
      group.rotation.y = elapsed * model.idleSpin;
      group.rotation.z = Math.sin(elapsed * 0.9) * 0.08;
    }

    if (core) {
      core.rotation.x = Math.sin(elapsed * 1.4) * 0.08;
      core.rotation.z = Math.cos(elapsed * 1.6) * 0.06;
    }

    if (head) {
      head.position.y = 0.58 + Math.sin(elapsed * 2.2) * 0.03;
    }

    if (halo) {
      halo.rotation.z = elapsed * (model.idleSpin + 0.4);
      halo.scale.setScalar(1 + (Math.sin(elapsed * 2.8) + 1) * 0.04);
    }
  });

  return (
    <group ref={groupRef} scale={model.glyphScale} position={[0, -0.18, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.88, 0]}>
        <torusGeometry args={[0.72, 0.06, 18, 72]} />
        <meshBasicMaterial
          color={model.ringColor}
          opacity={0.68}
          transparent
        />
      </mesh>

      <mesh ref={haloRef} position={[0, 0.16, -0.08]}>
        <torusGeometry args={[0.56, 0.045, 18, 72]} />
        <meshStandardMaterial
          color={model.rimColor}
          emissive={model.rimColor}
          emissiveIntensity={1.4}
          metalness={0.12}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[0, -0.08, -0.22]} rotation={[0.24, 0, 0]}>
        <circleGeometry args={[0.94, 48]} />
        <meshBasicMaterial
          color={model.groundColor}
          opacity={0.34}
          transparent
        />
      </mesh>

      <mesh ref={coreRef} position={[0, 0.02, 0]}>
        <capsuleGeometry args={[0.28, 0.86, 6, 18]} />
        <meshStandardMaterial
          color={model.accentColor}
          emissive={model.accentColor}
          emissiveIntensity={0.9}
          metalness={0.16}
          roughness={0.22}
        />
      </mesh>

      <mesh ref={headRef} position={[0, 0.58, 0.02]}>
        <sphereGeometry args={[0.21, 24, 24]} />
        <meshStandardMaterial
          color={model.auraColor}
          emissive={model.auraColor}
          emissiveIntensity={1.6}
          metalness={0.04}
          roughness={0.16}
        />
      </mesh>

      <mesh position={[-0.4, 0.06, 0]} rotation={[0, 0, 0.52]}>
        <capsuleGeometry args={[0.075, 0.42, 4, 10]} />
        <meshStandardMaterial
          color={model.accentColor}
          emissive={model.accentColor}
          emissiveIntensity={0.7}
          metalness={0.08}
          roughness={0.3}
        />
      </mesh>

      <mesh position={[0.4, 0.06, 0]} rotation={[0, 0, -0.52]}>
        <capsuleGeometry args={[0.075, 0.42, 4, 10]} />
        <meshStandardMaterial
          color={model.accentColor}
          emissive={model.accentColor}
          emissiveIntensity={0.7}
          metalness={0.08}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

function OrbitingShards({ model }: { model: MatchCinematicSceneModel }) {
  const groupRef = useRef<Group>(null);
  const shardRefs = useRef<Array<Mesh | null>>([]);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    const group = groupRef.current;

    if (group) {
      group.rotation.y = elapsed * model.shardSpeed;
      group.rotation.x = Math.sin(elapsed * 0.7) * 0.18;
    }

    shardRefs.current.forEach((mesh, index) => {
      if (!mesh) {
        return;
      }

      const orbit = elapsed * (model.shardSpeed + index * 0.12);
      const radius = 0.9 + index * 0.08;
      mesh.position.x = Math.cos(orbit) * radius;
      mesh.position.z = Math.sin(orbit) * radius * 0.72;
      mesh.position.y = 0.1 + Math.sin(orbit * 1.7) * 0.28;
      mesh.rotation.x += 0.02;
      mesh.rotation.y += 0.03;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: model.shardCount }, (_, index) => (
        <mesh
          key={index}
          ref={(mesh: Mesh | null) => {
            shardRefs.current[index] = mesh;
          }}
          scale={0.11 + index * 0.014}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? model.ringColor : model.rimColor}
            emissive={index % 2 === 0 ? model.ringColor : model.rimColor}
            emissiveIntensity={1.3}
            metalness={0.2}
            roughness={0.12}
          />
        </mesh>
      ))}
    </group>
  );
}

function AuraSheet({ model }: { model: MatchCinematicSceneModel }) {
  const meshRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const elapsed = clock.elapsedTime;
    mesh.rotation.z = elapsed * 0.5;
    mesh.scale.setScalar(1.02 + (Math.sin(elapsed * 2.1) + 1) * 0.08);
  });

  return (
    <mesh ref={meshRef} position={[0, 0.12, -0.48]}>
      <circleGeometry args={[1.08, 48]} />
      <meshBasicMaterial
        color={model.auraColor}
        opacity={0.2}
        transparent
      />
    </mesh>
  );
}

function RemoteAssetRig({
  asset,
  model,
}: {
  asset: LoadedCinematicAsset;
  model: MatchCinematicSceneModel;
}) {
  const groupRef = useRef<Group>(null);
  const root = useMemo(() => clone(asset.scene) as Group, [asset.scene]);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    root.traverse((node) => {
      node.frustumCulled = false;
    });
  }, [root]);

  useEffect(() => {
    if (asset.animations.length === 0) {
      return;
    }

    const mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(asset.animations[0]);
    action.reset();
    action.play();
    mixerRef.current = mixer;

    return () => {
      action.stop();
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      mixerRef.current = null;
    };
  }, [asset.animations, root]);

  useFrame(({ clock }, delta) => {
    mixerRef.current?.update(delta);

    const group = groupRef.current;
    if (!group) {
      return;
    }

    const elapsed = clock.elapsedTime;
    group.position.y =
      asset.modelOffsetY + Math.sin(elapsed * 2.2) * model.bobAmplitude * 0.32;
    group.rotation.y = asset.modelRotationY + Math.sin(elapsed * 0.7) * 0.12;
    group.rotation.z = Math.sin(elapsed * 1.1) * 0.02;
  });

  return (
    <group ref={groupRef} scale={asset.modelScale}>
      <primitive object={root} />
    </group>
  );
}

function CinematicScene({
  assetBundle,
  model,
}: {
  assetBundle: MatchCinematicAssetBundle | null;
  model: MatchCinematicSceneModel;
}) {
  const remoteAsset = useRemoteCinematicAsset(assetBundle);

  return (
    <>
      <ambientLight intensity={0.9} />
      <hemisphereLight
        args={["#fff4d6", "#0f1a29", 1.4]}
        position={[0, 1, 0]}
      />
      <pointLight color="#ffd8a1" intensity={18} position={[0, 1.6, 2.4]} />
      <pointLight color="#7ed9ff" intensity={12} position={[-1.8, 0.6, 1.2]} />
      <AuraSheet model={model} />
      {remoteAsset ? (
        <RemoteAssetRig asset={remoteAsset} model={model} />
      ) : (
        <HeroGlyph model={model} />
      )}
      <OrbitingShards model={model} />
    </>
  );
}

export function MatchCinematicPortal({
  assetBundle,
  sceneModel,
}: {
  assetBundle: MatchCinematicAssetBundle | null;
  sceneModel: MatchCinematicSceneModel;
}) {
  return (
    <PortalErrorBoundary
      fallback={<div className="board-summon-fallback-glyph" />}
    >
      <Canvas
        camera={{ fov: 28, position: [0, 0.2, 5.1] }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#000000"), 0);
        }}
      >
        <CinematicScene assetBundle={assetBundle} model={sceneModel} />
      </Canvas>
    </PortalErrorBoundary>
  );
}
