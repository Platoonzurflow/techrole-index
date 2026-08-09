"use client";

import { RoundedBox, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type TileData = {
  id: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  openQuaternion: THREE.Quaternion;
  radial: THREE.Vector3;
  tangent: THREE.Vector3;
  size: [number, number, number];
  land: boolean;
  shade: number;
  drift: number;
};

type TileMotion = {
  offset: THREE.Vector3;
  velocity: THREE.Vector3;
  target: THREE.Vector3;
  rotation: number;
  rotationVelocity: number;
  scale: number;
};

const PLANET_RADIUS = 1.66;

function seeded(seed: number) {
  const value = Math.sin(seed * 91.731 + 17.193) * 43758.5453;
  return value - Math.floor(value);
}

function ease(value: number) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function buildTiles(): TileData[] {
  const rings = [
    { latitude: -68, count: 6 },
    { latitude: -48, count: 10 },
    { latitude: -27, count: 13 },
    { latitude: -6, count: 15 },
    { latitude: 16, count: 14 },
    { latitude: 38, count: 12 },
    { latitude: 59, count: 9 },
    { latitude: 76, count: 5 },
  ];
  const tiles: TileData[] = [];
  let serial = 0;

  for (const ring of rings) {
    const latitude = THREE.MathUtils.degToRad(ring.latitude);
    const ringRadius = Math.cos(latitude) * PLANET_RADIUS;
    const tileHeight = PLANET_RADIUS * THREE.MathUtils.degToRad(20.5);
    const tileWidth = (Math.PI * 2 * ringRadius / ring.count) * 0.94;
    for (let index = 0; index < ring.count; index += 1) {
      const longitude = (index / ring.count) * Math.PI * 2
        + (Math.abs(ring.latitude) % 3) * 0.17
        + (ring.count % 2 ? 0.12 : 0);
      const radial = new THREE.Vector3(
        Math.cos(latitude) * Math.sin(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.cos(longitude),
      ).normalize();
      const position = radial.clone().multiplyScalar(PLANET_RADIUS);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        radial,
      );
      const variation = seeded(serial + 4);
      const openRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (seeded(serial + 14) - 0.5) * 0.42,
        (seeded(serial + 24) - 0.5) * 0.48,
        (seeded(serial + 34) - 0.5) * 0.34,
      ));
      const openQuaternion = quaternion.clone().multiply(openRotation);
      const tangent = new THREE.Vector3(Math.cos(longitude), 0, -Math.sin(longitude));
      const continentSignal = (
        Math.sin(longitude * 2.15 + latitude * 1.7)
        + Math.cos(longitude * 1.1 - latitude * 3.4)
        + Math.sin(longitude * 4.2 + latitude * 2.3) * 0.42
      );
      tiles.push({
        id: `${ring.latitude}-${index}`,
        position,
        quaternion,
        openQuaternion,
        radial,
        tangent,
        size: [
          tileWidth * (0.92 + variation * 0.12),
          tileHeight * (0.93 + seeded(serial + 7) * 0.1),
          0.24,
        ],
        land: continentSignal > 0.72 || (continentSignal > 0.25 && radial.z > 0.7),
        shade: seeded(serial + 44),
        drift: seeded(serial + 54) - 0.5,
      });
      serial += 1;
    }
  }
  return tiles;
}

