// Mô hình giải phẫu TẠM dựng bằng khối cơ bản (thay bằng /models/vocal_tract.glb sau).
// Hệ tọa độ: x = phía trước (môi ở +x), y = lên trên, z = sang ngang. Đơn vị ≈ 1 cm.
// Lưỡi và môi có morph targets đặt tên trùng tham số trong phonemes.json; hàm và vòm mềm là "xương" (khớp xoay).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { FullPose, ParamKey } from "./rig";

type P = Partial<Record<ParamKey | "tongueBodyBack", number>>;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Khớp hàm (thái dương–hàm) và khớp vòm mềm
export const JAW_PIVOT = new THREE.Vector3(-1.7, 1.1, 0);
export const JAW_MAX_ANGLE = THREE.MathUtils.degToRad(17);
export const VELUM_PIVOT = new THREE.Vector3(0.0, 1.86, 0);
export const velumAngle = (lower: number) => THREE.MathUtils.lerp(-0.3, 0.45, lower);
export const jawAngle = (open: number) => -open * JAW_MAX_ANGLE;
/** Lưỡi đi theo hàm một nửa góc (gắn vào xương móng + cơ cằm lưỡi). */
export const TONGUE_JAW_FOLLOW = 0.5;

// ---------------------------------------------------------------- LƯỠI
const v2 = (x: number, y: number) => new THREE.Vector2(x, y);
type Ctl = { base: THREE.Vector2; d: Partial<Record<keyof P, [number, number]>> };

const TOP: Ctl[] = [
  { base: v2(-0.9, -2.2), d: { tongueBodyBack: [-0.25, 0] } },
  { base: v2(-1.0, -1.0), d: { tongueBodyFront: [0.4, 0], tongueBodyBack: [-0.45, 0] } },
  { base: v2(-0.4, 0.3), d: { tongueBodyUp: [0.2, 0.6], tongueBodyFront: [0.5, 0], tongueBodyBack: [-0.4, 0.1], tongueBackUp: [0.1, 1.05] } },
  {
    base: v2(0.9, 0.85),
    d: { tongueBodyUp: [0.45, 1.05], tongueBodyFront: [0.6, 0.05], tongueBodyBack: [-0.5, -0.1], tongueBackUp: [-0.3, 0.25], tongueTipUp: [0, 0.1], tongueTipCurl: [-0.2, 0.05] },
  },
  {
    base: v2(2.2, 0.35),
    d: { tongueTipUp: [0.1, 0.55], tongueTipCurl: [-0.25, 0.35], tongueTipDown: [0, -0.1], tongueBodyUp: [0.2, 0.95], tongueBodyFront: [0.3, 0.15] },
  },
  { base: v2(3.0, -0.25), d: { tongueTipUp: [0.05, 1.45], tongueTipCurl: [-0.75, 0.94], tongueTipDown: [0.1, -0.3], tongueBodyUp: [0, 0.1] } },
];
const BOTTOM: Ctl[] = [
  { base: v2(-0.5, -2.45), d: { tongueBodyBack: [-0.2, 0] } },
  { base: v2(0.6, -1.7), d: { tongueBodyFront: [0.2, 0], tongueBodyBack: [-0.25, 0] } },
  { base: v2(1.7, -1.2), d: { tongueBodyUp: [0.1, 0.25], tongueBodyFront: [0.3, 0], tongueBodyBack: [-0.3, 0], tongueTipUp: [0, 0.15] } },
  { base: v2(2.5, -0.8), d: { tongueTipUp: [0.05, 0.8], tongueTipCurl: [-0.4, 0.5], tongueTipDown: [0, -0.1], tongueBodyUp: [0.1, 0.3], tongueBodyFront: [0.2, 0] } },
  { base: v2(2.9, -0.53), d: { tongueTipUp: [0, 1.45], tongueTipCurl: [-0.6, 0.8], tongueTipDown: [0.1, -0.28], tongueBodyUp: [0, 0.1] } },
];

