// Thử Thách Nói Nhanh (Teen): đọc chuỗi từ dễ nhầm càng nhanh càng đúng; bảng xếp hạng tuần của lớp (chỉ biệt danh).
import { useMemo, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { MicButton } from "@/components/MicButton";
import { usePractice } from "@/hooks/usePractice";
import { feedbackFx } from "@/lib/fx";
import { useApp } from "@/store/app";
import { gamePairs, type GameProps } from "./shared";

const ROUNDS = 4;

export default function NoiNhanh({ pairId, difficulty, onFinish }: GameProps) {
  const chains = useMemo(
    () =>
      Array.from({ length: ROUNDS }, () => {
        const ps = gamePairs(pairId, difficulty, 2);
        // chuỗi xen kẽ: làng nàng lo no ...
        return ps.flatMap((p) => [p.options[0].text, p.options[1].text, p.options[1].text, p.options[0].text]).slice(0, 4 + difficulty * 2);
      }),
    [pairId, difficulty],
  );
  const [r, setR] = useState(0);
  const [results, setResults] = useState<{ ok: number; n: number; sec: number }[]>([]);
  const t0 = useRef(0);
  const chain = chains[r];
  const pr = usePractice({
    onResult: (res) => {
      if (res.status !== "ok") return;
      const sec = Math.max(0.5, (performance.now() - t0.current) / 1000 - 1);
      const ok = chain.length - res.errors.length;
      feedbackFx(res.errors.length === 0);
      const next = [...results, { ok, n: chain.length, sec }];
      setResults(next);
      setTimeout(() => {
        pr.reset();
        if (r + 1 >= ROUNDS) {
          const totalOk = next.reduce((a, x) => a + x.ok, 0);
          const totalN = next.reduce((a, x) => a + x.n, 0);
          const totalSec = next.reduce((a, x) => a + x.sec, 0);
          const points = Math.round((totalOk / totalSec) * 60); // từ đúng / phút
          useApp.getState().setRecord(`noi-nhanh-${weekKey()}`, points);
          useApp.getState().setRecord("noi-nhanh-best", points);
          if (Math.max(...next.map((x) => x.ok)) >= 8) useApp.getState().awardBadge("speed-talker");
          onFinish({ correct: totalOk, total: totalN, xp: 15 + totalOk * 2, note: `${points} từ đúng/phút` });
        } else setR(r + 1);
      }, 1100);
    },
  });
  const last = results[r];
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex justify-between text-sm font-bold">
        <span>
          Lượt {r + 1}/{ROUNDS}
        </span>
        <span className="flex items-center gap-1">
          <Timer className="h-4 w-4" /> Đọc liền một hơi
        </span>
      </div>
      <div className="bento mt-3 flex flex-wrap justify-center gap-2 bg-gradient-to-br from-slate-800 to-indigo-900 p-6 text-white">
        {chain.map((w, k) => (
          <span key={k} className="rounded-xl bg-white/10 px-3 py-1.5 text-2xl font-extrabold">
            {w}
          </span>
        ))}
      </div>
      {last && (
        <p className="mt-3 text-center font-bold">
          {last.ok}/{last.n} đúng · {last.sec.toFixed(1)} giây
        </p>
      )}
      {pr.result?.status === "retry" && <p className="mt-3 text-center font-semibold">{pr.result.feedback}</p>}
      {pr.error && <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold">{pr.error}</p>}
      <div className="mt-auto flex justify-center">
        <MicButton
          state={pr.state}
          level={pr.level}
          onPress={() => {
            if (pr.state === "idle") {
              pr.reset();
              t0.current = performance.now();
            }
            pr.toggle(chain.join(" "));
          }}
          label="Bấm rồi đọc thật nhanh!"
        />
      </div>
    </div>
  );
}
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7)}`;
}
