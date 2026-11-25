// Thu âm: getUserMedia + AnalyserNode (mức âm lượng thật cho vòng sóng) + MediaRecorder (gửi API chấm điểm nếu có)
// + SpeechRecognition vi-VN. File ghi âm KHÔNG được lưu lại.
//
// Độ bền trên điện thoại: một số máy (Chrome Android, Safari iOS) không cho nhận dạng giọng nói
// dùng micro cùng lúc với getUserMedia. Khi phát hiện xung đột, recorder tự chuyển sang
// "chế độ chỉ nhận dạng" (vòng sóng chạy theo sự kiện giọng nói) và ghi nhớ cho các lần sau.
type SRAlt = { transcript: string; confidence: number };
type SRResult = ArrayLike<SRAlt> & { isFinal: boolean };
type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SRResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onsoundstart: (() => void) | null;
};
type SRCtor = new () => SR;

export function speechRecognitionCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export const recognitionSupported = () => !!speechRecognitionCtor();
export const micSupported = () => !!navigator.mediaDevices?.getUserMedia || recognitionSupported();

const PREF_KEY = "noi-chuan-sr-only";
const preferSrOnly = () => {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
};
const setPreferSrOnly = () => {
  try {
    localStorage.setItem(PREF_KEY, "1");
  } catch {
    /* noop */
  }
};

export interface RecordingResult {
  transcripts: string[];
  confidences: number[];
  blob: Blob | null;
  peak: number; // 0..1
  speechMs: number; // thời gian có tiếng
  durationMs: number;
  srError?: string;
  srSupported: boolean;
  /** true nếu chạy ở chế độ chỉ nhận dạng (không đo được âm lượng thật) */
  srOnly: boolean;
}

export interface RecorderHandle {
  stop: () => void;
  result: Promise<RecordingResult>;
}

export interface RecordOptions {
  maxMs: number;
  onLevel?: (level: number) => void;
  /** chữ nhận dạng tạm thời (hiện "Cô đang nghe: …") */
  onPartial?: (text: string) => void;
  /** tự dừng sau khoảng lặng này (ms) khi đã có tiếng */
  silenceMs?: number;
  wantBlob?: boolean;
  /** câu dài: nghe liên tục, tự dừng theo khoảng lặng */
  long?: boolean;
}

/** Ghép kết quả nhiều đoạn (nghe liên tục) thành các phương án đầy đủ. */
function collect(results: ArrayLike<SRResult>) {
  const finals: SRResult[] = [];
  let interim = "";
  for (let i = 0; i < results.length; i++) {
    if (results[i].isFinal) finals.push(results[i]);
    else interim += results[i][0]?.transcript ?? "";
  }
  const transcripts: string[] = [];
  const confidences: number[] = [];
  const maxAlt = Math.max(0, ...finals.map((r) => r.length));
  for (let k = 0; k < maxAlt; k++) {
    transcripts.push(
      finals
        .map((r) => r[Math.min(k, r.length - 1)]?.transcript ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    confidences.push(finals.reduce((a, r) => a + (r[Math.min(k, r.length - 1)]?.confidence ?? 0), 0) / Math.max(1, finals.length));
  }
  return { transcripts: [...new Set(transcripts.filter(Boolean))], confidences, interim };
}

export async function startRecording(opts: RecordOptions): Promise<RecorderHandle> {
  const Ctor = speechRecognitionCtor();
  let srOnly = !!Ctor && preferSrOnly();
  let stream: MediaStream | null = null;
  if (!srOnly) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      // micro bận / không mở được nhưng vẫn còn nhận dạng giọng nói → chế độ chỉ nhận dạng
      if (Ctor && (e as Error)?.name !== "NotAllowedError") srOnly = true;
      else throw e;
    }
  }
  const handle = await run(Ctor, stream, srOnly, opts);
  // Phát hiện xung đột micro: nhận dạng báo lỗi thu âm, hoặc có tiếng rõ mà không ra chữ (không phải do mạng)
  const wrapped = handle.result.then(async (r) => {
    const conflict = !r.srOnly && r.srSupported && (r.srError === "audio-capture" || (r.peak > 0.25 && r.speechMs > 400 && !r.transcripts.length && !r.srError));
    if (!conflict) return r;
    setPreferSrOnly();
    return r; // lần sau chạy chế độ chỉ nhận dạng; lần này để người dùng đọc lại
  });
  return { stop: handle.stop, result: wrapped };
}

async function run(Ctor: SRCtor | null, stream: MediaStream | null, srOnly: boolean, opts: RecordOptions): Promise<RecorderHandle> {
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let buf: Float32Array | null = null;
  if (stream) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    buf = new Float32Array(analyser.fftSize);
  }

  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  if (stream && opts.wantBlob && typeof MediaRecorder !== "undefined") {
    try {
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.start();
    } catch {
      recorder = null;
    }
  }

  let transcripts: string[] = [];
  let confidences: number[] = [];
  let srError: string | undefined;
  let srEnded = !Ctor;
  let srEndResolve: () => void = () => {};
  const srEnd = new Promise<void>((r) => (srEndResolve = r));
  let sr: SR | null = null;
  let speaking = false;
  let lastSrEvent = 0;
  if (Ctor) {
    sr = new Ctor();
    sr.lang = "vi-VN";
    sr.interimResults = true;
    sr.maxAlternatives = 5;
    sr.continuous = !!opts.long;
    sr.onresult = (e) => {
      const c = collect(e.results);
      if (c.transcripts.length) {
        transcripts = c.transcripts;
        confidences = c.confidences;
      }
      lastSrEvent = performance.now();
      opts.onPartial?.([transcripts[0], c.interim].filter(Boolean).join(" "));
    };
    sr.onspeechstart = () => ((speaking = true), (lastSrEvent = performance.now()));
    sr.onsoundstart = () => (lastSrEvent = performance.now());
    sr.onspeechend = () => ((speaking = false), (lastSrEvent = performance.now()));
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
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close().catch(() => {});
    resolveResult({ transcripts, confidences, blob, peak, speechMs, durationMs: performance.now() - t0, srError, srSupported: !!Ctor, srOnly });
  };

  // ở chế độ chỉ nhận dạng: nhận dạng tự kết thúc → dừng luôn
  if (srOnly || !stream) srEnd.then(() => stop());

  const tick = () => {
    const now = performance.now();
    let level = 0;
    if (analyser && buf) {
      analyser.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      level = Math.min(1, Math.sqrt(sum / buf.length) * 6);
    } else if (speaking || now - lastSrEvent < 250) {
      // không đo được âm lượng: vòng sóng dao động theo sự kiện giọng nói
      level = 0.35 + 0.25 * Math.abs(Math.sin(now / 90));
    }
    peak = Math.max(peak, level);
    if (level > 0.12) {
      speechMs += now - last;
      lastVoice = now;
    }
    last = now;
    opts.onLevel?.(level);
    const silence = opts.silenceMs ?? 1100;
    const quietAfterSpeech = lastVoice && speechMs > 250 && now - lastVoice > silence;
    const srQuiet = srOnly && opts.long && lastSrEvent && !speaking && now - lastSrEvent > silence + 400;
    if (now - t0 > opts.maxMs || (!srOnly && quietAfterSpeech) || srQuiet) {
      stop();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop, result };
}
