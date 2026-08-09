"use client";

import { RoundedBox, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
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
  openStrength: number;
  drift: number;
};

const PLANET_RADIUS = 1.66;
const CYCLE_SECONDS = 16;

function seeded(seed: number) {
  const value = Math.sin(seed * 91.731 + 17.193) * 43758.5453;
  return value - Math.floor(value);
}

function ease(value: number) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function openingAt(phase: number) {
  if (phase < 0.57) return 0;
  if (phase < 0.7) return ease((phase - 0.57) / 0.13);
  if (phase < 0.86) return 1;
  return 1 - ease((phase - 0.86) / 0.14);
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
      const openStrength = THREE.MathUtils.clamp((ring.latitude + 12) / 88, 0, 1);
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
        openStrength,
        drift: seeded(serial + 54) - 0.5,
      });
      serial += 1;
    }
  }
  return tiles;
}

function planetRoute(compact: boolean) {
  return new THREE.CatmullRomCurve3(compact ? [
    new THREE.Vector3(-1.35, -1.2, 2.04),
    new THREE.Vector3(-0.78, -1, 2.08),
    new THREE.Vector3(-0.05, -0.85, 2.1),
    new THREE.Vector3(0.7, -1, 2.08),
    new THREE.Vector3(1.34, -1.2, 2.04),
  ] : [
    new THREE.Vector3(-1.35, 0.98, 1.2),
    new THREE.Vector3(-0.78, 1.39, 1.04),
    new THREE.Vector3(-0.05, 1.56, 0.93),
    new THREE.Vector3(0.7, 1.38, 1.05),
    new THREE.Vector3(1.34, 0.93, 1.2),
  ]);
}

