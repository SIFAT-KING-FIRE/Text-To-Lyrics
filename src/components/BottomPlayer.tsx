import React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  Mic,
  Music,
  Maximize2,
  Repeat,
  Download,
} from "lucide-react";
import { Song } from "../types";

interface BottomPlayerProps {
  song: Song;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  activeLineIndex: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onPrevLine: () => void;
  onNextLine: () => void;
  onRestart: () => void;
  vocalVolume: number;
  beatVolume: number;
  onVocalVolumeChange: (vol: number) => void;
  onBeatVolumeChange: (vol: number) => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  onToggleFullscreen: () => void;
  onDownloadAudio?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const BottomPlayer: React.FC<BottomPlayerProps> = ({
  song,
  currentTime,
  duration,
  isPlaying,
  activeLineIndex,
  onPlayPause,
  onSeek,
  onPrevLine,
  onNextLine,
  onRestart,
  vocalVolume,
  beatVolume,
  onVocalVolumeChange,
  onBeatVolumeChange,
  isLooping,
  onToggleLoop,
  onToggleFullscreen,
  onDownloadAudio,
}) => {
  const activeLine = song.lines[activeLineIndex];
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="w-full bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/90 fixed bottom-0 left-0 right-0 z-40 px-4 sm:px-6 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.6)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Track Info & Current Lyric Line Teaser */}
        <div className="flex items-center gap-3 w-full md:w-1/4 min-w-0">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${song.themeColor} p-0.5 shadow-md shrink-0 flex items-center justify-center`}
          >
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Music className={`w-5 h-5 text-rose-400 ${isPlaying ? "animate-bounce" : ""}`} />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-white truncate font-['Space_Grotesk']">
                {song.title}
              </h4>
              {activeLine?.section && (
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold shrink-0">
                  {activeLine.section}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate mt-0.5">
              {activeLine?.text || song.artist}
            </p>
          </div>
        </div>

        {/* Center: Transport Controls & Scrubber */}
        <div className="flex flex-col items-center gap-1.5 w-full md:w-2/4">
          <div className="flex items-center gap-3">
            <button
              onClick={onRestart}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors"
              title="Restart song"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              id="prev-line-btn"
              onClick={onPrevLine}
              disabled={activeLineIndex <= 0}
              className="p-2 text-zinc-300 hover:text-white disabled:opacity-30 transition-all"
              title="Previous lyric line"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              id="main-play-pause-btn"
              onClick={onPlayPause}
              className="w-11 h-11 rounded-full bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white flex items-center justify-center shadow-lg shadow-rose-950/60 transform hover:scale-105 active:scale-95 transition-all"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white ml-0.5" />
              )}
            </button>

            <button
              id="next-line-btn"
              onClick={onNextLine}
              disabled={activeLineIndex >= song.lines.length - 1}
              className="p-2 text-zinc-300 hover:text-white disabled:opacity-30 transition-all"
              title="Next lyric line"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={onToggleLoop}
              className={`p-1.5 transition-colors ${
                isLooping ? "text-rose-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Toggle loop"
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          {/* Scrubber Timeline */}
          <div className="w-full flex items-center gap-2.5 max-w-lg">
            <span className="text-[10px] font-mono text-zinc-500 w-8 text-right">
              {formatTime(currentTime)}
            </span>

            <div
              onClick={handleScrubberClick}
              className="flex-1 h-2 bg-zinc-800 rounded-full cursor-pointer relative group overflow-hidden"
            >
              <div
                className="h-full bg-gradient-to-r from-rose-500 via-purple-500 to-indigo-400 rounded-full relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <span className="text-[10px] font-mono text-zinc-500 w-8">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Audio Volume Mixer Controls */}
        <div className="hidden md:flex items-center justify-end gap-3 w-full md:w-1/4">
          {/* Pure Vocals indicator */}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
            শুধু কন্ঠ (Pure Voice)
          </span>

          {/* Vocal Volume */}
          <div className="flex items-center gap-1.5" title="গাওয়ার কন্ঠের ভলিউম (Vocal Volume)">
            <Mic className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="1.2"
              step="0.05"
              value={vocalVolume}
              onChange={(e) => onVocalVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1 accent-rose-500 cursor-pointer bg-zinc-800 rounded-lg"
            />
          </div>

          {/* Download Audio */}
          {onDownloadAudio && (
            <button
              id="bottom-player-download-btn"
              onClick={onDownloadAudio}
              className="p-2 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
              title="গানটির অডিও ডাউনলোড করুন (Download Song WAV)"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Fullscreen Lyrics Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
