import { describe, expect, it } from "vitest";
import { scorePronunciation } from "@/lib/scoring";
import type { RecordingResult } from "@/lib/recorder";

const rec = (transcripts: string[], extra: Partial<RecordingResult> = {}): RecordingResult => ({
  transcripts,
  confidences: transcripts.map(() => 0.9),
  blob: null,
  peak: 0.6,
  speechMs: 800,
  durationMs: 1500,
  srSupported: true,
  srOnly: false,
  ...extra,
});

describe("scorePronunciation", () => {
  it("đọc đúng → 100 điểm", async () => {
    const r = await scorePronunciation(rec(["nón"]), "nón");
    expect(r).toMatchObject({ status: "ok", correct: true, score: 100, wrongSound: null });
  });

  it("nón → lón: phát hiện đọc nhầm n thành l, góp ý xưng con", async () => {
    const r = await scorePronunciation(rec(["lón"]), "nón");
    expect(r.correct).toBe(false);
    expect(r.targetSound).toBe("n");
    expect(r.wrongSound).toBe("l");
    expect(r.feedback).toContain('Con đọc "nón" thành "lón"');
    expect(r.feedback).toContain("lợi trên");
  });

  it("nhận dạng sai thanh do 'tự sửa' (lón → lớn) vẫn nhận ra lỗi l/n", async () => {
    const r = await scorePronunciation(rec(["lớn"]), "nón");
    expect(r.wrongSound).toBe("l");
  });

  it.each([
    ["trâu", "châu", "tr", "ch"],
    ["sinh", "xinh", "s", "x"],
    ["chanh", "tranh", "ch", "tr"],
  ])("%s đọc thành %s", async (target, heard, t, w) => {
    const r = await scorePronunciation(rec([heard]), target);
    expect(r).toMatchObject({ correct: false, targetSound: t, wrongSound: w });
  });

  it("câu: chấm theo âm tiết, chỉ ra âm tiết sai", async () => {
    const r = await scorePronunciation(rec(["lắng lên lúa chín vàng"]), "Nắng lên, lúa chín vàng.");
    expect(r.correct).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.errors).toEqual([{ expected: "nắng", heard: "lắng" }]);
  });

  it("chọn phương án nhận dạng khớp nhất trong các phương án", async () => {
    const r = await scorePronunciation(rec(["nón lá", "lón lá"]), "nón lá");
    expect(r.correct).toBe(true);
  });

  it("nhỏ quá / không có tiếng → nhắc đọc lại, không chấm", async () => {
    const r = await scorePronunciation(rec([], { peak: 0.02, speechMs: 0 }), "nón");
    expect(r.status).toBe("retry");
  });

  it("chế độ chỉ nhận dạng: có chữ thì vẫn chấm dù không đo được âm lượng", async () => {
    const r = await scorePronunciation(rec(["nón"], { peak: 0, speechMs: 0, srOnly: true }), "nón");
    expect(r.correct).toBe(true);
  });

  it("trình duyệt không hỗ trợ nhận dạng → để người lớn chấm", async () => {
    const r = await scorePronunciation(rec([], { srSupported: false }), "nón");
    expect(r.status).toBe("unsupported");
  });

  it("bị từ chối quyền micro → hướng dẫn bật quyền", async () => {
    const r = await scorePronunciation(rec([], { srError: "not-allowed" }), "nón");
    expect(r.status).toBe("retry");
    expect(r.feedback).toContain("cho phép micro");
  });

  it("chế độ Teen: không xưng con", async () => {
    const r = await scorePronunciation(rec(["lón"]), "nón", { mode: "teen" });
    expect(r.feedback).not.toContain("Con ");
  });
});
