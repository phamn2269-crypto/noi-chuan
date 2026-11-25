// Mô hình thật /models/vocal_tract.glb (nén Draco). Yêu cầu trong GLB:
//  - mesh đặt tên theo data/phonemes.json → parts (tongue, lip_upper, soft_palate, ...)
//  - morph targets đặt tên theo tham số: tongueTipUp, tongueTipCurl, tongueTipDown, tongueBodyUp,
//    tongueBodyFront, tongueBodyBack, tongueBackUp, tongueGroove, tongueSidesDown, lipRound, lipSpread,
//    lipClose, lipDental, (tùy chọn) jawOpen, velumLower
//  - hoặc node/xương "jaw_pivot" và "velum_pivot" (xoay quanh trục z)
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { asset } from "@/lib/utils";
import { dampPose, poseOf, type FullPose } from "./rig";
import { expandPose, jawAngle, velumAngle } from "./anatomy";
import type { MouthDriver } from "./driver";
import type { ViewMode } from "./VocalTract";

export function GlbTract({ driver, view, highlight }: { driver: MouthDriver; view: ViewMode; highlight: string[] }) {
  const { scene } = useGLTF(asset("models/vocal_tract.glb"), asset("draco/"));
  const cur = useMemo<FullPose>(() => poseOf("rest"), []);
  const meshes = useMemo(() => {
    const list: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh);
    });
    return list;
  }, [scene]);
  const jaw = useMemo(() => scene.getObjectByName("jaw_pivot"), [scene]);
  const velum = useMemo(() => scene.getObjectByName("velum_pivot"), [scene]);

  useEffect(() => {
    for (const m of meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        mat.side = THREE.DoubleSide;
        if (/skin|face|head/i.test(m.name)) {
          (mat as THREE.MeshStandardMaterial).transparent = view !== "side";
          (mat as THREE.MeshStandardMaterial).opacity = view === "side" ? 1 : 0.15;
          mat.depthWrite = view === "side";
        }
        mat.needsUpdate = true;
      }
    }
  }, [meshes, view]);

  useFrame((state, dt) => {
    dampPose(cur, driver.target(), driver.slow ? 7 : 16, Math.min(dt, 0.05));
    const ep = expandPose(cur) as Record<string, number>;
    if (jaw) jaw.rotation.z = jawAngle(cur.jawOpen);
    if (velum) velum.rotation.z = velumAngle(cur.velumLower);
    const pulse = 0.35 + 0.35 * Math.sin(state.clock.elapsedTime * 4.2);
    for (const m of meshes) {
      if (m.morphTargetDictionary && m.morphTargetInfluences)
        for (const [k, i] of Object.entries(m.morphTargetDictionary)) m.morphTargetInfluences[i] = ep[k] ?? 0;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat?.emissive) {
        const lit = highlight.some((h) => m.name === h || m.name.startsWith(h.split("_")[0] + "_") && h.startsWith("tongue"));
        mat.emissive.set("#7ef0ff");
        mat.emissiveIntensity = lit ? pulse * 0.55 : 0;
      }
    }
  });
  return <primitive object={scene} />;
}
