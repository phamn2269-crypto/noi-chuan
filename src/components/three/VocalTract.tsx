// Mô hình khoang miệng TẠM (khối cơ bản) – đúng tên bộ phận, có morph targets để thay GLB sau.
//  - Mặt cắt dọc (mặc định): mỗi bộ phận có hình mặt cắt 2D tô phẳng như hình giải phẫu trong sách,
//    khối 3D phía sau được cắt bởi SECTION_PLANE (lộ ra khi xoay mô hình).
//  - Nhìn thẳng: môi, răng, lợi, lưỡi.  - Xuyên thấu: da bán trong suốt.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  buildLip,
  buildMandible,
  buildTeeth,
  buildTongue,
  archTube,
  slab,
  PROFILE,
  JAW_PIVOT,
  VELUM_PIVOT,
  jawAngle,
  velumAngle,
  TONGUE_JAW_FOLLOW,
  expandPose,
  tongueLandmarks,
  buildTongueSection,
  writeTongueSection,
  shapeSection,
  ellipseSection,
  roundedRectSection,
  lipSectionParams,
  dynamicEllipse,
  writeEllipse,
} from "./anatomy";
import { dampPose, poseOf, type FullPose } from "./rig";
import type { MouthDriver } from "./driver";

export type ViewMode = "side" | "front" | "xray";

const C = {
  skin: "#f2c6a6",
  skinCut: "#e9b195",
  mucosa: "#ea9098",
  mucosaCut: "#d8828c",
  palateCut: "#e39aa1",
  tongue: "#e2707d",
  tongueCut: "#d9616f",
  lip: "#df7c85",
  lipCut: "#d76a76",
  gum: "#f3a5ab",
  teeth: "#f5ecd9",
  teethCut: "#f7f0e2",
  bone: "#efe3cb",
  boneCut: "#e8d9b8",
  nasal: "#bfe7ff",
  nasalCut: "#3d4782",
  airway: "#43182a",
  pharynxCut: "#cf7681",
  glow: "#7ef0ff",
};

function tissue(color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  // Niêm mạc hồng ướt: clearcoat cho độ bóng ướt, sheen giả lập tán xạ dưới bề mặt nhẹ.
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    sheen: 0.6,
    sheenColor: new THREE.Color("#ffd0d0"),
    sheenRoughness: 0.5,
    ...opts,
  });
}

/** Mặt phẳng cắt dọc: giữ phần z ≤ −0.02 (nửa xa camera). Hình mặt cắt nằm ở z = −0.004 nên luôn ở trước. */
export const SECTION_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, -1), -0.02);

interface Part {
  name: string;
  geo?: THREE.BufferGeometry; // khối 3D (không có = chỉ có mặt cắt)
  mat: THREE.MeshPhysicalMaterial;
  section?: THREE.BufferGeometry;
  sectionColor?: string;
  group: "static" | "jaw" | "tongue" | "velum";
  morphKeys?: string[];
  role?: "skin" | "nasal" | "airway" | "bone";
}

export interface TractState {
  pose: FullPose;
  landmarks: Record<string, THREE.Vector3>;
}

/** Vị trí neo nhãn cho bộ phận tĩnh. */
export const STATIC_ANCHORS: Record<string, [number, number, number]> = {
  lip_upper: [4.55, 0.45, 0],
  teeth_upper: [3.7, 0.55, 0.15],
  alveolar_ridge: [3.15, 1.22, 0],
  hard_palate: [1.6, 1.98, 0],
  nasal_cavity: [1.6, 2.95, 0],
  pharynx: [-1.75, -0.6, 0],
  epiglottis: [-0.85, -1.6, 0],
  gum: [3.5, 0.95, 0.3],
};

/** Bộ phận hiện khi nhìn thẳng. */
const FRONT_PARTS = ["lip_upper", "lip_lower", "teeth_upper", "teeth_lower", "gum", "gum_lower", "tongue"];
/** Thứ tự vẽ mặt cắt: phần vẽ sau đè lên phần vẽ trước. */
const SECTION_ORDER = [
  "skin_head", "skin_jaw", "airway", "nasal_cavity", "pharynx", "larynx", "epiglottis", "jaw", "gum_lower", "teeth_lower",
  "hard_palate", "alveolar_ridge", "gum", "teeth_upper", "soft_palate", "uvula", "tongue", "lip_upper", "lip_lower",
];

