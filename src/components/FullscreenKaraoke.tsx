import React, { useEffect, useRef, useState } from "react";
import { X, Play, Pause, SkipBack, SkipForward, Music } from "lucide-react";
import { Song } from "../types";

interface FullscreenKaraokeProps {
  song: Song;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  activeLineIndex: number;
  onPlayPause: () => void;
  onPrevLine: () => void;
  onNextLine: () => void;
  onClose: () => void;
  onSeekLine: (index: number) => void;
}

export const FullscreenKaraoke: React.FC<FullscreenKaraokeProps> = ({
  song,
  currentTime,
  duration,
  isPlaying,
  activeLineIndex,
  onPlayPause,
  onPrevLine,
  onNextLine,
  onClose,
  onSeekLine,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [isRainyMode, setIsRainyMode] = useState(true);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeLineRef.current;
      const targetScroll = element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
    }
  }, [activeLineIndex]);

  const activeLine = song.lines[activeLineIndex];
  let lineProgress = 0;
  if (activeLine && isPlaying) {
    const elapsed = currentTime - activeLine.startTime;
    lineProgress = Math.max(0, Math.min(1, elapsed / (activeLine.duration || 1)));
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between overflow-hidden select-none transition-colors duration-700 ${
        isRainyMode ? "bg-[#090312]" : "bg-zinc-950"
      }`}
    >
      {/* Background Animated Atmosphere */}
      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-1000 ${
          isRainyMode
            ? "bg-gradient-to-tr from-purple-950/70 via-indigo-950/40 to-black opacity-80"
            : `bg-gradient-to-tr ${song.themeColor} opacity-20 blur-[120px]`
        }`}
      />

      {/* Realistic Rain Droplets On Glass Overlay */}
      {isRainyMode && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35 z-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-purple-600/25 blur-[120px] rounded-full" />
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <g fill="#c084fc" opacity="0.5">
              <ellipse cx="8%" cy="14%" rx="3" ry="8" />
              <ellipse cx="15%" cy="30%" rx="3.5" ry="10" />
              <ellipse cx="25%" cy="12%" rx="2.5" ry="5" />
              <ellipse cx="32%" cy="48%" rx="4" ry="12" />
              <ellipse cx="44%" cy="20%" rx="3" ry="7" />
              <ellipse cx="58%" cy="16%" rx="3.5" ry="9" />
              <ellipse cx="72%" cy="35%" rx="2.5" ry="6" />
              <ellipse cx="82%" cy="18%" rx="3.5" ry="10" />
              <ellipse cx="90%" cy="44%" rx="3" ry="7" />
              <ellipse cx="18%" cy="65%" rx="3.5" ry="8" />
              <ellipse cx="38%" cy="78%" rx="2.5" ry="6" />
              <ellipse cx="65%" cy="60%" rx="4" ry="11" />
              <ellipse cx="76%" cy="80%" rx="3" ry="7" />
              <ellipse cx="50%" cy="86%" rx="3.5" ry="9" />
            </g>
          </svg>
        </div>
      )}

      {/* Top Bar */}
      <div className="relative z-10 px-8 py-6 flex items-center justify-between border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Music className="w-5 h-5 text-purple-400 animate-pulse" />
          <div>
            <h2 className="text-lg font-bold text-white font-['Space_Grotesk'] tracking-tight">
              {song.title}
            </h2>
            <p className="text-xs text-purple-400 font-medium">{song.artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRainyMode(!isRainyMode)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isRainyMode
                ? "bg-purple-600/30 text-purple-200 border-purple-400/50 shadow-md shadow-purple-950/40"
                : "bg-white/10 text-white/70 border-white/10 hover:text-white"
            }`}
          >
            <span>🌧️ বৃষ্টির নিয়ন {isRainyMode ? "চালু" : "বন্ধ"}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
            title="Exit Fullscreen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Lyrics Centerpiece */}
      <div
        ref={containerRef}
        className="relative z-10 flex-1 overflow-y-auto px-6 sm:px-16 py-20 space-y-12 sm:space-y-16 scrollbar-none text-center"
      >
        {song.lines.map((line, idx) => {
          const isActive = idx === activeLineIndex;
          const isPast = idx < activeLineIndex;

          return (
            <div
              key={line.id || idx}
              ref={isActive ? activeLineRef : null}
              onClick={() => onSeekLine(idx)}
              className={`cursor-pointer transition-all duration-500 max-w-4xl mx-auto ${
                isActive
                  ? "scale-105 opacity-100"
                  : isPast
                  ? "opacity-35 hover:opacity-60 scale-95"
                  : "opacity-40 hover:opacity-75 scale-95"
              }`}
            >
              {line.section && (
                <span
                  className={`text-xs uppercase font-bold tracking-widest px-3 py-1 rounded-full mb-3 inline-block transition-all ${
                    isActive
                      ? isRainyMode
                        ? "bg-purple-500 text-white shadow-lg shadow-purple-500/50 border border-purple-300/40"
                        : "bg-rose-500 text-white shadow-lg shadow-rose-500/40"
                      : "bg-white/5 text-zinc-400"
                  }`}
                >
                  {line.section}
                </span>
              )}

              <p
                className={`font-['Space_Grotesk'] text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight transition-all duration-300 ${
                  isActive
                    ? isRainyMode
                      ? "text-[#f3e8ff] drop-shadow-[0_0_18px_rgba(216,180,254,1)] drop-shadow-[0_0_38px_rgba(168,85,247,0.9)] uppercase tracking-wider"
                      : "text-white drop-shadow-[0_0_35px_rgba(244,63,94,0.5)]"
                    : isRainyMode
                    ? "text-purple-300/30 uppercase tracking-wide"
                    : "text-zinc-400"
                }`}
              >
                {line.text}
              </p>

              {isActive && isPlaying && (
                <div className="mt-6 w-48 mx-auto h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-100 ease-linear ${
                      isRainyMode
                        ? "bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300 shadow-[0_0_12px_rgba(192,132,252,0.9)]"
                        : "bg-gradient-to-r from-rose-500 to-indigo-400"
                    }`}
                    style={{ width: `${lineProgress * 100}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Minimal Controls */}
      <div className="relative z-10 pb-10 pt-4 flex items-center justify-center gap-6 backdrop-blur-md">
        <button
          onClick={onPrevLine}
          disabled={activeLineIndex <= 0}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={onPlayPause}
          className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-2xl shadow-purple-950/80 transform hover:scale-105 active:scale-95 transition-all"
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 fill-white" />
          ) : (
            <Play className="w-7 h-7 fill-white ml-1" />
          )}
        </button>

        <button
          onClick={onNextLine}
          disabled={activeLineIndex >= song.lines.length - 1}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
