import { describe, expect, it } from "vitest";
import { estimateTimings, mispronounce, normalizeText, parseSyllable, poseTrack, stripDiacritics, swapOnset, syllableVisemes, syllables } from "@/lib/vietnamese";

describe("tách phụ âm đầu", () => {
  it.each([
    ["nón", "n", "ón"],
    ["lá", "l", "á"],
    ["trâu", "tr", "âu"],
    ["chanh", "ch", "anh"],
    ["nghé", "ngh", "é"],
    ["nhà", "nh", "à"],
    ["xôi", "x", "ôi"],
    ["sương", "s", "ương"],
    ["ăn", "", "ăn"],
    ["gì", "gi", "ì"],
    ["quả", "qu", "ả"],
  ])("%s → %s + %s", (syl, onset, rest) => {
    expect(parseSyllable(syl)).toEqual({ onset, rest });
  });
  it("không nhầm nh/ng thành n", () => {
    expect(parseSyllable("nhà").onset).toBe("nh");
    expect(parseSyllable("ngủ").onset).toBe("ng");
  });
});

describe("đổi phụ âm đầu (mô phỏng ngọng)", () => {
  it("swapOnset", () => {
    expect(swapOnset("nón", "n", "l")).toBe("lón");
    expect(swapOnset("trâu", "tr", "ch")).toBe("châu");
    expect(swapOnset("nhà", "n", "l")).toBe("nhà"); // nh không phải n
  });
  it("mispronounce cả câu", () => {
    expect(mispronounce("Nắng lên, lúa chín vàng.", "n", "l")).toBe("lắng lên lúa chín vàng");
  });
});

describe("chuẩn hóa", () => {
  it("bỏ dấu câu, chữ thường, NFC", () => {
    expect(normalizeText("  Nàng TIÊN, đội nón lá! ")).toBe("nàng tiên đội nón lá");
    expect(syllables("Sáng sớm…")).toEqual(["sáng", "sớm"]);
  });
  it("bỏ dấu", () => expect(stripDiacritics("Đường nước")).toBe("Duong nuoc"));
});

describe("khẩu hình (viseme)", () => {
  it("âm đầu quyết định tư thế đầu tiên", () => {
    expect(syllableVisemes("nón")[0].pose).toBe("n");
    expect(syllableVisemes("lá")[0].pose).toBe("l");
    expect(syllableVisemes("trâu")[0].pose).toBe("tr");
    expect(syllableVisemes("chè")[0].pose).toBe("ch");
    expect(syllableVisemes("sẻ")[0].pose).toBe("s");
    expect(syllableVisemes("xe")[0].pose).toBe("x");
    expect(syllableVisemes("mẹ")[0].pose).toBe("m");
  });
  it("trọng số mỗi âm tiết cộng lại ≈ 1", () => {
    for (const s of ["nón", "trường", "xoài", "a", "lưỡi"]) {
      const sum = syllableVisemes(s).reduce((a, k) => a + k.weight, 0);
      expect(sum).toBeGreaterThan(0.5);
      expect(sum).toBeLessThanOrEqual(1.0001);
    }
  });
  it("mốc thời gian tăng dần, chuỗi tư thế bắt đầu và kết thúc ở rest", () => {
    const t = estimateTimings("Nắng lên, lúa chín vàng.");
    expect(t).toHaveLength(5);
    for (let i = 1; i < t.length; i++) expect(t[i].start).toBeGreaterThanOrEqual(t[i - 1].end);
    const track = poseTrack(t);
    expect(track[0].pose).toBe("rest");
    expect(track[track.length - 1].pose).toBe("rest");
    expect(track[1].pose).toBe("n");
  });
});