function ctlPoints(ctl: Ctl[], p: P) {
  return ctl.map((c) => {
    const v = c.base.clone();
    for (const [k, d] of Object.entries(c.d) as [keyof P, [number, number]][]) {
      const w = p[k] ?? 0;
      v.x += d[0] * w;
      v.y += d[1] * w;
    }
    return new THREE.Vector3(v.x, v.y, 0);
  });
}

/** Điểm mốc trên lưỡi (đầu, mặt, cuống, hai bên) theo tham số – dùng cho nhãn & điểm sáng. */
export function tongueLandmarks(pose: FullPose) {
  const p = expandPose(pose);
  const top = new THREE.CatmullRomCurve3(ctlPoints(TOP, p), false, "catmullrom", 0.5);
  return {
    tongue_tip: top.getPoint(0.985),
    tongue_blade: top.getPoint(0.72),
    tongue_root: top.getPoint(0.3),
    tongue_sides: top.getPoint(0.75).add(new THREE.Vector3(0, -0.15, 1.1)),
  };
}

export function expandPose(pose: Partial<FullPose>): P {
  const p: P = { ...pose };
  const f = pose.tongueBodyFront ?? 0;
  p.tongueBodyFront = Math.max(0, f);
  p.tongueBodyBack = Math.max(0, -f);
  return p;
}

const NU = 44;
const NR = 28;
const TONGUE_W = 1.45;

function tongueWidth(u: number) {
  if (u <= 0.35) return TONGUE_W * (0.78 + 0.22 * (u / 0.35));
  return TONGUE_W * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.35) / 0.65, 4)));
}

function buildTonguePositions(p: P): Float32Array {
  const top = new THREE.CatmullRomCurve3(ctlPoints(TOP, p), false, "catmullrom", 0.5);
  const bot = new THREE.CatmullRomCurve3(ctlPoints(BOTTOM, p), false, "catmullrom", 0.5);
  const groove = p.tongueGroove ?? 0;
  const sides = p.tongueSidesDown ?? 0;
  const pos = new Float32Array((NU * NR + 1) * 3);
  let o = 0;
  const pt = new THREE.Vector3();
  const pb = new THREE.Vector3();
  for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1);
    top.getPoint(u, pt);
    bot.getPoint(u, pb);
    const mid = pt.clone().add(pb).multiplyScalar(0.5);
    const k = u > 0.86 ? Math.sqrt(Math.max(0, 1 - ((u - 0.86) / 0.14) ** 2)) : 1;
    const up = pt.clone().sub(mid).multiplyScalar(k);
    const dn = pb.clone().sub(mid).multiplyScalar(k);
    const w = tongueWidth(u) * Math.max(k, 0.0001);
    const regionG = smooth(0.35, 0.6, u) * (1 - smooth(0.93, 1, u));
    const regionL = smooth(0.42, 0.68, u) * (1 - smooth(0.9, 1, u));
    for (let j = 0; j < NR; j++) {
      const th = ((j + 0.5) / NR) * Math.PI * 2; // lệch nửa bước: không có đỉnh nằm đúng trên mặt cắt z = 0
      const c = Math.cos(th);
      const s = Math.sin(th);
      let x: number, y: number;
      if (s >= 0) {
        let along = Math.pow(Math.max(0, 1 - c * c), 0.3);
        along -= groove * 0.5 * Math.exp(-(c * c) / 0.05) * regionG;
        along -= sides * 0.85 * smooth(0.3, 0.95, Math.abs(c)) * regionL;
        along = Math.max(along, 0.05);
        x = mid.x + up.x * along;
        y = mid.y + up.y * along;
      } else {
        const along = Math.pow(Math.max(0, 1 - c * c), 0.5);
        x = mid.x + dn.x * along;
        y = mid.y + dn.y * along;
      }
      pos[o++] = x;
      pos[o++] = y;
      pos[o++] = c * w;
    }
  }
  // tâm nắp gốc lưỡi
  const p0t = top.getPoint(0);
  const p0b = bot.getPoint(0);
  pos[o++] = (p0t.x + p0b.x) / 2;
  pos[o++] = (p0t.y + p0b.y) / 2;
  pos[o++] = 0;
  return pos;
}