function PlanetSystem({
  dark,
  pointerPosition,
  pointerActive,
  reducedMotion,
  onInteractionChange,
}: {
  dark: boolean;
  pointerPosition: RefObject<THREE.Vector2>;
  pointerActive: boolean;
  reducedMotion: boolean;
  onInteractionChange?: (interacting: boolean) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const innerMaterial = useRef<THREE.MeshPhysicalMaterial>(null);
  const coreLight = useRef<THREE.PointLight>(null);
  const tileRefs = useRef<Array<THREE.Mesh | null>>([]);
  const tiles = useMemo(() => buildTiles(), []);
  const tileMotions = useMemo<TileMotion[]>(() => tiles.map(() => ({
    offset: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    target: new THREE.Vector3(),
    rotation: 0,
    rotationVelocity: 0,
    scale: 1,
  })), [tiles]);
  const worldCenter = useRef(new THREE.Vector3());
  const worldScale = useRef(new THREE.Vector3());
  const worldSphere = useRef(new THREE.Sphere());
  const worldHit = useRef(new THREE.Vector3());
  const localHit = useRef(new THREE.Vector3());
  const hitDirection = useRef(new THREE.Vector3());
  const surfaceAway = useRef(new THREE.Vector3());
  const acceleration = useRef(new THREE.Vector3());
  const lastInteraction = useRef(false);
  const coreColors = useMemo(() => ({
    closed: new THREE.Color(dark ? "#17161d" : "#6f2732"),
    open: new THREE.Color(dark ? "#ff5462" : "#ff7580"),
  }), [dark]);
  const { size } = useThree();
  const compact = size.width < 680;

  useEffect(() => () => onInteractionChange?.(false), [onInteractionChange]);

  useFrame(({ camera, clock, raycaster }, frameDelta) => {
    const elapsed = reducedMotion ? 0 : clock.elapsedTime;
    const delta = Math.min(frameDelta, 1 / 30);
    let maxImpact = 0;
    let hasPointerHit = false;

    if (root.current) {
      root.current.rotation.y = THREE.MathUtils.lerp(
        root.current.rotation.y,
        -0.12 + pointerPosition.current.x * 0.09 + Math.sin(elapsed * 0.2) * 0.025,
        0.045,
      );
      root.current.rotation.x = THREE.MathUtils.lerp(
        root.current.rotation.x,
        pointerPosition.current.y * -0.035,
        0.045,
      );
      root.current.updateWorldMatrix(true, false);

      if (pointerActive) {
        root.current.getWorldPosition(worldCenter.current);
        root.current.getWorldScale(worldScale.current);
        worldSphere.current.set(
          worldCenter.current,
          PLANET_RADIUS * Math.max(worldScale.current.x, worldScale.current.y, worldScale.current.z) * 1.05,
        );
        raycaster.setFromCamera(pointerPosition.current, camera);
        hasPointerHit = Boolean(raycaster.ray.intersectSphere(worldSphere.current, worldHit.current));
        if (hasPointerHit) {
          localHit.current.copy(worldHit.current);
          root.current.worldToLocal(localHit.current);
          hitDirection.current.copy(localHit.current).normalize();
        }
      }
    }

    tiles.forEach((tile, index) => {
      const mesh = tileRefs.current[index];
      if (!mesh) return;
      const motion = tileMotions[index];
      motion.target.set(0, 0, 0);
      let impact = 0;

      if (hasPointerHit) {
        const chordDistance = tile.radial.distanceTo(hitDirection.current);
        const proximity = THREE.MathUtils.clamp(1 - chordDistance / 1.18, 0, 1);
        impact = ease(proximity) * (reducedMotion ? 0.28 : 1);
        maxImpact = Math.max(maxImpact, impact);

        if (impact > 0) {
          const alignment = tile.radial.dot(hitDirection.current);
          surfaceAway.current.copy(tile.radial)
            .addScaledVector(hitDirection.current, -alignment);
          if (surfaceAway.current.lengthSq() < 0.0001) {
            surfaceAway.current.copy(tile.tangent);
          } else {
            surfaceAway.current.normalize();
          }

          const outward = impact * (0.3 + tile.shade * 0.34);
          const sideways = impact * (0.56 + (1 - tile.shade) * 0.42);
          motion.target
            .addScaledVector(tile.radial, outward)
            .addScaledVector(surfaceAway.current, sideways)
            .addScaledVector(tile.tangent, tile.drift * impact * 0.24);
        }
      }

      const spring = reducedMotion ? 54 : (impact > 0 ? 66 : 46);
      const damping = reducedMotion ? 15 : (impact > 0 ? 10.5 : 7.4);
      acceleration.current.copy(motion.target).sub(motion.offset).multiplyScalar(spring);
      motion.velocity.addScaledVector(acceleration.current, delta);
      motion.velocity.multiplyScalar(Math.exp(-damping * delta));
      motion.offset.addScaledVector(motion.velocity, delta);

      const rotationTarget = impact * (0.72 + tile.shade * 0.38);
      motion.rotationVelocity += (rotationTarget - motion.rotation) * spring * delta;
      motion.rotationVelocity *= Math.exp(-damping * delta);
      motion.rotation += motion.rotationVelocity * delta;
      motion.scale = THREE.MathUtils.damp(motion.scale, 1 + impact * 0.035, impact > 0 ? 14 : 7, delta);

      mesh.position.copy(tile.position).add(motion.offset);
      mesh.quaternion.copy(tile.quaternion).slerp(tile.openQuaternion, motion.rotation);
      mesh.scale.setScalar(motion.scale);
    });

    const interacting = hasPointerHit && maxImpact > 0.44;
    if (interacting !== lastInteraction.current) {
      lastInteraction.current = interacting;
      onInteractionChange?.(interacting);
    }
    if (innerMaterial.current) {
      innerMaterial.current.emissiveIntensity = THREE.MathUtils.damp(
        innerMaterial.current.emissiveIntensity,
        maxImpact * 3.4,
        maxImpact > 0 ? 9 : 4.5,
        delta,
      );
      innerMaterial.current.color.lerpColors(coreColors.closed, coreColors.open, maxImpact);
      innerMaterial.current.opacity = THREE.MathUtils.damp(
        innerMaterial.current.opacity,
        0.42 + maxImpact * 0.5,
        8,
        delta,
      );
    }
    if (coreLight.current) {
      coreLight.current.intensity = THREE.MathUtils.damp(
        coreLight.current.intensity,
        maxImpact * 7.2,
        8,
        delta,
      );
    }
  });

  const ocean = dark
    ? ["#171820", "#22242d", "#30323d"]
    : ["#442e35", "#5a3941", "#71434c"];
  const land = dark
    ? ["#8f2f3e", "#bd3e4c", "#ed5964"]
    : ["#c9414e", "#e24e5a", "#fb6c76"];

  return (
    <group position={[0, compact ? 1.45 : 0.28, 0]} scale={compact ? 0.72 : 0.84}>
      <group ref={root}>
        <mesh castShadow receiveShadow>
          <icosahedronGeometry args={[1.34, 5]} />
          <meshPhysicalMaterial
            ref={innerMaterial}
            color={dark ? "#17161d" : "#6f2732"}
            emissive={dark ? "#ff4554" : "#ff6875"}
            emissiveIntensity={0}
            roughness={0.24}
            metalness={0.18}
            clearcoat={0.58}
            clearcoatRoughness={0.18}
            transparent
            opacity={0.48}
          />
        </mesh>
        <mesh scale={0.82}>
          <icosahedronGeometry args={[1.34, 3]} />
          <meshPhysicalMaterial
            color={dark ? "#43141f" : "#8b2330"}
            emissive={dark ? "#ff5260" : "#ff7780"}
            emissiveIntensity={dark ? 0.42 : 0.28}
            roughness={0.2}
            metalness={0.22}
            clearcoat={0.7}
            transparent
            opacity={0.68}
          />
        </mesh>
        <pointLight ref={coreLight} color={dark ? "#ff5361" : "#ff7b84"} intensity={0} distance={7} decay={1.6} />
        {tiles.map((tile, index) => {
          const palette = tile.land ? land : ocean;
          const color = palette[Math.min(palette.length - 1, Math.floor(tile.shade * palette.length))];
          return (
            <RoundedBox
              key={tile.id}
              ref={(node) => { tileRefs.current[index] = node; }}
              args={tile.size}
              radius={0.068}
              smoothness={3}
              position={tile.position}
              quaternion={tile.quaternion}
              castShadow={tile.radial.z > -0.25}
              receiveShadow
            >
              <meshPhysicalMaterial
                color={color}
                emissive={dark ? color : "#000000"}
                emissiveIntensity={dark ? 0.2 : 0}
                roughness={0.46 + tile.shade * 0.16}
                metalness={0.025}
                clearcoat={0.22}
                clearcoatRoughness={0.4}
              />
            </RoundedBox>
          );
        })}
      </group>
      <mesh position={[0, -1.82, -0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.25, 64]} />
        <shadowMaterial color={dark ? "#000000" : "#24363d"} transparent opacity={dark ? 0.42 : 0.18} />
      </mesh>
      <Sparkles
        count={compact ? 28 : 50}
        scale={[5.1, 4, 3.1]}
        size={compact ? 1.8 : 2.35}
        speed={0.22}
        color={dark ? "#ff7b85" : "#8f3440"}
        opacity={dark ? 0.54 : 0.36}
      />
    </group>
  );
}

export function CareerPlanetScene({
  dark,
  reducedMotion,
  onInteractionChange,
}: {
  dark: boolean;
  reducedMotion: boolean;
  onInteractionChange?: (interacting: boolean) => void;
}) {
  const [pointerActive, setPointerActive] = useState(false);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const pointerPosition = useRef(new THREE.Vector2());
  const touchReleaseTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const updatePointer = (event: MouseEvent | PointerEvent) => {
      const rect = canvasElement.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      pointerPosition.current.set(
        (localX / rect.width) * 2 - 1,
        -((localY / rect.height) * 2 - 1),
      );
      const distance = Math.hypot(localX - rect.width / 2, localY - rect.height / 2);
      const interactionRadius = Math.min(rect.width, rect.height) * (rect.width < 680 ? 0.34 : 0.32);
      const inside = localX >= 0
        && localY >= 0
        && localX <= rect.width
        && localY <= rect.height
        && distance <= interactionRadius;
      if (inside && touchReleaseTimer.current !== undefined) {
        window.clearTimeout(touchReleaseTimer.current);
        touchReleaseTimer.current = undefined;
      }
      setPointerActive(inside);
    };
    const releasePointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        touchReleaseTimer.current = window.setTimeout(() => setPointerActive(false), 900);
      }
    };
    const leaveWindow = (event: PointerEvent) => {
      if (event.relatedTarget === null) setPointerActive(false);
    };
    const blurWindow = () => setPointerActive(false);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerdown", updatePointer, { passive: true });
    window.addEventListener("pointerup", releasePointer, { passive: true });
    window.addEventListener("pointerout", leaveWindow, { passive: true });
    window.addEventListener("blur", blurWindow);
    return () => {
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerdown", updatePointer);
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointerout", leaveWindow);
      window.removeEventListener("blur", blurWindow);
      if (touchReleaseTimer.current !== undefined) window.clearTimeout(touchReleaseTimer.current);
    };
  }, []);

  return (
    <>
      <span
        className="career-webgl-state"
        data-pointer-active={pointerActive ? "true" : "false"}
        aria-hidden="true"
      />
      <Canvas
        ref={canvasElement}
        className="career-webgl-canvas"
        camera={{ position: [0, 0.3, 12.2], fov: 34, near: 0.1, far: 40 }}
        dpr={[1, 1.65]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        shadows={{ type: THREE.PCFShadowMap }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = dark ? 1.08 : 1.16;
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={dark ? 0.72 : 1.2} color={dark ? "#ffdce1" : "#fff0e7"} />
        <hemisphereLight args={[dark ? "#a77c89" : "#fff6ed", dark ? "#111118" : "#bea5a6", dark ? 1.25 : 1.6]} />
        <directionalLight
          position={[-4, 6, 5]}
          color="#fff5e8"
          intensity={dark ? 2.3 : 3.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={14}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
        />
        <directionalLight position={[4, 1.5, 3]} color="#ef7180" intensity={dark ? 1.3 : 0.85} />
        <PlanetSystem
          dark={dark}
          pointerPosition={pointerPosition}
          pointerActive={pointerActive}
          reducedMotion={reducedMotion}
          onInteractionChange={onInteractionChange}
        />
      </Canvas>
    </>
  );
}
