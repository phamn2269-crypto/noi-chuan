import { beforeEach, describe, expect, it } from "vitest";
import { levelOf, petStage, useApp } from "@/store/app";
import { nextDifficulty, recommendedPair } from "@/lib/plan";
import { allAudioIds, lessons, textOf } from "@/lib/content";

describe("cấp độ & thú cưng", () => {
  it("levelOf tăng dần, XP cần mỗi cấp lớn dần", () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: 100 });
    expect(levelOf(100).level).toBe(2);
    expect(levelOf(99).level).toBe(1);
    expect(levelOf(225).level).toBe(3);
  });
  it("petStage", () => {
    expect([0, 12, 30, 60].map(petStage)).toEqual([1, 2, 3, 4]);
  });
});

describe("độ khó tự điều chỉnh", () => {
  it("≥85% tăng, <50% giảm, giữ trong 1..3", () => {
    expect(nextDifficulty(1, 9, 10)).toBe(2);
    expect(nextDifficulty(3, 10, 10)).toBe(3);
    expect(nextDifficulty(2, 2, 10)).toBe(1);
    expect(nextDifficulty(1, 0, 10)).toBe(1);
    expect(nextDifficulty(2, 7, 10)).toBe(2);
  });
});

describe("store: buổi luyện, chuỗi ngày, huy hiệu, xóa dữ liệu", () => {
  beforeEach(() => {
    localStorage.clear();
    useApp.getState().deleteAllData();
    useApp.getState().setParent({ name: "A", email: "a@b.c", pin: "1234", consentRecording: true, consentCamera: false, consentAt: "" });
    useApp.getState().addChild({ name: "An", nickname: "Sóc", grade: 2, mode: "kid", mascot: "sao", voice: "bac" });
  });
  const prog = () => useApp.getState().progress[useApp.getState().activeChildId!];

  it("hoàn thành buổi đầu → XP, chuỗi 1 ngày, huy hiệu Bước đầu tiên", () => {
    const { newBadges } = useApp.getState().completeSession({ kind: "lesson", activity: "l-n", pairId: "l-n", correct: 4, total: 5, durationSec: 300, xp: 80 });
    expect(newBadges).toContain("first-step");
    expect(prog().xp).toBe(80);
    expect(prog().streak).toBe(1);
    expect(prog().stars).toBe(2);
  });

  it("ghi lượt đọc theo từ và theo cặp", () => {
    const st = useApp.getState();
    st.recordAttempt("ln-w-01", "l-n", true);
    st.recordAttempt("ln-w-01", "l-n", false, "lón");
    expect(prog().wordStats["ln-w-01"]).toMatchObject({ a: 2, c: 1, heard: "lón" });
    expect(prog().pairStats["l-n"]).toEqual({ a: 2, c: 1 });
  });

  it("cặp yếu nhất được gợi ý trước", () => {
    const st = useApp.getState();
    for (let i = 0; i < 6; i++) st.recordAttempt("x", "ch-tr", i < 1);
    for (let i = 0; i < 6; i++) st.recordAttempt("y", "l-n", true);
    for (let i = 0; i < 6; i++) st.recordAttempt("z", "s-x", i < 4);
    expect(recommendedPair(prog())).toBe("ch-tr");
  });

  it("rương quà chỉ mở 1 lần mỗi ngày", () => {
    const st = useApp.getState();
    expect(st.openChest()).not.toBeNull();
    expect(useApp.getState().openChest()).toBeNull();
  });

  it("phụ huynh xóa dữ liệu của con", () => {
    const id = useApp.getState().activeChildId!;
    useApp.getState().deleteChildData(id);
    expect(useApp.getState().progress[id]).toBeUndefined();
    expect(useApp.getState().children).toHaveLength(0);
  });
});

describe("dữ liệu âm thanh", () => {
  it("mọi mục đều có văn bản để tạo giọng mẫu, id không trùng", () => {
    const ids = allAudioIds();
    expect(new Set(ids.map((x) => x.id)).size).toBe(ids.length);
    for (const x of ids) expect(textOf(x.id)).toBe(x.text);
    expect(ids.length).toBeGreaterThan(lessons.items.length);
  });
});
