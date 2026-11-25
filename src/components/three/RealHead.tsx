// Gương mặt người thật (tượng xám) – nhân vật Microsoft Rocketbox (MIT), đã cắt lấy phần đầu (public/models/heads).
//  - Khẩu hình: 15 viseme chuẩn + jawOpen, mouthPucker, tongueUp… theo phonemes.json → "face".
//  - Tự dò mốc gương mặt (đầu mũi, khe môi, cằm) để đặt khoang miệng giải phẫu vào đúng chỗ.
//  - Mặt cắt dọc: tính giao tuyến của da đầu (đã áp biểu cảm) với mặt phẳng giữa, mỗi khung hình.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { phonemes } from "@/lib/content";
import { asset } from "@/lib/utils";
import type { MouthDriver } from "./driver";
import type { ViewMode } from "./VocalTract";
import { SECTION_PLANE } from "./VocalTract";

export type HeadKind = "child_m" | "child_f" | "teen_m" | "teen_f";
export const headUrl = (k: HeadKind) => asset(`models/heads/${k}.glb`);

/** Mốc của khoang miệng giải phẫu (hệ tọa độ VocalTract). */
export const ANATOMY = { stomion: new THREE.Vector2(4.15, 0.02), noseTip: new THREE.Vector2(5.12, 2.35), chin: new THREE.Vector2(4.58, -2.3), pharynxX: -1.7 };

export interface HeadFit {
  /** biến đổi đầu thật → hệ VocalTract (đồng dạng, không méo mặt) */
  scale: number;
  offset: THREE.Vector3;
  /** co giãn khoang miệng giải phẫu (quanh khe môi) để khớp mũi/cằm của gương mặt */
  interior: THREE.Vector3;
  /** khung bao của đầu trong hệ VocalTract (để đặt camera) */
  box: THREE.Box3;
  stomion: THREE.Vector3;
}

const SKIN = "#8f9297";
const SKIN_CUT = "#c9cbcf";

function landmarks(skin: THREE.Mesh) {
  const g = skin.geometry as THREE.BufferGeometry;
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const dict = skin.morphTargetDictionary ?? {};
  const jaw = g.morphAttributes.position?.[dict.jawOpen ?? -1] as THREE.BufferAttribute | undefined;
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  const mid: { x: number; y: number; move: number }[] = [];
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getZ(i)) > 0.7) continue;
    const move = jaw ? Math.hypot(jaw.getX(i), jaw.getY(i), jaw.getZ(i)) : 0;
    mid.push({ x: pos.getX(i), y: pos.getY(i), move });
  }
  const nose = mid.reduce((a, b) => (b.x > a.x ? b : a));
  // khe môi: giữa đỉnh thấp nhất không chuyển động (môi trên) và đỉnh cao nhất chuyển động (môi dưới) ở phía trước
  const front = mid.filter((p) => p.x > nose.x - 3.5 && p.y < nose.y - 0.8 && p.y > nose.y - 7);
  const moving = front.filter((p) => p.move > 0.25);
  const still = front.filter((p) => p.move <= 0.25);
  const lowerTop = moving.length ? Math.max(...moving.map((p) => p.y)) : nose.y - 2.5;
  const upperBottom = still.filter((p) => p.y > lowerTop).reduce((m, p) => Math.min(m, p.y), nose.y - 1.5);
  const sy = (lowerTop + upperBottom) / 2;
  const lipX = Math.max(...front.filter((p) => Math.abs(p.y - sy) < 0.8).map((p) => p.x), nose.x - 1.5);
  const chinPts = mid.filter((p) => p.y < sy - 1.5 && p.y > sy - 6 && p.x > nose.x - 6);
  const chin = chinPts.length ? chinPts.reduce((a, b) => (b.x > a.x ? b : a)) : { x: lipX, y: sy - 3.5 };
  return { nose, stomion: new THREE.Vector2(lipX - 0.2, sy), chin, box };
}

const PLANE_EPS = 0.01;

