export interface LyricLine {
  id: string;
  section?: string; // e.g. "Verse 1", "Chorus", "Bridge"
  text: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  vocalStyle?: "singing" | "spoken" | "rap" | "whisper" | "high note";
}

export type BackingTrackStyle = "lofi" | "synthwave" | "pop" | "trap" | "acoustic" | "none";
export type VocalStyle = "indie" | "melodic" | "ballad" | "pop" | "rap" | "spoken";
export type VoiceName = "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr";

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  bpm: number;
  key: string;
  themeColor: string; // e.g. "from-rose-500 to-amber-500"
  vocalStyle: VocalStyle;
  voice: VoiceName;
  backingTrackStyle: BackingTrackStyle;
  lines: LyricLine[];
  audioUrl?: string; // Pre-synthesized or cached TTS audio
  referenceVideoUrl?: string;
  referenceVideoName?: string;
  vocalDescription?: string;
}

export interface PlayerSettings {
  vocalVolume: number; // 0 to 1
  beatVolume: number; // 0 to 1
  tempoMultiplier: number; // 0.8 to 1.3
  reverbAmount: number; // 0 to 1
  autoScroll: boolean;
  highlightWords: boolean;
}
