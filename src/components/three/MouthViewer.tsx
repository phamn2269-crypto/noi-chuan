// Khung 3D: camera theo 3 chế độ xem, OrbitControls giới hạn góc, ánh sáng studio dịu, luồng hơi, nhãn.
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { phonemes } from "@/lib/content";
import { hasRealModel } from "@/lib/device";
import { VocalTract, type TractState, type ViewMode } from "./VocalTract";
import { GlbTract } from "./GlbTract";
import { Airflow } from "./Airflow";
import { LabelOverlay, LabelProjector, labelNames } from "./Labels";
import type { MouthDriver } from "./driver";

const PRESETS: Record<ViewMode, { pos: [number, number, number]; target: [number, number, number]; az: [number, number] }> = {
  side: { pos: [0.9, -0.2, 17.5], target: [0.9, -0.4, 0], az: [-0.95, 0.95] },
  front: { pos: [15, 0.8, 0], target: [3.2, 0.0, 0], az: [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9] },
  xray: { pos: [10, 3.6, 13], target: [0.8, -0.2, 0], az: [-0.4, 1.9] },
};

function CameraRig({ view, compact }: { view: ViewMode; compact?: boolean }) {
  const { camera, gl, size } = useThree();
  const controls = useRef<OrbitImpl>(null);
  const anim = useRef(1);
  const from = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3() });

  useEffect(() => {
    from.current.pos.copy(camera.position);
    from.current.target.copy(controls.current?.target ?? new THREE.Vector3());
    anim.current = 0;
    if (controls.current) {
      controls.current.minAzimuthAngle = -Infinity;
      controls.current.maxAzimuthAngle = Infinity;
    }
  }, [view, camera, gl]);

  // màn hình hẹp → lùi camera ra để vừa khung
  const distScale = size.width < 420 ? 1.25 : compact ? 1.15 : 1;

  useFrame((_, dt) => {
    if (anim.current >= 1 || !controls.current) return;
    anim.current = Math.min(1, anim.current + dt * 1.8);
    const e = 1 - Math.pow(1 - anim.current, 3);
    const p = PRESETS[view];
    const tgt = new THREE.Vector3(...p.target);
    const pos = new THREE.Vector3(...p.pos).sub(tgt).multiplyScalar(distScale).add(tgt);
    camera.position.lerpVectors(from.current.pos, pos, e);
    controls.current.target.lerpVectors(from.current.target, tgt, e);
    controls.current.update();
    if (anim.current >= 1) {
      controls.current.minAzimuthAngle = p.az[0];
      controls.current.maxAzimuthAngle = p.az[1];
    }
  });

  return (
    <OrbitControls
      ref={controls as never}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={6}
      maxDistance={24}
      minPolarAngle={Math.PI * 0.25}
      maxPolarAngle={Math.PI * 0.72}
      rotateSpeed={0.7}
    />
  );
}

function FpsWatch({ onLow }: { onLow?: () => void }) {
  const acc = useRef({ t: 0, frames: 0, bad: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.t += dt;
    a.frames++;
    if (a.t >= 2) {
      const fps = a.frames / a.t;
      a.bad = fps < 18 ? a.bad + 1 : 0;
      a.t = 0;
      a.frames = 0;
      if (a.bad >= 3) onLow?.();
    }
  });
  return null;
}

export interface MouthViewerProps {
  driver: MouthDriver;
  view?: ViewMode;
  airflow?: boolean;
  labels?: "focus" | "all" | "none";
  /** Âm cần làm nổi bật (mặc định: âm hiện tại của driver). */
  focus?: string;
  compact?: boolean;
  className?: string;
  onLowPerformance?: () => void;
}

export default function MouthViewer({ driver, view = "side", airflow = true, labels = "focus", focus, compact, className, onLowPerformance }: MouthViewerProps) {
  const stateRef = useRef<TractState | null>(null);
  const [dpr, setDpr] = useState(1.5);
  const [realModel, setRealModel] = useState(false);
  useEffect(() => {
    hasRealModel().then(setRealModel);
  }, []);
  const staticPose = useSyncExternalStore(
    (cb) => driver.subscribe(cb),
    () => driver.staticPose,
  );
  const focusPose = focus ?? staticPose;
  const highlight = useMemo(() => phonemes[focusPose]?.highlight ?? [], [focusPose]);
  const labelEls = useRef<Record<string, HTMLDivElement | null>>({});
  const names = labels === "none" || realModel ? [] : labelNames(highlight, labels === "all");
  const offset = useMemo(() => new THREE.Vector3(-0.6, 0, 0), []);

  return (
    <div
      className={"relative overflow-hidden " + (className ?? "")}
      style={{ background: "radial-gradient(120% 90% at 50% 20%, #2b2f55 0%, #171a33 55%, #0d0f1f 100%)" }}
    >
      <Canvas
        dpr={dpr}
        camera={{ position: PRESETS[view].pos, fov: 32, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, localClippingEnabled: true, powerPreference: "high-performance" } as never}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />
        <FpsWatch onLow={onLowPerformance} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[6, 8, 10]} intensity={1.4} color="#fff4ea" />
        <directionalLight position={[-8, 3, -4]} intensity={0.6} color="#b8c8ff" />
        <pointLight position={[3, 0.5, 4]} intensity={6} distance={12} color="#ffd9d0" />
        {/* Môi trường phản chiếu dựng tại chỗ (không cần tải HDR – chạy được khi offline) */}
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={2.2} position={[0, 5, 6]} scale={[10, 4, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={1.1} position={[-6, 1, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#ffe8e0" />
          <Lightformer form="ring" intensity={0.8} position={[6, 2, -4]} scale={3} color="#c9d6ff" />
        </Environment>
        <Suspense fallback={null}>
          <group position={[-0.6, 0, 0]}>
            {realModel ? (
              <GlbTract driver={driver} view={view} highlight={highlight} />
            ) : (
              <VocalTract driver={driver} view={view} highlight={highlight} stateRef={stateRef} />
            )}
            <Airflow driver={driver} enabled={airflow} frontOnly={view === "front"} section={view === "side"} />

          </group>
        </Suspense>
        <CameraRig view={view} compact={compact} />
        <LabelProjector stateRef={stateRef} els={labelEls} offset={offset} />
      </Canvas>
      <LabelOverlay names={names} highlight={highlight} els={labelEls} compact={compact} />
    </div>
  );
}