export function VocalTract({
  driver,
  view,
  highlight,
  stateRef,
}: {
  driver: MouthDriver;
  view: ViewMode;
  highlight: string[];
  stateRef?: React.MutableRefObject<TractState | null>;
}) {
  const parts = useMemo<Part[]>(() => {
    const tongue = buildTongue();
    const lipU = buildLip(true);
    const lipL = buildLip(false);
    const ridge = { y: 1.02, frontX: 3.62, back: 2.85, halfW: 1.35, rx: 0.2, ry: 0.2, t0: -0.5, t1: 0.5, xOffset: -0.42 };
    const gumU = { y: 0.92, frontX: 3.62, back: 2.85, halfW: 1.35, rx: 0.2, ry: 0.24, t0: -0.96, t1: 0.96, xOffset: -0.14 };
    const gumL = { y: -0.92, frontX: 3.44, back: 2.85, halfW: 1.25, rx: 0.2, ry: 0.24, t0: -0.96, t1: 0.96, xOffset: -0.14 };
    const skinMat = () => tissue(C.skin, { roughness: 0.6, clearcoat: 0.1 });
    const teethMat = () => tissue(C.teeth, { roughness: 0.22, clearcoat: 0.9, sheen: 0 });
    return [
      { name: "skin_head", geo: slab(PROFILE.headUpper, 2.3, 0.25), section: shapeSection(PROFILE.headUpper), sectionColor: C.skinCut, mat: skinMat(), group: "static", role: "skin" },
      { name: "skin_jaw", geo: slab(PROFILE.jawSkin, 2.2, 0.25, false), section: shapeSection(PROFILE.jawSkin, false), sectionColor: C.skinCut, mat: skinMat(), group: "jaw", role: "skin" },
      { name: "airway", section: shapeSection(PROFILE.airway), sectionColor: C.airway, mat: tissue(C.airway), group: "static", role: "airway" },
      {
        name: "nasal_cavity",
        geo: slab(PROFILE.nasal, 0.6, 0.15),
        section: shapeSection(PROFILE.nasal),
        sectionColor: C.nasalCut,
        mat: tissue(C.nasal, { transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.2, clearcoat: 0, sheen: 0 }),
        group: "static",
        role: "nasal",
      },
      { name: "pharynx", geo: slab(PROFILE.pharynx, 1.0, 0.15), section: shapeSection(PROFILE.pharynx), sectionColor: C.pharynxCut, mat: tissue("#dc7b84"), group: "static" },
      { name: "larynx", geo: slab(PROFILE.larynx, 0.7, 0.1), section: shapeSection(PROFILE.larynx), sectionColor: C.pharynxCut, mat: tissue("#d97a83"), group: "static" },
      { name: "epiglottis", geo: slab(PROFILE.epiglottis, 0.45, 0.05), section: shapeSection(PROFILE.epiglottis), sectionColor: C.mucosaCut, mat: tissue("#e88f96"), group: "static" },
      { name: "hard_palate", geo: slab(PROFILE.hardPalate, 1.15, 0.12), section: shapeSection(PROFILE.hardPalate), sectionColor: C.palateCut, mat: tissue(C.mucosa), group: "static" },
      { name: "alveolar_ridge", geo: archTube(ridge), section: ellipseSection(3.62 - 0.42, ridge.y, 0.2, 0.2), sectionColor: "#ee9aa1", mat: tissue(C.gum), group: "static" },
      { name: "gum", geo: archTube(gumU), section: ellipseSection(3.62 - 0.14, gumU.y, 0.2, 0.24), sectionColor: "#ee9aa1", mat: tissue(C.gum), group: "static" },
      { name: "teeth_upper", geo: buildTeeth(true), section: roundedRectSection(3.64, 0.48, 0.22, 0.92, 0.08, 0.18), sectionColor: C.teethCut, mat: teethMat(), group: "static" },
      { name: "lip_upper", geo: lipU.geo, section: dynamicEllipse(), sectionColor: C.lipCut, mat: tissue(C.lip, { roughness: 0.35 }), group: "static", morphKeys: lipU.keys },
      // hàm dưới (xoay quanh khớp thái dương–hàm)
      { name: "jaw", geo: buildMandible(), section: ellipseSection(3.55, -1.55, 0.42, 0.85), sectionColor: C.boneCut, mat: tissue(C.bone, { roughness: 0.5, clearcoat: 0.2, sheen: 0 }), group: "jaw", role: "bone" },
      { name: "gum_lower", geo: archTube(gumL), section: ellipseSection(3.44 - 0.14, gumL.y, 0.2, 0.24), sectionColor: "#ee9aa1", mat: tissue(C.gum), group: "jaw" },
      { name: "teeth_lower", geo: buildTeeth(false), section: roundedRectSection(3.42, -0.5, 0.22, 0.9, 0.08, -0.18), sectionColor: C.teethCut, mat: teethMat(), group: "jaw" },
      { name: "lip_lower", geo: lipL.geo, section: dynamicEllipse(), sectionColor: C.lipCut, mat: tissue(C.lip, { roughness: 0.35 }), group: "jaw", morphKeys: lipL.keys },
      // lưỡi
      { name: "tongue", geo: tongue.geo, section: buildTongueSection(), sectionColor: C.tongueCut, mat: tissue(C.tongue, { roughness: 0.55, clearcoat: 0.45 }), group: "tongue", morphKeys: tongue.keys },
      // vòm mềm + lưỡi gà (tọa độ cục bộ quanh khớp vòm mềm)
      { name: "soft_palate", geo: slab(PROFILE.velum, 0.8, 0.1), section: shapeSection(PROFILE.velum), sectionColor: C.mucosaCut, mat: tissue("#e5858f"), group: "velum" },
      {
        name: "uvula",
        geo: new THREE.CapsuleGeometry(0.12, 0.32, 6, 12).translate(-1.38, -0.5, 0),
        section: roundedRectSection(-1.38, -0.5, 0.24, 0.56, 0.12, 0),
        sectionColor: C.mucosaCut,
        mat: tissue("#e47c87"),
        group: "velum",
      },
    ];
  }, []);

  const section = view === "side";
  const jawRef = useRef<THREE.Group>(null);
  const tongueRef = useRef<THREE.Group>(null);
  const velumRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<Record<string, THREE.Mesh | null>>({});
  const cur = useRef<FullPose>(poseOf("rest"));
  const glow = useMemo(() => new THREE.Color(C.glow), []);
  const sectionMats = useMemo(
    () =>
      Object.fromEntries(
        parts
          .filter((p) => p.section)
          .map((p) => [p.name, new THREE.MeshBasicMaterial({ color: p.sectionColor, side: THREE.DoubleSide, depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true })]),
      ),
    [parts],
  );
  const sectionBase = useMemo(() => Object.fromEntries(parts.filter((p) => p.section).map((p) => [p.name, new THREE.Color(p.sectionColor)])), [parts]);
  const byName = useMemo(() => Object.fromEntries(parts.map((p) => [p.name, p])), [parts]);

  useEffect(() => {
    for (const part of parts) {
      part.mat.clippingPlanes = section ? [SECTION_PLANE] : [];
      if (part.role === "skin") {
        part.mat.transparent = !section;
        part.mat.opacity = section ? 1 : 0.12;
        part.mat.depthWrite = section;
      }
      part.mat.needsUpdate = true;
    }
  }, [parts, section]);

  const highlightSet = useMemo(() => {
    const s = new Set(highlight);
    if ([...s].some((h) => h.startsWith("tongue_"))) s.add("tongue");
    if (s.has("gum")) s.add("gum_lower");
    return s;
  }, [highlight]);

  useFrame((state, dt) => {
    dampPose(cur.current, driver.target(), driver.slow ? 7 : 16, Math.min(dt, 0.05));
    const p = cur.current;
    const ep = expandPose(p) as Record<string, number>;

    if (jawRef.current) jawRef.current.rotation.z = jawAngle(p.jawOpen);
    if (tongueRef.current) tongueRef.current.rotation.z = jawAngle(p.jawOpen) * TONGUE_JAW_FOLLOW;
    if (velumRef.current) velumRef.current.rotation.z = velumAngle(p.velumLower);

    const pulse = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 4.2));
    for (const part of parts) {
      const m = meshRefs.current[part.name];
      if (m && part.morphKeys && m.morphTargetInfluences) part.morphKeys.forEach((k, i) => (m.morphTargetInfluences![i] = ep[k] ?? 0));
      const lit = highlightSet.has(part.name);
      if (part.role === "nasal") {
        part.mat.opacity = lit ? 0.32 + 0.25 * pulse : 0.22;
        part.mat.emissive.copy(glow);
        part.mat.emissiveIntensity = lit ? pulse * 0.8 : 0.05;
      } else if (part.role !== "airway" && part.role !== "skin") {
        part.mat.emissive.copy(glow);
        part.mat.emissiveIntensity = lit ? pulse * 0.55 : 0;
      }
      const sm = sectionMats[part.name];
      if (sm) sm.color.copy(sectionBase[part.name]).lerp(glow, lit ? pulse * 0.5 : 0);
    }

    if (section) {
      // cập nhật mặt cắt động của lưỡi và môi
      const tg = byName.tongue.section!;
      writeTongueSection(p, (tg.getAttribute("position") as THREE.BufferAttribute).array as Float32Array);
      tg.getAttribute("position").needsUpdate = true;
      tg.computeBoundingSphere();
      for (const name of ["lip_upper", "lip_lower"] as const) {
        const g = byName[name].section!;
        const e = lipSectionParams(name === "lip_upper", p);
        writeEllipse((g.getAttribute("position") as THREE.BufferAttribute).array as Float32Array, e.cx, e.cy, e.rx, e.ry);
        g.getAttribute("position").needsUpdate = true;
        g.computeBoundingSphere();
      }
    }

    if (stateRef) {
      const lm = tongueLandmarks(p);
      const about = (pivot: THREE.Vector3, angle: number) =>
        new THREE.Matrix4()
          .makeTranslation(pivot.x, pivot.y, 0)
          .multiply(new THREE.Matrix4().makeRotationZ(angle))
          .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, 0));
      const rot = about(JAW_PIVOT, jawAngle(p.jawOpen) * TONGUE_JAW_FOLLOW);
      const jawM = about(JAW_PIVOT, jawAngle(p.jawOpen));
      const velM = new THREE.Matrix4().makeTranslation(VELUM_PIVOT.x, VELUM_PIVOT.y, 0).multiply(new THREE.Matrix4().makeRotationZ(velumAngle(p.velumLower)));
      const landmarks: Record<string, THREE.Vector3> = {};
      for (const [k, v] of Object.entries(lm)) landmarks[k] = v.applyMatrix4(rot);
      for (const [k, v] of Object.entries(STATIC_ANCHORS)) landmarks[k] = new THREE.Vector3(...v);
      landmarks.lip_lower = new THREE.Vector3(4.6, -0.5, 0).applyMatrix4(jawM);
      landmarks.teeth_lower = new THREE.Vector3(3.5, -0.6, 0.15).applyMatrix4(jawM);
      landmarks.jaw = new THREE.Vector3(3.7, -2.0, 0).applyMatrix4(jawM);
      landmarks.soft_palate = new THREE.Vector3(-0.7, 0.05, 0).applyMatrix4(velM);
      landmarks.uvula = new THREE.Vector3(-1.38, -0.7, 0).applyMatrix4(velM);
      stateRef.current = { pose: p, landmarks };
    }
  });

  const renderPart = (part: Part) => {
    const visible = section ? part.name !== "tongue" : view === "front" ? FRONT_PARTS.includes(part.name) : part.role !== "airway";
    return (
      <group key={part.name}>
        {part.geo && (
          <mesh
            name={part.name}
            ref={(m) => {
              // R3F gán geometry sau khi tạo Mesh → khởi tạo morph thủ công
              if (m && part.morphKeys && !m.morphTargetInfluences) m.updateMorphTargets();
              meshRefs.current[part.name] = m;
            }}
            geometry={part.geo}
            material={part.mat}
            visible={visible}
            renderOrder={section ? 100 : part.role === "skin" ? 10 : part.role === "nasal" ? 5 : 0}
          />
        )}
        {section && part.section && (
          <mesh geometry={part.section} material={sectionMats[part.name]} renderOrder={1 + SECTION_ORDER.indexOf(part.name) * 0.01} frustumCulled={false} />
        )}
      </group>
    );
  };

  return (
    <group>
      {parts.filter((p) => p.group === "static").map(renderPart)}
      <group position={JAW_PIVOT}>
        <group ref={jawRef}>
          <group position={JAW_PIVOT.clone().negate()}>{parts.filter((p) => p.group === "jaw").map(renderPart)}</group>
        </group>
      </group>
      <group position={JAW_PIVOT}>
        <group ref={tongueRef}>
          <group position={JAW_PIVOT.clone().negate()}>{parts.filter((p) => p.group === "tongue").map(renderPart)}</group>
        </group>
      </group>
      <group position={VELUM_PIVOT}>
        <group ref={velumRef}>{parts.filter((p) => p.group === "velum").map(renderPart)}</group>
      </group>
      {view === "front" && (
        // nền tối khoang miệng khi nhìn thẳng
        <mesh position={[2.9, -0.05, 0]} rotation-y={Math.PI / 2} scale={[1.05, 0.5, 1]}>
          <circleGeometry args={[1.5, 40]} />
          <meshBasicMaterial color="#3a1222" />
        </mesh>
      )}
    </group>
  );
}
