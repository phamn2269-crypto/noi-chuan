// Bộ điều khiển tư thế cho một mô hình khẩu hình: tư thế tĩnh, hoặc phát theo mốc thời gian của audio.
import { poseAt, poseOf, sampleTrack, type FullPose, type PoseTrack } from "./rig";

export class MouthDriver {
  staticPose = "rest";
  track: PoseTrack | null = null;
  clock: (() => number) | null = null;
  /** true khi đang phát chậm 0,5 – mô hình chuyển tư thế chậm hơn */
  slow = false;
  private listeners = new Set<() => void>();

  setPose(p: string) {
    this.staticPose = p;
    this.track = null;
    this.clock = null;
    this.emit();
  }
  /** Phát theo track (giây trên bản ghi 0,75). clock() trả về thời gian hiện tại theo cùng thang. */
  play(track: PoseTrack, clock: () => number, slow = false) {
    this.track = track;
    this.clock = clock;
    this.slow = slow;
    this.emit();
  }
  stop(restPose?: string) {
    this.track = null;
    this.clock = null;
    this.slow = false;
    if (restPose) this.staticPose = restPose;
    this.emit();
  }
  get playing() {
    return !!(this.track && this.clock);
  }
  currentPoseName(): string {
    if (this.track && this.clock) return poseAt(this.track, this.clock());
    return this.staticPose;
  }
  target(): FullPose {
    if (this.track && this.clock) return sampleTrack(this.track, this.clock());
    return poseOf(this.staticPose);
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }
}
