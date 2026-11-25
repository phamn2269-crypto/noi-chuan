// Kiểu dữ liệu cho data/lessons.json và data/phonemes.json
export type Sound = string; // "l" | "n" | "ch" | "tr" | "s" | "x" | ... (mở rộng được: "r", "d", "gi", vần cuối, thanh điệu)
export type PairId = string; // "l-n" | "ch-tr" | "s-x"

export interface ImageRef {
  emoji?: string;
  src?: string; // đường dẫn ảnh minh họa (tùy chọn) – ưu tiên nếu có
}

export interface ErrorPair {
  id: PairId;
  label: string;
  category: "initial" | "final" | "tone";
  sounds: Sound[];
  color: "ln" | "chtr" | "sx" | string;
  emoji: string;
  title: string;
  description: string;
  order: number;
  enabled: boolean;
}

interface BaseItem {
  id: string;
  pairId: PairId;
  difficulty: 1 | 2 | 3;
}
export interface WordItem extends BaseItem {
  type: "word";
  text: string;
  targetSound: Sound;
  confusableSound: Sound;
  mouthShape: string;
  image: ImageRef;
}
export interface PairOption {
  text: string;
  sound: Sound;
  image: ImageRef;
  meaning: string;
  mouthShape: string;
}
export interface MinimalPairItem extends BaseItem {
  type: "minimal_pair";
  options: [PairOption, PairOption];
}
export interface SentenceItem extends BaseItem {
  type: "sentence";
  text: string;
  targetSounds: Sound[];
  mouthShape: string;
}
export interface VerseItem extends BaseItem {
  type: "verse";
  subtype: "ve" | "ca_dao" | "cau_do";
  title: string;
  lines: string[];
  text: string;
  answer?: string;
  answerEmoji?: string;
  targetSounds: Sound[];
  mouthShape: string;
}
export type LessonItem = WordItem | MinimalPairItem | SentenceItem | VerseItem;

export interface LessonsFile {
  schemaVersion: number;
  categories: { id: string; name: string }[];
  errorPairs: ErrorPair[];
  placementTest: string[];
  prompts: { id: string; type: "prompt"; text: string }[];
  items: LessonItem[];
  stories: Story[];
}
export interface Story {
  id: string;
  pairId: PairId;
  title: string;
  cover: string;
  pages: { text: string; scene: string }[];
}

export type Airflow = "oral" | "nasal" | "lateral" | "groove" | "burst" | "none";
export interface PoseParams {
  jawOpen?: number;
  lipRound?: number;
  lipSpread?: number;
  lipClose?: number;
  lipDental?: number;
  tongueTipUp?: number;
  tongueTipCurl?: number;
  tongueTipDown?: number;
  tongueBodyUp?: number;
  tongueBodyFront?: number;
  tongueBackUp?: number;
  tongueGroove?: number;
  tongueSidesDown?: number;
  velumLower?: number;
}
export interface Phoneme {
  label: string;
  ipa: string;
  params: PoseParams;
  airflow: Airflow;
  contact?: { tongue: string; target: string; gap?: boolean };
  highlight: string[];
  kidHint: string;
  teenHint: string;
  tip?: string;
}
export interface PhonemesFile {
  schemaVersion: number;
  parts: Record<string, string>;
  phonemes: Record<string, Phoneme>;
}

// Manifest âm thanh do scripts/generate_audio.py tạo
export interface TimingMark {
  start: number; // giây (trên bản 0,75)
  end: number;
  text: string; // âm tiết
  phonemes?: { start: number; end: number; pose: string }[];
}
export type ReviewStatus = "chua_duyet" | "da_duyet" | "doc_sai";
export interface ManifestEntry {
  id: string;
  voice: string; // "bac" | "nam"
  text: string;
  slow: string; // đường dẫn bản 0,75
  normal: string; // đường dẫn bản thường
  durationSlow: number;
  durationNormal: number;
  timings: TimingMark[];
  hash: string;
  status: ReviewStatus;
  note?: string;
  source?: "tts" | "human";
}
export interface AudioManifest {
  version: number;
  generatedAt?: string;
  voices: Record<string, { label: string }>;
  entries: Record<string, ManifestEntry>; // khóa: `${voice}/${id}`
}
