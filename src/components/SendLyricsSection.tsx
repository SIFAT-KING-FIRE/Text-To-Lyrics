import React, { useState, useMemo } from "react";
import { Mic2, Sparkles, VolumeX, RefreshCw, ChevronDown, ChevronUp, Globe, Download, CheckCircle2, Video } from "lucide-react";
import { VoiceName, VocalStyle } from "../types";

interface SendLyricsSectionProps {
  onSingCustomLyrics: (lyrics: string, title: string, voice: VoiceName, style: VocalStyle) => Promise<void>;
  isSinging: boolean;
  onDownloadAudio?: () => void;
  hasAudio?: boolean;
  onOpenVideoRef?: () => void;
}

const FEATURED_SAMPLES = [
  {
    title: "✨ আপনার লিরিক্স: Kind of Misery",
    text: `[Chorus]
I miss that kind of misery
The kind where you are nice to me
But only in the evening
So I ask, am I just dreaming?

[Verse 1]
I love you so much that it's dripping
Dripping from my arms and such
I'm sorry, I know I'm too much
To love, to trust, I'm nothing, but-

[Chorus]
I miss that kind of misery
The kind where you are nice to me
But only in the evening
So I ask, am I just dreaming?`,
  },
  {
    title: "তুমি রবে নীরবে (বাংলা)",
    text: `তুমি রবে নীরবে হৃদয়ে মম
নিবিড় নিভৃত পূর্ণিমা নিশীথিনী-সম
মম জীবন যৌবন মম নিখিল ভুবন
তুমি ভরিবে গৌরবে নিশীথিনী-সম
দুঃখের দিনে যদি না দেখা পাই
সুখের স্বপনে তোমারে শুধাই
তুমি রবে নীরবে হৃদয়ে মম`,
  },
  {
    title: "একলা চলো রে (বাংলা)",
    text: `যদি তোর ডাক শুনে কেউ না আসে তবে একলা চলো রে
তবে একলা চলো, একলা চলো, একলা চলো রে
যদি কেউ কথা না কয় ওরে ওরে ও অভাগা
যদি সবাই থাকে মুখ ফিরায়ে সবাই করে ভয়
তবে পরাণ খুলে তুই মুখ ফুটে তোর মনের কথা একলা বলো রে`,
  },
  {
    title: "আমি বাংলায় গান গাই (বাংলা)",
    text: `আমি বাংলায় গান গাই, আমি বাংলার গান গাই
আমি আমার আমিকে চিরদিন এই বাংলায় খুঁজে পাই
আমি বাংলায় দেখি স্বপ্ন, আমি বাংলায় বাঁধি সুর
আমি এই বাংলার মায়াভরা পথে হেঁটেছি কত না দূর
বাংলা আমার জীবনানন্দ, বাংলা আমার রূপসী`,
  },
];