/** Giao tuyến của lưới (đã áp biểu cảm trên CPU) với mặt phẳng z = 0 → vòng kín dài nhất. */
function sectionLoop(base: Float32Array, index: ArrayLike<number>, tris: number[], morphs: Float32Array[], inf: number[]) {
  const P = (i: number, out: THREE.Vector3) => {
    let x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
    for (let k = 0; k < morphs.length; k++) {
      const w = inf[k];
      if (w < 0.002) continue;
      const m = morphs[k];
      x += m[i * 3] * w;
      y += m[i * 3 + 1] * w;
      z += m[i * 3 + 2] * w;
    }
    return out.set(x, y, z);
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const pts = new Map<string, THREE.Vector2>();
  const adj = new Map<string, string[]>();
  const edgeKey = (i: number, j: number) => (i < j ? `${i}_${j}` : `${j}_${i}`);
  const cache = new Map<number, THREE.Vector3>();
  const get = (i: number) => {
    let v = cache.get(i);
    if (!v) cache.set(i, (v = P(i, new THREE.Vector3())));
    return v;
  };
  for (const t of tris) {
    const ids = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]];
    const hits: string[] = [];
    for (let e = 0; e < 3; e++) {
      const i = ids[e], j = ids[(e + 1) % 3];
      a.copy(get(i));
      b.copy(get(j));
      // mặt phẳng lệch 0,1 mm: lưới có đỉnh nằm đúng trên đường giữa (z = 0)
      if ((a.z > PLANE_EPS) === (b.z > PLANE_EPS)) continue;
      const k = edgeKey(i, j);
      if (!pts.has(k)) {
        const f = (a.z - PLANE_EPS) / (a.z - b.z);
        pts.set(k, new THREE.Vector2(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f));
      }
      hits.push(k);
    }
    if (hits.length === 2) {
      (adj.get(hits[0]) ?? adj.set(hits[0], []).get(hits[0])!).push(hits[1]);
      (adj.get(hits[1]) ?? adj.set(hits[1], []).get(hits[1])!).push(hits[0]);
    }
  }
  // nối các đoạn thành các đường gấp khúc
  const seen = new Set<string>();
  const lines: THREE.Vector2[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    // đi về một phía rồi phía kia
    const walk = (from: string) => {
      const line = [from];
      let prev = "", cur = from;
      for (;;) {
        seen.add(cur);
        const nx = (adj.get(cur) ?? []).find((n) => n !== prev && !seen.has(n));
        if (!nx) break;
        line.push(nx);
        prev = cur;
        cur = nx;
      }
      return line;
    };
    const fwd = walk(start);
    const nb = (adj.get(start) ?? []).find((n) => !seen.has(n));
    const back = nb ? walk(nb) : [];
    const keys = [...back.reverse(), ...fwd];
    if (keys.length >= 4) lines.push(keys.map((k) => pts.get(k)!));
  }
  // Lưới đầu hở ở khe miệng/mắt → giao tuyến đứt thành nhiều đoạn: ghép tham lam theo đầu mút gần nhất thành một vòng
  if (!lines.length) return [];
  lines.sort((a, b) => b.length - a.length);
  const out = lines.shift()!.slice();
  for (;;) {
    const head = out[0], tail = out[out.length - 1];
    let bi = -1, bd = Infinity, atTail = true, rev = false;
    lines.forEach((l, i) => {
      const cands: [number, boolean, boolean][] = [
        [tail.distanceTo(l[0]), true, false],
        [tail.distanceTo(l[l.length - 1]), true, true],
        [head.distanceTo(l[l.length - 1]), false, false],
        [head.distanceTo(l[0]), false, true],
      ];
      for (const [d, t, r] of cands) if (d < bd) (bd = d), (bi = i), (atTail = t), (rev = r);
    });
    if (bi < 0) break;
    // mảnh nhỏ (mí mắt…) chỉ nối khi rất gần; mảnh lớn (môi dưới–cằm–cổ) được nối qua khoảng hở chân cổ
    const big = lines[bi].length >= 10;
    if (bd > (big ? 16 : 3)) break;
    const l = lines.splice(bi, 1)[0];
    const seg = rev ? l.slice().reverse() : l;
    if (atTail) out.push(...seg);
    else out.unshift(...seg);
  }
  return out;
}

