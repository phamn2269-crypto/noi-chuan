// Hệ thống tư thế âm: tham số morph target / xương, nội suy mượt, đọc mốc thời gian.
import { phonemes } from "@/lib/content";
import type { PoseParams } from "@/lib/types";

export const PARAM_KEYS = [
  "jawOpen",
  "lipRound",
  "lipSpread",
  "lipClose",
  "lipDental",
  "tongueTipUp",
  "tongueTipCurl",
  "tongueTipDown",
  "tongueBodyUp",
  "tongueBodyFront",
  "tongueBackUp",
  "tongueGroove",
  "tongueSidesDown",
  "velumLower",
] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];
export type FullPose = Record<ParamKey, number>;

export const zeroPose = (): FullPose => Object.fromEntries(PARAM_KEYS.map((k) => [k, 0])) as FullPose;

/** Tư thế đầy đủ của một âm (thiếu tham số = 0). Không có trong phonemes.json → rest. */
export function poseOf(name: string): FullPose {
  const p = zeroPose();
  const src: PoseParams = phonemes[name]?.params ?? phonemes.rest.params;
  for (const k of PARAM_KEYS) p[k] = src[k] ?? 0;
  return p;
}

export function mixPose(a: FullPose, b: FullPose, t: number): FullPose {
  const out = zeroPose();
  for (const k of PARAM_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/** Tiến dần `cur` về `target` (giảm chấn theo thời gian, không phụ thuộc fps). */
export function dampPose(cur: FullPose, target: FullPose, lambda: number, dt: number) {
  const f = 1 - Math.exp(-lambda * dt);
  for (const k of PARAM_KEYS) cur[k] += (target[k] - cur[k]) * f;
}

export type PoseTrack = { t: number; pose: string }[];

/** Tư thế tại thời điểm t, có đồng cấu âm nhẹ (hòa dần sang âm kế tiếp ở 35% cuối). */
export function sampleTrack(track: PoseTrack, t: number): FullPose {
  if (!track.length) return poseOf("rest");
  let i = 0;
  while (i < track.length - 1 && track[i + 1].t <= t) i++;
  const cur = track[i];
  const next = track[i + 1];
  if (!next) return poseOf(cur.pose);
  const span = Math.max(0.001, next.t - cur.t);
  const u = (t - cur.t) / span;
  const blendStart = 0.65;
  if (u < blendStart) return poseOf(cur.pose);
  const w = (u - blendStart) / (1 - blendStart);
  return mixPose(poseOf(cur.pose), poseOf(next.pose), w * w * 0.6);
}

export function poseAt(track: PoseTrack, t: number) {
  let i = 0;
  while (i < track.length - 1 && track[i + 1].t <= t) i++;
  return track[i]?.pose ?? "rest";
}
