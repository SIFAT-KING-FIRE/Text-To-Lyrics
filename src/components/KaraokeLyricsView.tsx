import React, { useEffect, useRef, useState } from "react";
import { Play, Disc, Sparkles, Volume2, Mic, Music2, SkipForward, SkipBack, RefreshCw, VolumeX, Download, FileText, Video } from "lucide-react";
import { Song, LyricLine, VoiceName, VocalStyle } from "../types";
import { SendLyricsSection } from "./SendLyricsSection";

interface KaraokeLyricsViewProps {
  song: Song;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  activeLineIndex: number;
  onSeekLine: (index: number) => void;
  onPlayPause: () => void;
  onGenerateSpeech: () => void;
  isGeneratingSpeech: boolean;
  hasCachedAudio: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onSingCustomLyrics: (lyrics: string, title: string, voice: VoiceName, style: VocalStyle) => Promise<void>;
  isSingingCustom: boolean;
  onDownloadAudio: () => void;
  onExportLrc: () => void;
  onOpenVideoRef?: () => void;
}

export const KaraokeLyricsView: React.FC<KaraokeLyricsViewProps> = ({
  song,
  currentTime,
  duration,
  isPlaying,
  activeLineIndex,
  onSeekLine,
  onPlayPause,
  onGenerateSpeech,
  isGeneratingSpeech,
  hasCachedAudio,
  canvasRef,
  onSingCustomLyrics,
  isSingingCustom,
  onDownloadAudio,
  onExportLrc,
  onOpenVideoRef,
}) => {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [isRainyNeonMode, setIsRainyNeonMode] = useState<boolean>(true);

  // Auto-scroll to center active line with smooth behavior
  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const element = activeLineRef.current;

      const containerHeight = container.clientHeight;
      const elementOffsetTop = element.offsetTop;
      const elementHeight = element.clientHeight;

      const targetScrollTop = elementOffsetTop - containerHeight / 2 + elementHeight / 2;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: "smooth",
      });
    }
  }, [activeLineIndex]);

  const activeLine = song.lines[activeLineIndex] || song.lines[0];

  // Calculate percentage through active line
  let lineProgress = 0;
  if (activeLine && isPlaying) {
    const elapsedInLine = currentTime - activeLine.startTime;
    lineProgress = Math.max(0, Math.min(1, elapsedInLine / (activeLine.duration || 1)));
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 flex flex-col">
      {/* Top Section: Quick Send Any Lyrics Bar */}
      <SendLyricsSection
        onSingCustomLyrics={onSingCustomLyrics}
        isSinging={isSingingCustom}
        onDownloadAudio={onDownloadAudio}
        hasAudio={Boolean(song.audioUrl)}
        onOpenVideoRef={onOpenVideoRef}
      />

      {/* Main Karaoke Centerpiece */}
      <div className="w-full min-h-[calc(100vh-280px)] flex flex-col lg:flex-row gap-6 items-stretch">
      {/* Left Column: Track Info & Vinyl Art */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-5 justify-between">
        {/* Album Artwork with Vinyl Illusion */}
        <div className="relative group p-6 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col items-center text-center">
          {/* Ambient Glow */}
          <div
            className={`absolute -top-24 -left-24 w-60 h-60 rounded-full bg-gradient-to-tr ${song.themeColor} opacity-25 blur-3xl pointer-events-none transition-all duration-700`}
          />

          {/* Vinyl Record */}
          <div className="relative w-48 h-48 my-3 flex items-center justify-center">
            {/* Spinning Vinyl behind cover */}
            <div
              className={`absolute inset-0 rounded-full bg-zinc-900 border-4 border-zinc-800/90 shadow-2xl flex items-center justify-center transition-all duration-1000 ${
                isPlaying ? "animate-[spin_6s_linear_infinite]" : ""
              }`}
              style={{
                background:
                  "radial-gradient(circle, #18181b 30%, #09090b 35%, #27272a 36%, #09090b 45%, #27272a 46%, #09090b 60%, #18181b 100%)",
              }}
            >
              {/* Vinyl Center Hole / Label */}
              <div
                className={`w-16 h-16 rounded-full bg-gradient-to-tr ${song.themeColor} p-1 shadow-inner flex items-center justify-center`}
              >
                <div className="w-4 h-4 rounded-full bg-zinc-950 border border-zinc-700" />
              </div>
            </div>

            {/* Play/Pause Overlay Button */}
            <button
              id="vinyl-play-toggle"
              onClick={onPlayPause}
              className="relative z-10 w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 shadow-xl flex items-center justify-center text-white transition-all transform hover:scale-105 active:scale-95 group-hover:opacity-100"
            >
              {isPlaying ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-6 bg-white rounded-full animate-pulse" />
                  <div className="w-1.5 h-6 bg-white rounded-full animate-pulse delay-75" />
                </div>
              ) : (
                <Play className="w-7 h-7 text-white fill-white ml-1" />
              )}
            </button>
          </div>

          {/* Song Details */}
          <div className="mt-2 w-full">
            <h2 className="text-xl font-bold text-white tracking-tight font-['Space_Grotesk'] truncate">
              {song.title}
            </h2>
            <p className="text-sm font-medium text-rose-400 truncate mt-0.5">{song.artist}</p>
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                {song.bpm} BPM
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <VolumeX className="w-3 h-3 text-emerald-400" />
                খালি কন্ঠ (Pure Vocals)
              </span>
              {song.referenceVideoName && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 max-w-[220px] truncate">
                  <Video className="w-3 h-3 text-purple-400 shrink-0" />
                  <span className="truncate">ভিডিও: {song.referenceVideoName}</span>
                </span>
              )}
            </div>
          </div>

          {/* Live Audio Visualizer Canvas */}
          <div className="w-full mt-4 pt-3 border-t border-zinc-800/60 flex flex-col items-center">
            <div className="flex items-center justify-between w-full text-[10px] text-zinc-500 font-medium mb-1.5 px-1">
              <span>VOCAL AUDIO SPECTRUM</span>
              <span className={isPlaying ? "text-rose-400 font-semibold" : "text-zinc-500"}>
                {isPlaying ? "SINGING LIVE" : "IDLE"}
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={260}
              height={44}
              className="w-full h-11 rounded-lg bg-zinc-950/60 border border-zinc-800/50 shadow-inner"
            />
          </div>
        </div>

        {/* Vocal Synthesizer Status Card */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/70 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-semibold text-zinc-200">খালি কন্ঠে গাওয়া (Pure Acapella)</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
              Voice: {song.voice}
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            কোনো ব্যাকগ্রাউন্ড মিউজিক নেই — শুধু লিরিক্সের কথা সুরেলা খাঁটি কন্ঠে গাওয়া হবে।
          </p>

          <button
            id="synthesize-audio-btn"
            onClick={onGenerateSpeech}
            disabled={isGeneratingSpeech}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isGeneratingSpeech ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Generating Song Speech...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{hasCachedAudio ? "Re-Synthesize Pure Vocals" : "Synthesize AI Singing Voice"}</span>
              </>
            )}
          </button>

          {/* Download Options */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60">
            <button
              id="download-song-audio-btn"
              onClick={onDownloadAudio}
              className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-all"
              title="গানটির খালি কন্ঠের অডিও (WAV) ডাউনলোড করুন"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>গান ডাউনলোড</span>
            </button>
            <button
              id="download-lrc-lyrics-btn"
              onClick={onExportLrc}
              className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 flex items-center justify-center gap-1.5 transition-all"
              title="টাইম-সিঙ্কড LRC লিরিক্স ডাউনলোড করুন"
            >
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span>LRC লিরিক্স</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Spotify/Apple Music Style Real-Time Lyrics View */}
      <div
        className={`flex-1 flex flex-col rounded-3xl border shadow-2xl backdrop-blur-md overflow-hidden relative transition-colors duration-700 ${
          isRainyNeonMode
            ? "bg-[#0b0516] border-purple-900/60 shadow-purple-950/50"
            : "bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 border-zinc-800/80"
        }`}
      >
        {/* Rainy Glass droplets & condensation aesthetic overlay */}
        {isRainyNeonMode && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 z-0">
            {/* Atmospheric purple rain glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 blur-[100px] rounded-full" />
            {/* Simulated rain droplets on glass */}
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glass-blur">
                  <feGaussianBlur stdDeviation="0.5" />
                </filter>
              </defs>
              <g fill="#c084fc" opacity="0.45">
                <ellipse cx="12%" cy="18%" rx="2.5" ry="5.5" />
                <ellipse cx="14%" cy="32%" rx="3" ry="7" />
                <ellipse cx="28%" cy="12%" rx="2" ry="4" />
                <ellipse cx="35%" cy="45%" rx="3.5" ry="9" />
                <ellipse cx="48%" cy="22%" rx="2.5" ry="6" />
                <ellipse cx="62%" cy="15%" rx="3" ry="8" />
                <ellipse cx="78%" cy="38%" rx="2" ry="5" />
                <ellipse cx="85%" cy="19%" rx="3" ry="7" />
                <ellipse cx="92%" cy="48%" rx="2.5" ry="6" />
                <ellipse cx="22%" cy="68%" rx="3" ry="7" />
                <ellipse cx="42%" cy="75%" rx="2" ry="5" />
                <ellipse cx="68%" cy="62%" rx="3.5" ry="8" />
                <ellipse cx="80%" cy="82%" rx="2.5" ry="6" />
                <ellipse cx="55%" cy="88%" rx="3" ry="7" />
              </g>
            </svg>
          </div>
        )}

        {/* Header Bar */}
        <div
          className={`relative z-10 px-6 py-4 border-b flex items-center justify-between transition-colors ${
            isRainyNeonMode
              ? "bg-[#0b0516]/80 border-purple-900/40"
              : "bg-zinc-950/40 border-zinc-800/60"
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                isRainyNeonMode ? "bg-purple-400" : "bg-rose-500"
              }`}
            />
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isRainyNeonMode ? "text-purple-300" : "text-zinc-400"
              }`}
            >
              Karaoke Lyrics Stream
            </span>
            {activeLine?.section && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                  isRainyNeonMode
                    ? "bg-purple-500/25 text-purple-200 border-purple-400/40 shadow-sm shadow-purple-500/30"
                    : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                }`}
              >
                {activeLine.section}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Rainy Neon Mode Toggle */}
            <button
              id="toggle-rainy-neon-btn"
              onClick={() => setIsRainyNeonMode(!isRainyNeonMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                isRainyNeonMode
                  ? "bg-purple-600/30 text-purple-200 border-purple-400/50 shadow-md shadow-purple-950/40"
                  : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:text-white"
              }`}
              title="ভিডিওর মত ডার্ক বৃষ্টির কাঁচ ও নিয়ন লিরিক্স মোড"
            >
              <span>🌧️ বৃষ্টির নিয়ন {isRainyNeonMode ? "চালু" : "বন্ধ"}</span>
            </button>

            <button
              id="header-download-audio-btn"
              onClick={onDownloadAudio}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700 text-emerald-300 hover:text-emerald-200 border border-zinc-700/70 flex items-center gap-1.5 transition-all shadow-sm"
              title="গানটির অডিও ডাউনলোড করুন (Download WAV)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">অডিও ডাউনলোড</span>
            </button>
            <div className="text-xs text-zinc-400 font-mono hidden sm:block">
              Line {activeLineIndex + 1} of {song.lines.length}
            </div>
          </div>
        </div>

        {/* Scrolling Lyrics Container */}
        <div
          ref={lyricsContainerRef}
          className="relative z-10 flex-1 p-6 sm:p-10 overflow-y-auto space-y-6 sm:space-y-8 scroll-smooth scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
          style={{ minHeight: "440px", maxHeight: "680px" }}
        >
          {song.lines.map((line, index) => {
            const isActive = index === activeLineIndex;
            const isPassed = index < activeLineIndex;
            const isUpcoming = index > activeLineIndex;

            return (
              <div
                key={line.id || index}
                ref={isActive ? activeLineRef : null}
                onClick={() => onSeekLine(index)}
                className={`group cursor-pointer transition-all duration-500 rounded-2xl p-4 sm:p-5 relative ${
                  isActive
                    ? isRainyNeonMode
                      ? "bg-purple-950/40 border border-purple-400/50 shadow-2xl shadow-purple-900/40 scale-[1.02]"
                      : "bg-zinc-800/60 border border-rose-500/40 shadow-xl shadow-rose-950/20 scale-[1.02]"
                    : "hover:bg-zinc-900/40 border border-transparent"
                }`}
              >
                {/* Section Badge (e.g. Verse 1, Chorus) */}
                {line.section && (
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full transition-all ${
                        isActive
                          ? isRainyNeonMode
                            ? "bg-purple-500 text-white shadow-md shadow-purple-500/50"
                            : "bg-rose-500 text-white shadow-sm"
                          : isRainyNeonMode
                          ? "bg-purple-950/60 text-purple-400 border border-purple-900/40"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {line.section}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {Math.floor(line.startTime / 60)}:
                      {Math.floor(line.startTime % 60)
                        .toString()
                        .padStart(2, "0")}
                    </span>
                  </div>
                )}

                {/* The Lyric Text with Karaoke Illumination */}
                <div className="relative">
                  <p
                    className={`font-['Space_Grotesk'] text-xl sm:text-2xl md:text-3xl font-bold tracking-tight transition-all duration-300 select-none ${
                      isActive
                        ? isRainyNeonMode
                          ? "text-[#f5edff] drop-shadow-[0_0_12px_rgba(216,180,254,1)] drop-shadow-[0_0_28px_rgba(168,85,247,0.85)] uppercase tracking-wider font-extrabold"
                          : "text-white drop-shadow-[0_0_20px_rgba(244,63,94,0.35)]"
                        : isRainyNeonMode
                        ? isPassed
                          ? "text-purple-300/30 uppercase tracking-wide opacity-60"
                          : "text-purple-300/40 uppercase tracking-wide opacity-50 hover:opacity-80"
                        : isPassed
                        ? "text-zinc-500 opacity-60 hover:opacity-90"
                        : "text-zinc-600 opacity-40 hover:opacity-80"
                    }`}
                  >
                    {line.text}
                  </p>

                  {/* Active Line Fill / Progress Bar */}
                  {isActive && isPlaying && (
                    <div className="mt-3 w-full h-1 rounded-full bg-zinc-800/80 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-100 ease-linear rounded-full ${
                          isRainyNeonMode
                            ? "bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300 shadow-[0_0_10px_rgba(192,132,252,0.8)]"
                            : "bg-gradient-to-r from-rose-500 via-purple-500 to-indigo-400"
                        }`}
                        style={{ width: `${lineProgress * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Interactive Click-to-Jump Indicator */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                      isRainyNeonMode
                        ? "text-purple-300 bg-purple-950/80 border border-purple-700"
                        : "text-rose-400 bg-rose-950/60 border border-rose-800"
                    }`}
                  >
                    <Play className="w-2.5 h-2.5 fill-current" /> Jump Here
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ambient Bottom Fade Gradient */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent" />
      </div>
    </div>
  </div>
  );
};
