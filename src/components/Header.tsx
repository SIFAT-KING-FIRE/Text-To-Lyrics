import React from "react";
import { Mic2, Music, Sparkles, Sliders, Play, Download, Radio, Video } from "lucide-react";
import { Song } from "../types";

interface HeaderProps {
  currentSong: Song;
  presetSongs: Song[];
  onSelectSong: (song: Song) => void;
  activeTab: "lyrics" | "studio" | "video_ref";
  onTabChange: (tab: "lyrics" | "studio" | "video_ref") => void;
  onExport: () => void;
  onDownloadAudio?: () => void;
  isGenerating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentSong,
  presetSongs,
  activeTab,
  onTabChange,
  onExport,
  onDownloadAudio,
  onSelectSong,
  isGenerating,
}) => {
  return (
    <header className="w-full bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 sticky top-0 z-40 px-4 sm:px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-500 p-0.5 shadow-lg shadow-rose-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Music className="w-5 h-5 text-rose-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white font-['Space_Grotesk'] text-lg">
                  LyricTTS
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  Karaoke Speech
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Text-to-speech with synchronized musical song lyrics
              </p>
            </div>
          </div>

          {/* Mobile view switcher buttons */}
          <div className="flex md:hidden items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => onTabChange("lyrics")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "lyrics"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Lyrics
            </button>
            <button
              onClick={() => onTabChange("studio")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "studio"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Studio
            </button>
            <button
              onClick={() => onTabChange("video_ref")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                activeTab === "video_ref"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-purple-300 hover:text-purple-100"
              }`}
            >
              <Video className="w-3 h-3" />
              <span>ভিডিও</span>
            </button>
          </div>
        </div>

        {/* Preset Songs Picker */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 scrollbar-none">
          <span className="text-xs text-zinc-500 font-medium px-1 flex items-center gap-1 shrink-0">
            <Radio className="w-3.5 h-3.5 text-zinc-500" /> Presets:
          </span>
          {presetSongs.map((song) => {
            const isSelected = song.id === currentSong.id;
            return (
              <button
                key={song.id}
                onClick={() => onSelectSong(song)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-gradient-to-r from-zinc-800 to-zinc-700 text-white border border-rose-500/50 shadow-md shadow-rose-950/40"
                    : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800/80"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isSelected ? "bg-rose-400 animate-ping" : "bg-zinc-600"
                  }`}
                />
                <span className="truncate max-w-[110px]">{song.title}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls & Navigation Tabs */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <div className="bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl flex items-center gap-1">
            <button
              id="lyrics-view-tab"
              onClick={() => onTabChange("lyrics")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "lyrics"
                  ? "bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow-md shadow-rose-500/25"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Mic2 className="w-3.5 h-3.5" />
              Lyrics View
            </button>
            <button
              id="studio-view-tab"
              onClick={() => onTabChange("studio")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "studio"
                  ? "bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow-md shadow-rose-500/25"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Song Studio
            </button>
            <button
              id="video-ref-tab"
              onClick={() => onTabChange("video_ref")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "video_ref"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/50"
                  : "text-purple-300 hover:text-purple-100 hover:bg-purple-950/30"
              }`}
            >
              <Video className="w-3.5 h-3.5 text-purple-400" />
              <span>ভিডিও রেফারেন্স</span>
            </button>
          </div>

          {/* Action Download Buttons */}
          <div className="flex items-center gap-1.5">
            {onDownloadAudio && (
              <button
                id="header-audio-download-btn"
                onClick={onDownloadAudio}
                disabled={isGenerating}
                title="গানটির অডিও (WAV) ডাউনলোড করুন"
                className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">গান ডাউনলোড</span>
              </button>
            )}

            <button
              onClick={onExport}
              disabled={isGenerating}
              title="LRC কারাওকে লিরিক্স ফাইল ডাউনলোড করুন"
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