export function RealHead({ kind, driver, view, onFit, highlightLips }: { kind: HeadKind; driver: MouthDriver; view: ViewMode; onFit: (f: HeadFit) => void; highlightLips?: boolean }) {
  const gltf = useGLTF(headUrl(kind));
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  const meshes = useMemo(() => {
    const list: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh);
    });
    return list;
  }, [scene]);
  const skin = meshes.find((m) => m.name === "skin")!;

  // chất liệu: tượng xám như ảnh mẫu
  const mats = useMemo(() => {
    const clay = new THREE.MeshPhysicalMaterial({ color: SKIN, roughness: 0.55, clearcoat: 0.08, sheen: 0.25, sheenColor: new THREE.Color("#ffffff") });
    return {
      skin: clay,
      hair: clay,
      eyes: new THREE.MeshPhysicalMaterial({ color: "#83868b", roughness: 0.25, clearcoat: 1 }),
      teeth: new THREE.MeshStandardMaterial({ color: "#efece4", roughness: 0.35 }),
      tongue: new THREE.MeshStandardMaterial({ color: "#c77983", roughness: 0.5 }),
    } as Record<string, THREE.MeshStandardMaterial>;
  }, []);
  useEffect(() => {
    for (const m of meshes) m.material = mats[m.name] ?? mats.skin;
  }, [meshes, mats]);

  // mốc gương mặt + biến đổi vào hệ VocalTract
  const fit = useMemo<HeadFit>(() => {
    const L = landmarks(skin);
    const depth = L.nose.x - L.box.min.x; // mũi → gáy (cm)
    const scale = 14 / depth; // khoang miệng thật ≈ 42% chiều sâu đầu ↔ 5,85 đơn vị giải phẫu
    const offset = new THREE.Vector3(ANATOMY.stomion.x - L.stomion.x * scale, ANATOMY.stomion.y - L.stomion.y * scale, 0);
    const toMine = (x: number, y: number) => new THREE.Vector2(x * scale + offset.x, y * scale + offset.y);
    const nose = toMine(L.nose.x, L.nose.y);
    const sy = THREE.MathUtils.clamp((nose.y - ANATOMY.stomion.y) / (ANATOMY.noseTip.y - ANATOMY.stomion.y), 0.45, 1.2);
    const box = L.box.clone();
    box.min.multiplyScalar(scale).add(offset);
    box.max.multiplyScalar(scale).add(offset);
    return { scale, offset, interior: new THREE.Vector3(1, sy, 1), box, stomion: new THREE.Vector3(ANATOMY.stomion.x, ANATOMY.stomion.y, 0) };
  }, [skin]);
  useEffect(() => onFit(fit), [fit, onFit]);

  // dữ liệu mặt cắt (CPU) cho da và tóc (tóc che lỗ trên da đầu ở chỗ gắn tóc)
  const secMeshes = useMemo(() => meshes.filter((m) => m.name === "skin" || m.name === "hair"), [meshes]);
  const secs = useMemo(() => secMeshes.map((mesh) => {
    const g = mesh.geometry as THREE.BufferGeometry;
    const base = (g.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const index = g.getIndex()!.array;
    const morphs = (g.morphAttributes.position ?? []).map((a) => a.array as Float32Array);
    const tris: number[] = [];
    for (let t = 0; t < index.length / 3; t++) {
      let pos = false, neg = false;
      for (let j = 0; j < 3; j++) {
        const z = base[index[t * 3 + j] * 3 + 2];
        if (z > -1.5) pos = true;
        if (z < 1.5) neg = true;
      }
      if (pos && neg) tris.push(t);
    }
    return { mesh, base, index, morphs, tris };
  }), [secMeshes]);
  const capGeos = useRef<THREE.BufferGeometry[]>([]);
  const capMat = useMemo(() => new THREE.MeshBasicMaterial({ color: SKIN_CUT, side: THREE.DoubleSide, depthTest: true, depthFunc: THREE.AlwaysDepth }), []);
  const lastSig = useRef("");

  const section = view === "side";
  // cắt gọn chân cổ (lưới hở ở cổ) – mặt phẳng trong hệ thế giới; nhóm cha dời x −0,6 nên y không đổi
  const neckPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -(fit.box.min.y + (fit.box.max.y - fit.box.min.y) * 0.06)), [fit]);
  useEffect(() => {
    for (const m of Object.values(mats)) {
      m.clippingPlanes = section ? [SECTION_PLANE, neckPlane] : [neckPlane];
      m.transparent = view === "xray";
      m.opacity = view === "xray" ? 0.16 : 1;
      m.depthWrite = view !== "xray";
      m.needsUpdate = true;
    }
    for (const m of meshes) {
      // xuyên thấu / mặt cắt: dùng lưỡi & răng của mô hình giải phẫu
      if (m.name === "tongue" || m.name === "teeth" || m.name === "eyes") m.visible = view === "front" || (m.name === "eyes" && view === "xray");
      m.renderOrder = view === "xray" ? 50 : 0;
    }
  }, [mats, meshes, section, view, neckPlane]);

  const weights = useRef<Record<string, number>>({});
  const blinkAt = useRef(2);
  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    const pose = driver.currentPoseName();
    const target = phonemes[pose]?.face ?? phonemes.rest.face ?? {};
    const lambda = driver.slow ? 8 : 18;
    const f = 1 - Math.exp(-lambda * d);
    const w = weights.current;
    const dict = skin.morphTargetDictionary ?? {};
    for (const k of Object.keys(dict)) {
      const tv = target[k] ?? 0;
      w[k] = (w[k] ?? 0) + (tv - (w[k] ?? 0)) * f;
    }
    // chớp mắt cho sinh động
    const t = state.clock.elapsedTime;
    if (t > blinkAt.current + 0.16) blinkAt.current = t + 2.5 + Math.random() * 3;
    w.blink = t > blinkAt.current ? 1 : 0;
    for (const m of meshes) {
      if (!m.morphTargetInfluences || !m.morphTargetDictionary) continue;
      for (const [k, i] of Object.entries(m.morphTargetDictionary)) m.morphTargetInfluences[i] = w[k] ?? 0;
    }
    if (highlightLips) mats.skin.emissive.set("#7ef0ff"), (mats.skin.emissiveIntensity = 0.05 + 0.05 * Math.sin(t * 4));

    if (section) {
      const inf = skin.morphTargetInfluences ?? [];
      const sig = inf.map((x) => x.toFixed(2)).join(",");
      if (sig !== lastSig.current) {
        lastSig.current = sig;
        secs.forEach((sec, i) => {
          const loop = sectionLoop(sec.base, sec.index, sec.tris, sec.morphs, sec.mesh.morphTargetInfluences ?? inf);
          if (loop.length < 8) return;
          // làm trơn đường viền (lưới thưa → gãy khúc)
          const smooth = new THREE.SplineCurve(loop).getSpacedPoints(Math.min(600, loop.length * 3));
          const ng = new THREE.ShapeGeometry(new THREE.Shape(smooth)).translate(0, 0, -0.01 / fit.scale);
          capGeos.current[i]?.dispose();
          capGeos.current[i] = ng;
          const m = capRefs.current[i];
          if (m) m.geometry = ng;
        });
      }
    }
  });
  const capRefs = useRef<(THREE.Mesh | null)[]>([]);

  return (
    <group position={fit.offset} scale={fit.scale}>
      <primitive object={scene} />
      {section &&
        secs.map((_, i) => (
          <mesh key={i} ref={(m) => void (capRefs.current[i] = m)} geometry={capGeos.current[i] ?? new THREE.BufferGeometry()} material={capMat} renderOrder={0.5} frustumCulled={false} />
        ))}
    </group>
  );
}

