// Luồng hơi: hạt phát sáng xanh nhạt chạy theo đường hơi (qua miệng / mũi / hai bên lưỡi).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { phonemes } from "@/lib/content";
import type { Airflow as AirflowKind } from "@/lib/types";
import type { MouthDriver } from "./driver";

const V = (x: number, y: number, z = -0.05) => new THREE.Vector3(x, y, z);
const THROAT = [V(-1.05, -4.6), V(-1.2, -3.0), V(-1.3, -1.4), V(-1.25, 0.2)];
const PATHS: Record<string, THREE.CatmullRomCurve3[]> = {
  oral: [new THREE.CatmullRomCurve3([...THROAT, V(-0.6, 1.25), V(0.9, 1.45), V(2.3, 1.15), V(3.4, 0.35), V(4.4, 0.06), V(5.6, 0.0)])],
  groove: [new THREE.CatmullRomCurve3([...THROAT, V(-0.6, 1.25), V(0.9, 1.5), V(2.4, 1.2), V(3.25, 0.55), V(3.75, 0.02), V(4.5, -0.04), V(5.8, -0.1)])],
  nasal: [new THREE.CatmullRomCurve3([...THROAT, V(-1.4, 1.5), V(-1.0, 2.55), V(0.5, 2.85), V(2.2, 2.8), V(3.6, 2.45), V(4.6, 2.05), V(5.7, 1.85)])],
  lateral: [-1, 1].map(
    (s) =>
      new THREE.CatmullRomCurve3([
        ...THROAT,
        V(-0.6, 1.1, 0.2 * s),
        V(0.9, 0.9, 0.9 * s),
        V(2.1, 0.55, 1.1 * s),
        V(3.2, 0.2, 0.85 * s),
        V(4.4, 0.05, 0.5 * s),
        V(5.5, 0.0, 0.45 * s),
      ]),
  ),
};

const vert = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (260.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, a * a * vAlpha);
  }
`;

const N = 170;

export function Airflow({ driver, enabled, frontOnly, section }: { driver: MouthDriver; enabled: boolean; frontOnly?: boolean; section?: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const seeds = useMemo(
    () => Array.from({ length: N }, () => ({ phase: Math.random(), speed: 0.22 + Math.random() * 0.12, jx: Math.random() - 0.5, jy: Math.random() - 0.5, jz: Math.random() - 0.5, lane: Math.random() < 0.5 ? 0 : 1 })),
    [],
  );
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(N), 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(N).fill(1), 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uColor: { value: new THREE.Color("#8ff3ff") } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo: g, mat: m };
  }, []);
  const strength = useRef(0);
  const kindRef = useRef<AirflowKind>("none");
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    const pose = driver.currentPoseName();
    const kind = (phonemes[pose]?.airflow ?? "none") as AirflowKind;
    const target = enabled && kind !== "none" ? 1 : 0;
    strength.current += (target - strength.current) * Math.min(1, dt * 5);
    if (kind !== "none") kindRef.current = kind;
    const k = kindRef.current;
    const curves = PATHS[k === "burst" ? "oral" : k] ?? PATHS.oral;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const alpha = geo.getAttribute("aAlpha") as THREE.BufferAttribute;
    const size = geo.getAttribute("aSize") as THREE.BufferAttribute;
    const t = state.clock.elapsedTime * (driver.slow ? 0.5 : 1);
    const burst = k === "burst" ? 0.4 + 0.6 * Math.max(0, Math.sin(t * 5)) : 1;
    const narrow = k === "groove" ? 0.35 : 1;
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const u = (s.phase + t * s.speed * (k === "groove" ? 1.5 : 1)) % 1;
      const c = curves[s.lane % curves.length];
      c.getPointAt(u, tmp);
      const spread = 0.12 * narrow;
      pos.setXYZ(i, tmp.x + s.jx * spread, tmp.y + s.jy * spread, tmp.z + s.jz * spread * 2);
      let fade = Math.min(1, u * 8) * Math.min(1, (1 - u) * 5);
      if (frontOnly && tmp.x < 3.8) fade = 0; // nhìn thẳng: chỉ hiện hơi thoát ra ngoài
      if (section && tmp.z > 0.05) fade = 0; // mặt cắt: nửa gần camera đã bị cắt bỏ
      alpha.setX(i, fade * strength.current * burst * 0.9);
      size.setX(i, (0.55 + 0.45 * Math.sin(i)) * (k === "groove" ? 0.8 : 1));
    }
    pos.needsUpdate = true;
    alpha.needsUpdate = true;
    size.needsUpdate = true;
    if (pointsRef.current) pointsRef.current.visible = strength.current > 0.01;
  });

  return <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} renderOrder={20} />;
}
