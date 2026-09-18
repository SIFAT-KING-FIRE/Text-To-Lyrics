import React, { useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Clock,
  Music,
  Sliders,
  Wand2,
  Play,
  RotateCcw,
  Layers,
  Mic2,
} from "lucide-react";
import { Song, LyricLine, VocalStyle, VoiceName, BackingTrackStyle } from "../types";

interface StudioEditorViewProps {
  song: Song;
  onUpdateSong: (updatedSong: Song) => void;
  onGenerateSpeech: () => void;
  isGeneratingSpeech: boolean;
  onGenerateAiLyrics: (prompt: string, genre: string, mood: string) => Promise<void>;
  isGeneratingLyrics: boolean;
}

export const StudioEditorView: React.FC<StudioEditorViewProps> = ({
  song,
  onUpdateSong,
  onGenerateSpeech,
  isGeneratingSpeech,
  onGenerateAiLyrics,
  isGeneratingLyrics,
}) => {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenre, setAiGenre] = useState(song.genre || "Pop");
  const [aiMood, setAiMood] = useState(song.mood || "Inspiring");
  const [pasteText, setPasteText] = useState("");
  const [showPasteModal, setShowPasteModal] = useState(false);

  const samplePrompts = [
    "Late night drive under glowing neon rain",
    "Cozy coffee shop memories on a Sunday morning",
    "Cyberpunk heart searching for human warmth",
    "Summer beach sunset dance with friends",
    "Overcoming fear and rising up like a champion",
  ];

  // Auto calculate timestamps based on syllable/word counts and BPM
  const autoEstimateTimestamps = (linesToSync?: LyricLine[]) => {
    const list = linesToSync || song.lines;
    let accumulatedTime = 0.0;
    const secondsPerBeat = 60 / song.bpm;

    const updated = list.map((line, idx) => {
      // Approximate syllables by counting vowels and word boundaries
      const words = line.text.trim().split(/\s+/).filter(Boolean);
      const syllables = words.reduce((acc, w) => {
        const matches = w.toLowerCase().match(/[aeiouy]{1,2}/g);
        return acc + Math.max(1, matches ? matches.length : 1);
      }, 0);

      // Give ~1 beat per 1.5 syllables + small pause
      const duration = Math.max(2.2, Math.min(6.5, (syllables * secondsPerBeat * 0.75) + 0.8));
      const startTime = Number(accumulatedTime.toFixed(1));
      accumulatedTime += duration + 0.3;

      return {
        ...line,
        startTime,
        duration: Number(duration.toFixed(1)),
      };
    });

    onUpdateSong({
      ...song,
      lines: updated,
      audioUrl: undefined, // Invalidate cached audio when lines change
    });
  };

  const handleUpdateLine = (index: number, updates: Partial<LyricLine>) => {
    const newLines = [...song.lines];
    newLines[index] = { ...newLines[index], ...updates };
    onUpdateSong({
      ...song,
      lines: newLines,
      audioUrl: undefined,
    });
  };

  const handleAddLine = () => {
    const lastLine = song.lines[song.lines.length - 1];
    const newStartTime = lastLine ? lastLine.startTime + lastLine.duration + 0.5 : 0;
    const newLine: LyricLine = {
      id: `custom-${Date.now()}`,
      section: "Verse",
      text: "Write your new lyric line here...",
      startTime: Number(newStartTime.toFixed(1)),
      duration: 3.5,
      vocalStyle: "singing",
    };
    onUpdateSong({
      ...song,
      lines: [...song.lines, newLine],
      audioUrl: undefined,
    });
  };

  const handleDeleteLine = (index: number) => {
    const newLines = song.lines.filter((_, i) => i !== index);
    onUpdateSong({
      ...song,
      lines: newLines,
      audioUrl: undefined,
    });
  };

  const handlePasteLyrics = () => {
    if (!pasteText.trim()) return;
    const rawLines = pasteText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let currentSection = "Verse 1";
    const parsedLines: LyricLine[] = [];

    rawLines.forEach((text, i) => {
      // Check if line is a section bracket e.g. [Chorus] or [Verse 2]
      if (text.startsWith("[") && text.endsWith("]")) {
        currentSection = text.slice(1, -1);
      } else {
        parsedLines.push({
          id: `pasted-${i}-${Date.now()}`,
          section: currentSection,
          text,
          startTime: 0,
          duration: 3.5,
          vocalStyle: "singing",
        });
      }
    });

    if (parsedLines.length > 0) {
      autoEstimateTimestamps(parsedLines);
    }
    setPasteText("");
    setShowPasteModal(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner: AI Songwriter + Quick Customizer */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Wand2 className="w-4 h-4" />
              </span>
              <h2 className="text-xl font-bold text-white font-['Space_Grotesk']">
                AI Song Lyricist & Customizer
              </h2>
            </div>
            <p className="text-sm text-zinc-400 max-w-xl">
              Prompt Gemini to write full rhyming song lyrics with automatic musical timestamps, or paste your own poem and speech text!
            </p>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button
              onClick={() => setShowPasteModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all flex items-center gap-2"
            >
              <Layers className="w-3.5 h-3.5" />
              Paste Text / Lyrics
            </button>
            <button
              onClick={() => autoEstimateTimestamps()}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all flex items-center gap-2"
              title="Automatically calculate start times and durations based on syllables and BPM"
            >
              <Clock className="w-3.5 h-3.5" />
              Re-Calculate Timings
            </button>
          </div>
        </div>

        {/* AI Lyric Generation Input */}
        <div className="mt-6 pt-5 border-t border-zinc-800/80 flex flex-col md:flex-row gap-3 items-center">
          <div className="flex-1 w-full relative">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="E.g. Rainy night jazz cafe, glowing neon highway, winning against all odds..."
              className="w-full bg-zinc-950/80 border border-zinc-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <select
              value={aiGenre}
              onChange={(e) => setAiGenre(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-3 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
            >
              <option value="Pop">Pop Anthem</option>
              <option value="Synthwave">80s Synthwave</option>
              <option value="Lo-Fi">Lo-Fi Chill R&B</option>
              <option value="Hip-Hop">Hip-Hop / Rap</option>
              <option value="Ballad">Soulful Ballad</option>
            </select>

            <button
              onClick={() => onGenerateAiLyrics(aiPrompt, aiGenre, aiMood)}
              disabled={isGeneratingLyrics}
              className="px-5 py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white shadow-lg shadow-rose-950/40 flex items-center gap-2 transition-all disabled:opacity-50 shrink-0"
            >
              {isGeneratingLyrics ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Writing Lyrics...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate AI Song</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick prompt ideas */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
          <span className="text-zinc-500 text-[11px] shrink-0">Try prompt:</span>
          {samplePrompts.map((p) => (
            <button
              key={p}
              onClick={() => setAiPrompt(p)}
              className="px-2.5 py-1 rounded-lg bg-zinc-950/70 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 text-[11px] shrink-0 transition-all"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Musical Configuration Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Voice Persona */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col gap-2">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <Mic2 className="w-3.5 h-3.5 text-rose-400" />
            Gemini Voice Model
          </label>
          <select
            value={song.voice}
            onChange={(e) =>
              onUpdateSong({ ...song, voice: e.target.value as VoiceName, audioUrl: undefined })
            }
            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
          >
            <option value="Zephyr">Zephyr (Smooth & Modern)</option>
            <option value="Kore">Kore (Warm & Soulful)</option>
            <option value="Puck">Puck (Energetic & Playful)</option>
            <option value="Fenrir">Fenrir (Deep & Resonant)</option>
            <option value="Charon">Charon (Intimate & Poetic)</option>
          </select>
          <span className="text-[10px] text-zinc-500">
            Selected voice performs the lyrics through Gemini TTS
          </span>
        </div>

        {/* Vocal Cadence Style */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col gap-2">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-purple-400" />
            Delivery Cadence
          </label>
          <select
            value={song.vocalStyle}
            onChange={(e) =>
              onUpdateSong({ ...song, vocalStyle: e.target.value as VocalStyle, audioUrl: undefined })
            }
            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
          >
            <option value="melodic">Melodic Sing-Song</option>
            <option value="rap">Rhythmic Rap Flow</option>
            <option value="pop">Upbeat Pop</option>
            <option value="ballad">Emotive Ballad</option>
            <option value="spoken">Poetic Spoken Word</option>
          </select>
          <span className="text-[10px] text-zinc-500">
            Tunes inflection, vowel sustain, and rhythm
          </span>
        </div>

        {/* Backing Track Style */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col gap-2">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            Backing Instrumental Beat
          </label>
          <select
            value={song.backingTrackStyle}
            onChange={(e) =>
              onUpdateSong({ ...song, backingTrackStyle: e.target.value as BackingTrackStyle })
            }
            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="none">🔇 কোনো ব্যাকগ্রাউন্ড মিউজিক নেই (Pure Acapella)</option>
            <option value="synthwave">80s Synthwave (Retro saw arps & drums)</option>
            <option value="lofi">Lo-Fi Chill (Rhodes chords & boom-bap)</option>
            <option value="trap">Trap / R&B (808s & hi-hat rolls)</option>
            <option value="pop">Dance Pop (Bright 4-on-floor)</option>
          </select>
          <span className="text-[10px] text-emerald-400">
            {song.backingTrackStyle === "none"
              ? "✓ কোনো ব্যাকগ্রাউন্ড মিউজিক থাকবে না, শুধু কন্ঠে গান গাইবে"
              : "Procedural Web Audio accompaniment behind voice"}
          </span>
        </div>

        {/* Tempo & BPM */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Tempo (BPM)
            </label>
            <span className="text-xs font-mono font-bold text-amber-400">{song.bpm} BPM</span>
          </div>
          <input
            type="range"
            min={70}
            max={140}
            value={song.bpm}
            onChange={(e) => onUpdateSong({ ...song, bpm: parseInt(e.target.value, 10) })}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <span className="text-[10px] text-zinc-500">
            Controls drum clock and line delivery pacing
          </span>
        </div>
      </div>

      {/* Lyric Lines Table & Timestamps */}
      <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-xl flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
              Lyric Lines & Synchronization Timeline
            </h3>
            <p className="text-xs text-zinc-400">
              {song.lines.length} lines • Adjust individual start times, durations, or lyrics text
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddLine}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Line
            </button>
            <button
              onClick={onGenerateSpeech}
              disabled={isGeneratingSpeech}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-950/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Synthesize Speech
            </button>
          </div>
        </div>

        {/* Lines Editor List */}
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {song.lines.map((line, idx) => (
            <div
              key={line.id || idx}
              className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              {/* Line Index & Section */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-6 text-center text-xs font-mono text-zinc-500 font-medium">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={line.section || ""}
                  placeholder="Verse/Chorus"
                  onChange={(e) => handleUpdateLine(idx, { section: e.target.value })}
                  className="w-24 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300 font-semibold uppercase tracking-wider focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Lyric Text Input */}
              <div className="flex-1">
                <input
                  type="text"
                  value={line.text}
                  onChange={(e) => handleUpdateLine(idx, { text: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white font-medium focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Timing Controls (Start time & Duration in seconds) */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1">
                  <span className="text-[10px] text-zinc-500 font-mono">Start:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={line.startTime}
                    onChange={(e) =>
                      handleUpdateLine(idx, { startTime: parseFloat(e.target.value) || 0 })
                    }
                    className="w-14 bg-transparent text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">s</span>
                </div>

                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1">
                  <span className="text-[10px] text-zinc-500 font-mono">Dur:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={line.duration}
                    onChange={(e) =>
                      handleUpdateLine(idx, { duration: parseFloat(e.target.value) || 1 })
                    }
                    className="w-12 bg-transparent text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">s</span>
                </div>

                <button
                  onClick={() => handleDeleteLine(idx)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-all"
                  title="Delete line"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
              Paste Custom Lyrics or Text
            </h3>
            <p className="text-xs text-zinc-400">
              Paste any lines of song lyrics or poetry below. You can include section headers like
              <code className="text-rose-400 bg-zinc-950 px-1.5 py-0.5 rounded ml-1">[Verse 1]</code> or{" "}
              <code className="text-rose-400 bg-zinc-950 px-1.5 py-0.5 rounded">[Chorus]</code>.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              placeholder="[Verse 1]&#10;Walking down the neon street&#10;Listening to the city beat...&#10;&#10;[Chorus]&#10;We are free tonight!"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteLyrics}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-950/50"
              >
                Parse & Sync Lyrics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