let tongueIndex: number[] | null = null;
function tongueIndices() {
  if (tongueIndex) return tongueIndex;
  const idx: number[] = [];
  for (let i = 0; i < NU - 1; i++)
    for (let j = 0; j < NR; j++) {
      const a = i * NR + j;
      const b = i * NR + ((j + 1) % NR);
      const c = (i + 1) * NR + j;
      const d = (i + 1) * NR + ((j + 1) % NR);
      idx.push(a, c, b, b, c, d);
    }
  const center = NU * NR;
  for (let j = 0; j < NR; j++) idx.push(center, j, (j + 1) % NR);
  tongueIndex = idx;
  return idx;
}

/** Tạo hình học có morph targets từ hàm dựng vị trí theo tham số. */
function morphable(build: (p: P) => Float32Array, index: number[], keys: (keyof P)[]) {
  const geo = new THREE.BufferGeometry();
  const base = build({});
  geo.setAttribute("position", new THREE.BufferAttribute(base, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const baseNormals = (geo.getAttribute("normal") as THREE.BufferAttribute).array as Float32Array;
  const mPos: THREE.BufferAttribute[] = [];
  const mNor: THREE.BufferAttribute[] = [];
  for (const k of keys) {
    const tp = build({ [k]: 1 });
    const tmp = new THREE.BufferGeometry();
    tmp.setAttribute("position", new THREE.BufferAttribute(tp, 3));
    tmp.setIndex(index);
    tmp.computeVertexNormals();
    const tn = (tmp.getAttribute("normal") as THREE.BufferAttribute).array as Float32Array;
    const dp = new Float32Array(tp.length);
    const dn = new Float32Array(tp.length);
    for (let i = 0; i < tp.length; i++) {
      dp[i] = tp[i] - base[i];
      dn[i] = tn[i] - baseNormals[i];
    }
    const a = new THREE.BufferAttribute(dp, 3);
    a.name = String(k);
    mPos.push(a);
    mNor.push(new THREE.BufferAttribute(dn, 3));
    tmp.dispose();
  }
  geo.morphAttributes.position = mPos;
  geo.morphAttributes.normal = mNor;
  geo.morphTargetsRelative = true;
  return { geo, keys: keys.map(String) };
}

export const TONGUE_MORPHS: (keyof P)[] = [
  "tongueTipUp",
  "tongueTipCurl",
  "tongueTipDown",
  "tongueBodyUp",
  "tongueBodyFront",
  "tongueBodyBack",
  "tongueBackUp",
  "tongueGroove",
  "tongueSidesDown",
];
export const buildTongue = () => morphable(buildTonguePositions, tongueIndices(), TONGUE_MORPHS);

// ---------------------------------------------------------------- MÔI
const LIP_NZ = 36;
const LIP_NR = 18;
const LIP_W = 1.55;

function lipPositions(upper: boolean) {
  return (p: P): Float32Array => {
    const round = p.lipRound ?? 0;
    const spread = p.lipSpread ?? 0;
    const close = p.lipClose ?? 0;
    const dental = p.lipDental ?? 0;
    const pos = new Float32Array(LIP_NZ * LIP_NR * 3 + 6);
    let o = 0;
    const zScale = 1 - 0.42 * round + 0.14 * spread;
    for (let i = 0; i < LIP_NZ; i++) {
      const t = (i / (LIP_NZ - 1)) * 2 - 1; // -1..1
      const z0 = t * LIP_W;
      const taper = Math.pow(Math.max(0, 1 - t * t), 0.55);
      const mid = 1 - t * t;
      let cx = 4.12 - 0.42 * z0 * z0 + 0.42 * round * (0.5 + 0.5 * mid) - 0.12 * spread * t * t;
      let cy = upper ? 0.33 - 0.06 * t * t : -0.32 + 0.06 * t * t;
      if (upper) cy += 0.2 * round * mid + 0.03 * spread - 0.05 * close + 0.12 * dental * mid;
      else {
        cy += -0.1 * round * mid + 0.1 * close;
        cx += -0.55 * dental * mid;
        cy += 0.24 * dental * mid;
      }
      const z = z0 * zScale;
      const rx = (upper ? 0.36 : 0.4) * taper * (1 - 0.12 * spread + 0.1 * round);
      const ry = (upper ? 0.3 : 0.32) * taper * (1 - 0.18 * spread);
      // khung tiếp tuyến của đường vòng cung môi
      const dzdt = LIP_W * zScale;
      const dxdt = -0.84 * z0 * LIP_W;
      const len = Math.hypot(dxdt, dzdt) || 1;
      const bx = dzdt / len; // pháp tuyến ngang (trong mặt phẳng x–z), hướng ra trước
      const bz = -dxdt / len;
      for (let j = 0; j < LIP_NR; j++) {
        const ph = ((j + 0.5) / LIP_NR) * Math.PI * 2;
        pos[o++] = cx + bx * rx * Math.cos(ph);
        pos[o++] = cy + ry * Math.sin(ph);
        pos[o++] = z + bz * rx * Math.cos(ph);
      }
    }
    // tâm hai đầu (khép kín)
    for (const t of [-1, 1]) {
      const z0 = t * LIP_W;
      pos[o++] = 4.12 - 0.42 * z0 * z0;
      pos[o++] = upper ? 0.27 : -0.26;
      pos[o++] = z0 * zScale;
    }
    return pos;
  };
}
function lipIndices() {
  const idx: number[] = [];
  for (let i = 0; i < LIP_NZ - 1; i++)
    for (let j = 0; j < LIP_NR; j++) {
      const a = i * LIP_NR + j;
      const b = i * LIP_NR + ((j + 1) % LIP_NR);
      const c = (i + 1) * LIP_NR + j;
      const d = (i + 1) * LIP_NR + ((j + 1) % LIP_NR);
      idx.push(a, b, c, b, d, c);
    }
  const c0 = LIP_NZ * LIP_NR;
  const c1 = c0 + 1;
  const last = (LIP_NZ - 1) * LIP_NR;
  for (let j = 0; j < LIP_NR; j++) {
    idx.push(c0, (j + 1) % LIP_NR, j);
    idx.push(c1, last + j, last + ((j + 1) % LIP_NR));
  }
  return idx;
}
export const LIP_MORPHS: (keyof P)[] = ["lipRound", "lipSpread", "lipClose", "lipDental"];
export const buildLip = (upper: boolean) => morphable(lipPositions(upper), lipIndices(), LIP_MORPHS);

// ---------------------------------------------------------------- CUNG RĂNG
/** Cung răng hình chữ U: t ∈ [-1, 1], 0 = giữa (răng cửa). */
export function archPoint(t: number, frontX = 3.62, back = 2.9, halfW = 1.35) {
  const a = (t * Math.PI) / 2;
  return new THREE.Vector3(frontX - back * (1 - Math.cos(a)), 0, halfW * Math.sin(a));
}

export function buildTeeth(upper: boolean) {
  const geos: THREE.BufferGeometry[] = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const t = -1 + (i + 0.5) * (2 / n) * 0.92;
    const at = Math.abs(t);
    const frontX = upper ? 3.62 : 3.44;
    const p = archPoint(t * 0.98, frontX, 2.85, upper ? 1.35 : 1.25);
    const p2 = archPoint(t * 0.98 + 0.01, frontX, 2.85, upper ? 1.35 : 1.25);
    const tangent = p2.clone().sub(p).normalize();
    const incisor = at < 0.27;
    const canine = at >= 0.27 && at < 0.4;
    const w = incisor ? 0.3 : canine ? 0.32 : 0.42;
    const h = incisor ? 0.9 : canine ? 0.95 : 0.66;
    const d = incisor ? 0.2 : canine ? 0.32 : 0.48;
    const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, d) * 0.35);
    // xoay để mặt răng hướng theo cung
    const m = new THREE.Matrix4();
    const yaw = Math.atan2(-tangent.x, tangent.z);
    m.makeRotationY(yaw + Math.PI / 2);
    if (incisor) m.multiply(new THREE.Matrix4().makeRotationZ((upper ? 1 : -1) * 0.18));
    const yC = upper ? 0.04 + h / 2 : -0.06 - h / 2;
    m.setPosition(p.x, yC, p.z);
    g.applyMatrix4(m);
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false)!;
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Ống chạy theo cung răng (lợi, xương hàm, gờ lợi trên). */
export function archTube(opts: { y: number; frontX: number; back: number; halfW: number; rx: number; ry: number; t0?: number; t1?: number; xOffset?: number }) {
  const { y, frontX, back, halfW, rx, ry, t0 = -1, t1 = 1, xOffset = 0 } = opts;
  const NZ = 40;
  const NRr = 14;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < NZ; i++) {
    const t = t0 + (t1 - t0) * (i / (NZ - 1));
    const p = archPoint(t, frontX + xOffset, back, halfW);
    const p2 = archPoint(t + 0.001, frontX + xOffset, back, halfW);
    const tan = p2.sub(p).normalize();
    const nx = tan.z;
    const nz = -tan.x;
    const endTaper = Math.pow(Math.min(1, Math.min(i, NZ - 1 - i) / 3 + 0.25), 0.5);
    for (let j = 0; j < NRr; j++) {
      const ph = (j / NRr) * Math.PI * 2;
      pos.push(p.x + nx * rx * endTaper * Math.cos(ph), y + ry * endTaper * Math.sin(ph), p.z + nz * rx * endTaper * Math.cos(ph));
    }
  }
  for (let i = 0; i < NZ - 1; i++)
    for (let j = 0; j < NRr; j++) {
      const a = i * NRr + j;
      const b = i * NRr + ((j + 1) % NRr);
      const c = (i + 1) * NRr + j;
      const d = (i + 1) * NRr + ((j + 1) % NRr);
      idx.push(a, b, c, b, d, c);
    }
  // nắp hai đầu
  const c0 = pos.length / 3;
  const s = archPoint(t0, frontX + xOffset, back, halfW);
  const e = archPoint(t1, frontX + xOffset, back, halfW);
  pos.push(s.x, y, s.z, e.x, y, e.z);
  const last = (NZ - 1) * NRr;
  for (let j = 0; j < NRr; j++) {
    idx.push(c0, (j + 1) % NRr, j);
    idx.push(c0 + 1, last + j, last + ((j + 1) % NRr));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- KHỐI ĐÙN THEO MẶT CẮT DỌC
/** Đùn một biên dạng mặt cắt dọc (x,y) theo trục z, đối xứng quanh z = 0. */
export function slab(points: [number, number][], halfDepth: number, bevel = 0.12, smoothPts = true) {
  const pts = points.map(([x, y]) => new THREE.Vector2(x, y));
  const shape = new THREE.Shape();
  if (smoothPts) {
    const curve = new THREE.SplineCurve([...pts, pts[0]]);
    shape.setFromPoints(curve.getPoints(pts.length * 8));
  } else shape.setFromPoints(pts);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: halfDepth * 2 - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.translate(0, 0, -halfDepth + bevel);
  g.computeVertexNormals();
  return g;
}

// Biên dạng các bộ phận (mặt cắt dọc giữa)
export const PROFILE = {
  hardPalate: [
    [3.42, 0.98], [3.08, 1.2], [2.5, 1.56], [1.6, 1.9], [0.6, 1.97], [0.0, 1.8], [-0.05, 2.02], [0.6, 2.18], [1.6, 2.2], [3.0, 2.02], [3.6, 1.6],
  ] as [number, number][],
  velum: [
    [0.05, 0.12], [-0.7, 0.06], [-1.32, -0.12], [-1.46, -0.32], [-1.2, -0.38], [-0.7, -0.26], [0.05, -0.14],
  ] as [number, number][],
  pharynx: [
    [-1.62, 2.6], [-1.76, 1.0], [-1.72, -1.0], [-1.52, -3.0], [-1.42, -4.8], [-2.3, -4.8], [-2.5, -1.0], [-2.45, 2.0], [-2.05, 3.05],
  ] as [number, number][],
  nasal: [
    [0.0, 2.1], [1.6, 2.24], [3.2, 2.06], [4.15, 1.9], [4.55, 2.3], [3.7, 2.95], [2.5, 3.5], [0.5, 3.72], [-1.0, 3.32], [-1.55, 2.62], [-1.48, 2.12],
  ] as [number, number][],
  epiglottis: [
    [-0.95, -2.85], [-0.75, -2.2], [-0.85, -1.55], [-1.02, -1.5], [-1.0, -2.2], [-1.12, -2.85],
  ] as [number, number][],
  larynx: [
    [-0.75, -3.0], [-0.2, -3.2], [-0.25, -4.8], [-1.35, -4.8], [-1.3, -3.4], [-1.0, -3.0],
  ] as [number, number][],
  airway: [
    [4.0, 0.25], [3.55, 1.2], [3.7, 2.0], [4.6, 2.3], [3.0, 3.55], [0.3, 3.85], [-1.85, 3.1], [-1.95, 0.0], [-1.6, -4.9], [-0.2, -4.9], [0.2, -2.9], [1.5, -2.2], [3.0, -1.4], [3.9, -0.4],
  ] as [number, number][],
  headUpper: [
    [4.4, 0.12], [4.55, 0.62], [4.28, 1.6], [4.62, 1.95], [5.12, 2.35], [4.92, 2.95], [4.18, 3.95], [4.28, 4.65], [3.75, 6.2], [2.2, 7.4], [0.0, 7.8], [-2.5, 7.3], [-4.3, 5.6], [-5.0, 3.2], [-4.6, 0.8], [-3.6, -0.8], [-3.0, -2.2], [-3.1, -5.6], [1.6, -5.6], [2.4, -3.55], [-0.05, -3.35], [-1.4, -2.75], [-1.75, 0.6],
  ] as [number, number][],
  jawSkin: [
    [4.42, -0.2], [4.3, -0.6], [4.22, -1.1], [4.35, -1.7], [4.58, -2.3], [4.42, -2.8], [3.95, -3.12], [3.0, -3.35], [2.0, -3.4], [1.0, -3.38], [-0.05, -3.3], [-0.9, -3.05], [-1.4, -2.7], [-1.6, -1.2], [-1.75, 0.5], [1.0, 0.3], [4.4, 0.02],
  ] as [number, number][],
};

/** Phần nối hàm dưới: xương hàm (ống theo cung răng dưới) */
export const buildMandible = () => archTube({ y: -1.55, frontX: 3.55, back: 3.1, halfW: 1.45, rx: 0.42, ry: 0.85 });

// ---------------------------------------------------------------- MẶT CẮT DỌC CỦA LƯỠI
export const TONGUE_SECTION_N = 48;
/** Ghi biên dạng mặt cắt dọc giữa của lưỡi (trên + dưới) vào mảng vị trí của dải tam giác. */
export function writeTongueSection(pose: Partial<FullPose>, out: Float32Array) {
  const p = expandPose(pose);
  const top = new THREE.CatmullRomCurve3(ctlPoints(TOP, p), false, "catmullrom", 0.5);
  const bot = new THREE.CatmullRomCurve3(ctlPoints(BOTTOM, p), false, "catmullrom", 0.5);
  const groove = p.tongueGroove ?? 0;
  const pt = new THREE.Vector3();
  const pb = new THREE.Vector3();
  for (let i = 0; i < TONGUE_SECTION_N; i++) {
    const u = i / (TONGUE_SECTION_N - 1);
    top.getPoint(u, pt);
    bot.getPoint(u, pb);
    const mx = (pt.x + pb.x) / 2;
    const my = (pt.y + pb.y) / 2;
    const k = u > 0.86 ? Math.sqrt(Math.max(0, 1 - ((u - 0.86) / 0.14) ** 2)) : 1;
    const regionG = smooth(0.35, 0.6, u) * (1 - smooth(0.93, 1, u));
    const along = Math.max(0.05, 1 - groove * 0.5 * regionG);
    out[i * 6 + 0] = mx + (pt.x - mx) * k * along;
    out[i * 6 + 1] = my + (pt.y - my) * k * along;
    out[i * 6 + 2] = -0.003;
    out[i * 6 + 3] = mx + (pb.x - mx) * k;
    out[i * 6 + 4] = my + (pb.y - my) * k;
    out[i * 6 + 5] = -0.003;
  }
}
export function buildTongueSection() {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(TONGUE_SECTION_N * 6);
  writeTongueSection({}, pos);
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const idx: number[] = [];
  for (let i = 0; i < TONGUE_SECTION_N - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------- HÌNH MẶT CẮT 2D (vẽ trực tiếp, không cần stencil)
const SECTION_Z = -0.004;
export function shapeSection(points: [number, number][], smoothPts = true) {
  const pts = points.map(([x, y]) => new THREE.Vector2(x, y));
  const shape = new THREE.Shape();
  if (smoothPts) shape.setFromPoints(new THREE.SplineCurve([...pts, pts[0]]).getPoints(pts.length * 8));
  else shape.setFromPoints(pts);
  return new THREE.ShapeGeometry(shape, 8).translate(0, 0, SECTION_Z);
}
export function ellipseSection(cx: number, cy: number, rx: number, ry: number) {
  return new THREE.CircleGeometry(1, 32).scale(rx, ry, 1).translate(cx, cy, SECTION_Z);
}
export function roundedRectSection(cx: number, cy: number, w: number, h: number, r: number, angle: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 6).rotateZ(angle).translate(cx, cy, SECTION_Z);
}
/** Elip mặt cắt môi tại đường giữa (z = 0), theo tham số tư thế – khớp với lipPositions(). */
export function lipSectionParams(upper: boolean, pose: Partial<FullPose>) {
  const round = pose.lipRound ?? 0;
  const spread = pose.lipSpread ?? 0;
  const close = pose.lipClose ?? 0;
  const dental = pose.lipDental ?? 0;
  let cx = 4.12 + 0.42 * round;
  let cy: number;
  if (upper) cy = 0.33 + 0.2 * round + 0.03 * spread - 0.05 * close + 0.12 * dental;
  else {
    cy = -0.32 - 0.1 * round + 0.1 * close + 0.24 * dental;
    cx -= 0.55 * dental;
  }
  const rx = (upper ? 0.36 : 0.4) * (1 - 0.12 * spread + 0.1 * round);
  const ry = (upper ? 0.3 : 0.32) * (1 - 0.18 * spread);
  return { cx, cy, rx, ry };
}
export const LIP_SECTION_N = 40;
export function writeEllipse(out: Float32Array, cx: number, cy: number, rx: number, ry: number) {
  out[0] = cx;
  out[1] = cy;
  out[2] = SECTION_Z;
  for (let i = 0; i <= LIP_SECTION_N; i++) {
    const a = (i / LIP_SECTION_N) * Math.PI * 2;
    out[(i + 1) * 3] = cx + rx * Math.cos(a);
    out[(i + 1) * 3 + 1] = cy + ry * Math.sin(a);
    out[(i + 1) * 3 + 2] = SECTION_Z;
  }
}
export function dynamicEllipse() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((LIP_SECTION_N + 2) * 3), 3));
  const idx: number[] = [];
  for (let i = 1; i <= LIP_SECTION_N; i++) idx.push(0, i, i + 1);
  g.setIndex(idx);
  return g;
}