export const SendLyricsSection: React.FC<SendLyricsSectionProps> = ({
  onSingCustomLyrics,
  isSinging,
  onDownloadAudio,
  hasAudio,
  onOpenVideoRef,
}) => {
  const [lyricsInput, setLyricsInput] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>("Kore");
  const [selectedStyle, setSelectedStyle] = useState<VocalStyle>("indie");
  const [isExpanded, setIsExpanded] = useState(true);

  // Real-time language detection so the user is assured the song will be sung in their exact language
  const detectedLanguage = useMemo(() => {
    if (!lyricsInput.trim()) return null;
    if (/[\u0980-\u09FF]/.test(lyricsInput)) {
      return { code: "bn", name: "বাংলা (Bengali)", flag: "🇧🇩" };
    }
    if (/[\u0900-\u097F]/.test(lyricsInput)) {
      return { code: "hi", name: "हिन्दी (Hindi)", flag: "🇮🇳" };
    }
    if (/[\u0600-\u06FF]/.test(lyricsInput)) {
      return { code: "ar", name: "العربية (Arabic)", flag: "🇸🇦" };
    }
    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(lyricsInput)) {
      return { code: "ja", name: "日本語 (Japanese)", flag: "🇯🇵" };
    }
    if (/[áéíóúüñ¿¡]/i.test(lyricsInput)) {
      return { code: "es", name: "Español (Spanish)", flag: "🇪🇸" };
    }
    return { code: "en", name: "English", flag: "🇬🇧" };
  }, [lyricsInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lyricsInput.trim() || isSinging) return;
    // Strip leading and trailing quotes if user copied quotes
    const cleanedText = lyricsInput.trim().replace(/^["“'«]+|["”'»]+$/g, "").trim();
    await onSingCustomLyrics(cleanedText, songTitle.trim(), selectedVoice, selectedStyle);
  };

  const handleApplySample = (sample: { title: string; text: string }) => {
    const cleanTitle = sample.title.replace(/^[^a-zA-Z0-9_\u0980-\u09FF]+/, "").trim();
    setSongTitle(cleanTitle);
    setLyricsInput(sample.text);
    setIsExpanded(true);
  };

  return (
    <div className="w-full bg-gradient-to-r from-zinc-900/90 via-zinc-900/70 to-zinc-950/90 border border-rose-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl mb-6 relative overflow-hidden">
      {/* Background Subtle Accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 mb-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-purple-600 p-0.5 shadow-lg shadow-rose-950/50 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Mic2 className="w-5 h-5 text-rose-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-white font-['Space_Grotesk'] tracking-tight">
                যে কোনো লিরিক্স পাঠান (Send Any Lyrics)
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <VolumeX className="w-3 h-3 text-emerald-400" />
                শুধু কন্ঠ (No Background Music)
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              এখানে বাংলা বা যেকোনো ভাষার লিরিক্স লিখুন — কোনো ব্যাকগ্রাউন্ড মিউজিক ছাড়া শুধু মিষ্টি কন্ঠে গান গাইবে
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenVideoRef && (
            <button
              type="button"
              id="send-section-video-ref-btn"
              onClick={onOpenVideoRef}
              className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
              title="ভিডিও ক্লিপ আপলোড করে রেফারেন্স অডিও তৈরি করুন"
            >
              <Video className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">ভিডিও রেফারেন্স স্টুডিও</span>
              <span className="sm:hidden">ভিডিও</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Lyric Samples */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none mb-3 relative z-10">
        <span className="text-xs text-zinc-400 font-medium shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" /> নমুনা লিরিক্স:
        </span>
        {FEATURED_SAMPLES.map((sample, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleApplySample(sample)}
            className={`text-xs px-3 py-1.5 rounded-full transition-all shrink-0 font-medium flex items-center gap-1.5 ${
              idx === 0
                ? "bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-pink-200 border border-pink-500/50 hover:bg-pink-500/40 font-semibold"
                : "bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-200 border border-zinc-700/60 hover:border-rose-500/40"
            }`}
          >
            {sample.title}
          </button>
        ))}
      </div>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {/* Text Area for lyrics */}
          <div className="relative">
            <textarea
              value={lyricsInput}
              onChange={(e) => setLyricsInput(e.target.value)}
              placeholder={`এখানে আপনার যে কোনো গানের লিরিক্স লিখুন বা পেস্ট করুন... ([Chorus], [Verse 1] সহ দিতে পারেন)\n\nউদাহরণ:\n[Chorus]\nI miss that kind of misery\nThe kind where you are nice to me\nBut only in the evening\nSo I ask, am I just dreaming?`}
              rows={4}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 focus:border-rose-500/80 focus:ring-2 focus:ring-rose-500/20 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none resize-y transition-all font-sans leading-relaxed"
            />
            {lyricsInput && (
              <button
                type="button"
                onClick={() => setLyricsInput("")}
                className="absolute top-3 right-3 text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-900/90 px-2 py-1 rounded-lg border border-zinc-800"
              >
                Clear
              </button>
            )}
          </div>

          {/* Real-time Language Assurance Badge */}
          {detectedLanguage && (
            <div className="flex items-center gap-2 flex-wrap text-xs px-3 py-1.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-zinc-300">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                সনাক্তকৃত ভাষা: <strong>{detectedLanguage.flag} {detectedLanguage.name}</strong>
              </span>
              <span className="text-zinc-500">•</span>
              <span className="text-emerald-400 font-medium">
                মডেলটি এই খাঁটি ভাষাতেই সম্পূর্ণ গানটি গাইবে
              </span>
            </div>
          )}

          {/* Options Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Optional Title */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                গানের নাম / Title (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="যেমন: Kind of Misery..."
                className="w-full px-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-rose-500/60 outline-none"
              />
            </div>

            {/* Voice Selection */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                কন্ঠশিল্পী / Singing Voice
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs text-zinc-200 focus:border-rose-500/60 outline-none"
              >
                <option value="Kore">Kore — মিষ্টি সুরেলা নারী কন্ঠ (Sweet Melodic Female)</option>
                <option value="Zephyr">Zephyr — স্পষ্ট ও আধুনিক কন্ঠ (Clean Modern)</option>
                <option value="Puck">Puck — উজ্জ্বল ও প্রাণবন্ত (Bright & Expressive)</option>
                <option value="Fenrir">Fenrir — গভীর পুরুষ কন্ঠ (Deep Baritone)</option>
                <option value="Charon">Charon — নরম ও ভাবপূর্ণ (Gentle Soulful)</option>
              </select>
            </div>

            {/* Vocal Style */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                গাওয়ার ধরণ / Vocal Style
              </label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value as VocalStyle)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs text-zinc-200 focus:border-rose-500/60 outline-none"
              >
                <option value="indie">✨ Indie Bedroom Pop — ভিডিওর মত নরম, ব্রেদি ও মিষ্টি মেলানকোলিক কন্ঠ</option>
                <option value="melodic">Melodic Singing — সুরেলা গান</option>
                <option value="ballad">Soulful Ballad — আবেগঘন ও ধীর</option>
                <option value="pop">Pop Singing — আধুনিক পপ সুর</option>
                <option value="rap">Rhythmic Cadence — ছন্দময় প্রবাহ</option>
              </select>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                কোনো বাজনা বা ড্রামস থাকবে না — <strong>১০০% খাঁটি মানুষের খালি কন্ঠে</strong> গান শোনা যাবে।
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {hasAudio && onDownloadAudio && (
                <button
                  type="button"
                  onClick={onDownloadAudio}
                  className="px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs border border-zinc-700 flex items-center justify-center gap-2 transition-all"
                  title="বর্তমান গানটির অডিও ডাউনলোড করুন (Download WAV)"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>অডিও ডাউনলোড</span>
                </button>
              )}

              <button
                id="sing-custom-lyrics-btn"
                type="submit"
                disabled={!lyricsInput.trim() || isSinging}
                className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2.5 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSinging ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>কন্ঠে গান গাওয়া হচ্ছে... (Synthesizing Vocals)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>🎶 গান গাও (Sing Pure Vocals)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
