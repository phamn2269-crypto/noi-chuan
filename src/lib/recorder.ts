// Thu âm: getUserMedia + AnalyserNode (mức âm lượng thật cho vòng sóng) + MediaRecorder (gửi API chấm điểm nếu có)
// + SpeechRecognition vi-VN (nhận dạng trên thiết bị/trình duyệt). File ghi âm KHÔNG được lưu lại.
type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SRCtor = new () => SR;

export function speechRecognitionCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export const recognitionSupported = () => !!speechRecognitionCtor();
export const micSupported = () => !!navigator.mediaDevices?.getUserMedia;

export interface RecordingResult {
  transcripts: string[];
  confidences: number[];
  blob: Blob | null;
  peak: number; // 0..1
  speechMs: number; // thời gian có tiếng
  durationMs: number;
  srError?: string;
  srSupported: boolean;
}

export interface RecorderHandle {
  stop: () => void;
  result: Promise<RecordingResult>;
}

export interface RecordOptions {
  maxMs: number;
  onLevel?: (level: number) => void;
  /** tự dừng sau khoảng lặng này (ms) khi đã có tiếng */
  silenceMs?: number;
  wantBlob?: boolean;
}

export async function startRecording(opts: RecordOptions): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  if (opts.wantBlob && typeof MediaRecorder !== "undefined") {
    try {
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.start();
    } catch {
      recorder = null;
    }
  }

  const Ctor = speechRecognitionCtor();
  const transcripts: string[] = [];
  const confidences: number[] = [];
  let srError: string | undefined;
  let srEnded = !Ctor;
  let srEndResolve: () => void = () => {};
  const srEnd = new Promise<void>((r) => (srEndResolve = r));
  let sr: SR | null = null;
  if (Ctor) {
    sr = new Ctor();
    sr.lang = "vi-VN";
    sr.interimResults = false;
    sr.maxAlternatives = 5;
    sr.continuous = false;
    sr.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        for (let k = 0; k < res.length; k++) {
          transcripts.push(res[k].transcript);
          confidences.push(res[k].confidence);
        }
      }
    };
    sr.onerror = (e) => (srError = e.error);
    sr.onend = () => {
      srEnded = true;
      srEndResolve();
    };
    try {
      sr.start();
    } catch {
      srEnded = true;
      srEndResolve();
    }
  } else srEndResolve();

  const t0 = performance.now();
  let peak = 0;
  let speechMs = 0;
  let lastVoice = 0;
  let last = t0;
  let stopped = false;
  let raf = 0;
  let resolveResult!: (r: RecordingResult) => void;
  const result = new Promise<RecordingResult>((r) => (resolveResult = r));

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    opts.onLevel?.(0);
    const blobP = new Promise<Blob | null>((res) => {
      if (!recorder || recorder.state === "inactive") return res(null);
      recorder.onstop = () => res(new Blob(chunks, { type: recorder!.mimeType }));
      recorder.stop();
    });
    try {
      sr?.stop();
    } catch {
      /* noop */
    }
    // chờ kết quả nhận dạng tối đa 1,8 s (phản hồi < 2 s)
    await Promise.race([srEnd, new Promise((r) => setTimeout(r, 1800))]);
    if (!srEnded) sr?.abort();
    const blob = await blobP;
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
    resolveResult({ transcripts, confidences, blob, peak, speechMs, durationMs: performance.now() - t0, srError, srSupported: !!Ctor });
  };

  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const level = Math.min(1, rms * 6);
    peak = Math.max(peak, level);
    const now = performance.now();
    if (level > 0.12) {
      speechMs += now - last;
      lastVoice = now;
    }
    last = now;
    opts.onLevel?.(level);
    const silence = opts.silenceMs ?? 1100;
    if (now - t0 > opts.maxMs || (lastVoice && speechMs > 250 && now - lastVoice > silence)) {
      stop();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop, result };
}