function Explorer({ route, reducedMotion }: { route: THREE.CatmullRomCurve3; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const point = useRef(new THREE.Vector3());
  const tangent = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    if (!group.current) return;
    const phase = reducedMotion ? 0.34 : (clock.elapsedTime % CYCLE_SECONDS) / CYCLE_SECONDS;
    const routeProgress = THREE.MathUtils.clamp(phase / 0.55, 0, 1);
    route.getPointAt(routeProgress, point.current);
    route.getTangentAt(routeProgress, tangent.current);
    const stride = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 10.5);
    point.current.y += Math.abs(stride) * 0.025;
    group.current.position.copy(point.current);
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      -Math.atan2(tangent.current.x, tangent.current.y) * 0.24,
      0.1,
    );
    const visibleScale = phase < 0.58
      ? 1
      : phase < 0.64
        ? 1 - ease((phase - 0.58) / 0.06)
        : 0;
    group.current.scale.setScalar(visibleScale * 1.18);
    if (body.current) body.current.rotation.y = Math.sin(clock.elapsedTime * 2.1) * 0.04;
    if (leftArm.current) leftArm.current.rotation.z = stride * 0.66;
    if (rightArm.current) rightArm.current.rotation.z = -stride * 0.66;
    if (leftLeg.current) leftLeg.current.rotation.z = -stride * 0.52;
    if (rightLeg.current) rightLeg.current.rotation.z = stride * 0.52;
  });

  return (
    <group ref={group} renderOrder={8}>
      <mesh position={[0, -0.28, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.19, 24]} />
        <meshBasicMaterial color="#102c37" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <group ref={body}>
        <mesh position={[0, 0.34, 0.015]} castShadow>
          <capsuleGeometry args={[0.105, 0.2, 8, 16]} />
          <meshPhysicalMaterial color="#ef5560" roughness={0.42} clearcoat={0.35} />
        </mesh>
        <mesh position={[0, 0.36, 0.11]} scale={[0.7, 0.64, 0.25]}>
          <sphereGeometry args={[0.1, 20, 12]} />
          <meshStandardMaterial color="#fff4e9" roughness={0.6} />
        </mesh>
        <RoundedBox args={[0.19, 0.25, 0.1]} radius={0.035} smoothness={3} position={[0, 0.35, -0.11]} castShadow>
          <meshStandardMaterial color="#243b4a" roughness={0.54} />
        </RoundedBox>
        <mesh position={[0, 0.67, 0.015]} castShadow>
          <sphereGeometry args={[0.132, 28, 20]} />
          <meshPhysicalMaterial color="#ffd2b3" roughness={0.56} clearcoat={0.12} />
        </mesh>
        <mesh position={[0, 0.72, -0.015]} scale={[1.04, 0.62, 1.02]} castShadow>
          <sphereGeometry args={[0.134, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.68]} />
          <meshStandardMaterial color="#1f3039" roughness={0.72} />
        </mesh>
        {[
          [-0.095, 0.735, 0.025],
          [-0.052, 0.78, 0.018],
          [0, 0.795, 0.012],
          [0.055, 0.778, 0.018],
          [0.098, 0.735, 0.026],
        ].map((position, index) => (
          <mesh key={`hair-${index}`} position={position as [number, number, number]} castShadow>
            <sphereGeometry args={[0.052, 14, 10]} />
            <meshStandardMaterial color={index % 2 ? "#253944" : "#192a32"} roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[-0.132, 0.665, 0.015]}>
          <sphereGeometry args={[0.025, 14, 10]} />
          <meshStandardMaterial color="#f5b995" roughness={0.62} />
        </mesh>
        <mesh position={[0.132, 0.665, 0.015]}>
          <sphereGeometry args={[0.025, 14, 10]} />
          <meshStandardMaterial color="#f5b995" roughness={0.62} />
        </mesh>
        <mesh position={[-0.043, 0.685, 0.124]}>
          <sphereGeometry args={[0.012, 12, 8]} />
          <meshBasicMaterial color="#25323a" />
        </mesh>
        <mesh position={[0.043, 0.685, 0.124]}>
          <sphereGeometry args={[0.012, 12, 8]} />
          <meshBasicMaterial color="#25323a" />
        </mesh>
        <mesh position={[0, 0.635, 0.13]} scale={[1, 0.32, 0.35]}>
          <sphereGeometry args={[0.03, 16, 8]} />
          <meshBasicMaterial color="#b85b61" />
        </mesh>
        <mesh position={[0, 0.49, 0.105]} rotation={[0.08, 0, 0]}>
          <torusGeometry args={[0.075, 0.018, 10, 24, Math.PI]} />
          <meshStandardMaterial color="#fff2e6" roughness={0.52} />
        </mesh>
        <mesh position={[0, 0.36, 0.123]}>
          <boxGeometry args={[0.012, 0.2, 0.008]} />
          <meshStandardMaterial color="#c83e4a" roughness={0.5} />
        </mesh>
        <mesh position={[-0.064, 0.3, 0.128]}>
          <sphereGeometry args={[0.012, 12, 8]} />
          <meshStandardMaterial color="#fff5e9" roughness={0.45} />
        </mesh>
        <mesh position={[0.064, 0.3, 0.128]}>
          <sphereGeometry args={[0.012, 12, 8]} />
          <meshStandardMaterial color="#fff5e9" roughness={0.45} />
        </mesh>

        <group ref={leftArm} position={[-0.145, 0.46, 0]}>
          <mesh position={[0, -0.11, 0]} castShadow>
            <capsuleGeometry args={[0.035, 0.17, 6, 12]} />
            <meshStandardMaterial color="#ef5560" roughness={0.48} />
          </mesh>
          <mesh position={[0, -0.235, 0.01]}>
            <sphereGeometry args={[0.045, 16, 10]} />
            <meshStandardMaterial color="#ffd2b3" roughness={0.6} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.145, 0.46, 0]}>
          <mesh position={[0, -0.11, 0]} castShadow>
            <capsuleGeometry args={[0.035, 0.17, 6, 12]} />
            <meshStandardMaterial color="#ef5560" roughness={0.48} />
          </mesh>
          <mesh position={[0, -0.235, 0.01]}>
            <sphereGeometry args={[0.045, 16, 10]} />
            <meshStandardMaterial color="#ffd2b3" roughness={0.6} />
          </mesh>
        </group>
        <group ref={leftLeg} position={[-0.064, 0.2, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <capsuleGeometry args={[0.047, 0.23, 7, 12]} />
            <meshStandardMaterial color="#233946" roughness={0.62} />
          </mesh>
          <RoundedBox args={[0.105, 0.065, 0.17]} radius={0.025} smoothness={3} position={[0, -0.31, 0.045]} castShadow>
            <meshStandardMaterial color="#121b22" roughness={0.75} />
          </RoundedBox>
        </group>
        <group ref={rightLeg} position={[0.064, 0.2, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <capsuleGeometry args={[0.047, 0.23, 7, 12]} />
            <meshStandardMaterial color="#233946" roughness={0.62} />
          </mesh>
          <RoundedBox args={[0.105, 0.065, 0.17]} radius={0.025} smoothness={3} position={[0, -0.31, 0.045]} castShadow>
            <meshStandardMaterial color="#121b22" roughness={0.75} />
          </RoundedBox>
        </group>
      </group>
    </group>
  );
}

function PlanetSystem({ dark, reducedMotion }: { dark: boolean; reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null);
  const innerMaterial = useRef<THREE.MeshPhysicalMaterial>(null);
  const coreLight = useRef<THREE.PointLight>(null);
  const tileRefs = useRef<Array<THREE.Mesh | null>>([]);
  const tiles = useMemo(() => buildTiles(), []);
  const coreColors = useMemo(() => ({
    closed: new THREE.Color(dark ? "#112f3d" : "#225b69"),
    open: new THREE.Color(dark ? "#8d2d45" : "#f16470"),
  }), [dark]);
  const { pointer, size } = useThree();
  const compact = size.width < 680;
  const route = useMemo(() => planetRoute(compact), [compact]);
  const routeGeometry = useMemo(() => new THREE.TubeGeometry(route, 80, 0.025, 8, false), [route]);

  useFrame(({ clock }) => {
    const elapsed = reducedMotion ? CYCLE_SECONDS * 0.78 : clock.elapsedTime;
    const phase = (elapsed % CYCLE_SECONDS) / CYCLE_SECONDS;
    const opening = reducedMotion ? 0.82 : openingAt(phase);
    if (root.current) {
      root.current.rotation.y = THREE.MathUtils.lerp(
        root.current.rotation.y,
        -0.12 + pointer.x * 0.09 + Math.sin(elapsed * 0.2) * 0.025,
        0.045,
      );
      root.current.rotation.x = THREE.MathUtils.lerp(
        root.current.rotation.x,
        pointer.y * -0.035,
        0.045,
      );
    }
    if (innerMaterial.current) {
      innerMaterial.current.emissiveIntensity = THREE.MathUtils.lerp(
        innerMaterial.current.emissiveIntensity,
        opening * 2.9,
        0.08,
      );
      innerMaterial.current.color.lerpColors(coreColors.closed, coreColors.open, opening);
      innerMaterial.current.opacity = 0.42 + opening * 0.5;
    }
    if (coreLight.current) coreLight.current.intensity = opening * 6.5;

    tiles.forEach((tile, index) => {
      const mesh = tileRefs.current[index];
      if (!mesh) return;
      const lift = opening * tile.openStrength;
      const outward = 0.025 + lift * (0.09 + tile.openStrength * 0.13);
      const rise = lift * (0.12 + tile.openStrength * 0.4);
      const sideways = lift * tile.drift * 0.2;
      mesh.position.copy(tile.position)
        .addScaledVector(tile.radial, outward)
        .addScaledVector(tile.tangent, sideways);
      mesh.position.y += rise;
      mesh.quaternion.copy(tile.quaternion).slerp(tile.openQuaternion, lift * 0.78);
    });
  });

  const ocean = dark ? ["#2d7888", "#398b99", "#4a9eaa"] : ["#2f8290", "#3b92a0", "#52a6ac"];
  const land = dark ? ["#8caf78", "#9cbe87", "#b0cd99"] : ["#a8ca8b", "#bad99c", "#cbe3aa"];

  return (
    <group position={[0, compact ? 1.45 : 0.28, 0]} scale={compact ? 0.72 : 0.84}>
      <group ref={root}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1.34, 64, 48]} />
          <meshPhysicalMaterial
            ref={innerMaterial}
            color={dark ? "#112f3d" : "#225b69"}
            emissive="#ef5560"
            emissiveIntensity={0}
            roughness={0.3}
            metalness={0.08}
            clearcoat={0.38}
            transparent
            opacity={0.42}
          />
        </mesh>
        <pointLight ref={coreLight} color="#ff6d75" intensity={0} distance={7} decay={1.6} />
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
        <mesh geometry={routeGeometry}>
          <meshBasicMaterial color="#ff737d" transparent opacity={0.9} toneMapped={false} />
        </mesh>
        <Explorer route={route} reducedMotion={reducedMotion} />
      </group>
      <mesh position={[0, -1.82, -0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.25, 64]} />
        <shadowMaterial color={dark ? "#000000" : "#24363d"} transparent opacity={dark ? 0.42 : 0.18} />
      </mesh>
      <mesh rotation={[Math.PI / 2.55, 0.12, 0]}>
        <torusGeometry args={[2.15, 0.011, 6, 160]} />
        <meshBasicMaterial color="#ef5560" transparent opacity={0.38} toneMapped={false} />
      </mesh>
      <Sparkles count={compact ? 34 : 62} scale={[5.3, 4.2, 3.2]} size={compact ? 2.2 : 2.8} speed={0.28} color="#ef6570" opacity={0.62} />
    </group>
  );
}

export function CareerPlanetScene({
  dark,
  reducedMotion,
}: {
  dark: boolean;
  reducedMotion: boolean;
}) {
  return (
    <Canvas
      className="career-webgl-canvas"
      camera={{ position: [0, 0.3, 12.2], fov: 34, near: 0.1, far: 40 }}
      dpr={[1, 1.65]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = dark ? 1.08 : 1.16;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ambientLight intensity={dark ? 0.8 : 1.25} color={dark ? "#bcd5ff" : "#e7f4ff"} />
      <hemisphereLight args={[dark ? "#7899c8" : "#fff8ee", dark ? "#121722" : "#cfb9ae", dark ? 1.3 : 1.65]} />
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
      <PlanetSystem dark={dark} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
