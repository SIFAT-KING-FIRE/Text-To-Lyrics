import React, { useState, useRef } from "react";
import {
  Upload,
  Video,
  Music,
  Sparkles,
  Play,
  Pause,
  Download,
  FileText,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Mic2,
  Eye,
  AlertCircle,
  Film,
  Zap,
} from "lucide-react";
import { Song, VoiceName, VocalStyle } from "../types";

interface VideoReferenceStudioProps {
  onSongGenerated: (song: Song) => void;
  onPlaySong: (song: Song) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

export const VideoReferenceStudio: React.FC<VideoReferenceStudioProps> = ({
  onSongGenerated,
  onPlaySong,
  showToast,
}) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [mode, setMode] = useState<"extract" | "custom_lyrics">("extract");
  const [customLyrics, setCustomLyrics] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>("Kore");
  const [selectedStyle, setSelectedStyle] = useState<VocalStyle>("indie");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Result state
  const [generatedSong, setGeneratedSong] = useState<Song | null>(null);
  const [analysisReport, setAnalysisReport] = useState<{
    title?: string;
    lyrics?: string;
    language?: string;
    vocalStyle?: string;
    vocalDescription?: string;
    bpm?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Handle file selection (video or audio)
  const handleFileChange = (file: File) => {
    if (!file) return;

    // Check size (limit ~35MB for client browser processing)
    if (file.size > 35 * 1024 * 1024) {
      showToast("ভিডিও ক্লিপের সাইজ ৩৫ মেগাবাইটের কম হতে হবে", "error");
      return;
    }

    setVideoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(objectUrl);

    // Read as Base64 for Gemini API analysis
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setVideoBase64(result);
      showToast(`ভিডিও ক্লিপ "${file.name}" সফলভাবে যুক্ত হয়েছে`, "success");
    };
    reader.onerror = () => {
      showToast("ভিডিও ফাইলটি পড়তে ব্যর্থ হয়েছে", "error");
    };
    reader.readAsDataURL(file);
  };

  // Sample quick loader for users testing without an immediate file
  const handleLoadSampleReference = () => {
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoBase64(null);
    setMode("extract");
    setCustomLyrics(
      `[Chorus]
I miss that kind of misery
The kind where you are nice to me
And say I was the one you wished you loved

[Verse 1]
I love you so much that it's dripping from my arms
I'm so sorry, I know I'm too much
Love to trust I'm nothing but`
    );
    setSelectedVoice("Kore");
    setSelectedStyle("indie");
    showToast("ভিডিওর রেফারেন্স লিরিক্স ও ইন্ডি-পপ স্টাইল লোড করা হয়েছে!", "info");
  };

  // Submit to backend
  const handleAnalyzeAndGenerate = async () => {
    if (!videoBase64 && !customLyrics.trim()) {
      showToast("অনুগ্রহ করে একটি ভিডিও ক্লিপ আপলোড করুন অথবা লিরিক্স দিন", "error");
      return;
    }

    setIsAnalyzing(true);
    setStatusMessage("ভিডিওর কন্ঠ, সুর ও লিরিক্স বিশ্লেষণ করা হচ্ছে (Gemini Flash)...");

    try {
      const payload: any = {
        videoBase64: videoBase64 || undefined,
        mimeType: videoFile ? videoFile.type : "video/mp4",
        videoName: videoFile ? videoFile.name : "reference_clip",
        customLyrics: mode === "custom_lyrics" || !videoBase64 ? customLyrics.trim() : undefined,
        voice: selectedVoice,
        overrideVocalStyle: selectedStyle,
      };

      const res = await fetch("/api/analyze-video-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "রেফারেন্স অডিও তৈরি করতে ব্যর্থ হয়েছে");
      }

      setStatusMessage("রেফারেন্সের মতো খাঁটি খালি কন্ঠ (Acapella) সিন্থেসাইজ করা হচ্ছে...");
      const data = await res.json();

      if (data.song) {
        const fullSong: Song = {
          ...data.song,
          referenceVideoUrl: videoPreviewUrl || undefined,
        };
        setGeneratedSong(fullSong);
        setAnalysisReport(data.analysis || null);
        onSongGenerated(fullSong);
        showToast("ভিডিও রেফারেন্স অনুযায়ী গানটি সফলভাবে তৈরি হয়েছে!", "success");
      }
    } catch (err: any) {
      console.error("Video reference error:", err);
      showToast(err.message || "সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন", "error");
    } finally {
      setIsAnalyzing(false);
      setStatusMessage("");
    }
  };

  // Download Audio WAV
  const handleDownloadAudio = () => {
    if (!generatedSong?.audioUrl) return;
    const a = document.createElement("a");
    a.href = generatedSong.audioUrl;
    const safeTitle = generatedSong.title.replace(/[^a-zA-Z0-9_\u0980-\u09FF\s-]/g, "").trim().replace(/\s+/g, "_");
    a.download = `${safeTitle || "reference_vocal"}_pure_acapella.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("গানটির অডিও (WAV) ডাউনলোড হয়েছে!", "success");
  };

  // Export LRC
  const handleDownloadLrc = () => {
    if (!generatedSong) return;
    let lrc = `[ti:${generatedSong.title}]\n[ar:${generatedSong.artist}]\n[al:LyricTTS Video Reference]\n[length:${Math.ceil(
      generatedSong.lines[generatedSong.lines.length - 1]?.startTime +
        generatedSong.lines[generatedSong.lines.length - 1]?.duration || 30
    )}]\n\n`;

    generatedSong.lines.forEach((l) => {
      const min = Math.floor(l.startTime / 60).toString().padStart(2, "0");
      const sec = Math.floor(l.startTime % 60).toString().padStart(2, "0");
      const ms = Math.floor((l.startTime % 1) * 100).toString().padStart(2, "0");
      lrc += `[${min}:${sec}.${ms}]${l.text}\n`;
    });

    const blob = new Blob([lrc], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedSong.title.replace(/\s+/g, "_")}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("LRC ফাইল ডাউনলোড হয়েছে!", "success");
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/60 via-zinc-900 to-indigo-950/60 border border-purple-800/40 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Video className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold font-['Space_Grotesk'] text-white">
                ভিডিও রেফারেন্স ভোকাল স্টুডিও (Video Reference Audio Studio)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-zinc-300">
              যেকোনো ভিডিও ক্লিপ আপলোড করুন। AI স্বয়ংক্রিয়ভাবে ভিডিওর গায়কীর সুর, কন্ঠের ভাব ও লিরিক্স বিশ্লেষণ করে সেই রেফারেন্স অনুযায়ী ১০০% খাঁটি খালি কন্ঠে (Pure Acapella) গান গেয়ে অডিও তৈরি করে দেবে।
            </p>
          </div>

          <button
            id="quick-sample-ref-btn"
            onClick={handleLoadSampleReference}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700 text-purple-200 border border-purple-500/30 flex items-center gap-2 transition-all self-start md:self-auto shrink-0 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>নমুনা রেফারেন্স লোড করুন</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Setup (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Upload Area */}
          <div className="p-6 rounded-3xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-400" />
                <span>ভিডিও ক্লিপ যুক্ত করুন (Video / Audio Clip)</span>
              </label>
              {videoFile && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> আপলোড প্রস্তুত
                </span>
              )}
            </div>

            {/* Drag and drop / file selector box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                videoFile
                  ? "border-purple-500/60 bg-purple-950/20"
                  : "border-zinc-700/80 hover:border-purple-500/60 bg-zinc-950/50 hover:bg-zinc-900/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,audio/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                }}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Upload className="w-6 h-6" />
              </div>

              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {videoFile ? videoFile.name : "ভিডিও ক্লিপ এখানে ড্রপ করুন অথবা সিলেক্ট করতে ক্লিক করুন"}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  MP4, WebM, MOV, বা অডিও ক্লিপ (সর্বোচ্চ ৩৫ মেগাবাইট)
                </p>
              </div>
            </div>

            {/* Video Preview Player if uploaded */}
            {videoPreviewUrl && (
              <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-video relative group">
                <video
                  src={videoPreviewUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>

          {/* Mode & Lyrics Configuration */}
          <div className="p-6 rounded-3xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>রেফারেন্স মোড নির্বাচন করুন</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("extract")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1.5 ${
                  mode === "extract"
                    ? "bg-purple-600/20 border-purple-500/60 text-white shadow-md shadow-purple-950/40"
                    : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold">ভিডিওর লিরিক্স + সুর</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  ভিডিওতে গাওয়া কথাগুলোই এআই ট্রান্সক্রাইব করে হুবহু সুরের রেফারেন্সে গাইবে।
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode("custom_lyrics")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1.5 ${
                  mode === "custom_lyrics"
                    ? "bg-purple-600/20 border-purple-500/60 text-white shadow-md shadow-purple-950/40"
                    : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Mic2 className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold">ভিডিওর সুর + আমার লিরিক্স</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  ভিডিওর গায়নভঙ্গিকে রেফারেন্স হিসেবে রেখে নিজের দেওয়া নতুন লিরিক্সে গান তৈরি হবে।
                </p>
              </button>
            </div>

            {/* Custom Lyrics Input (visible if mode is custom_lyrics or no video is yet uploaded) */}
            {(mode === "custom_lyrics" || !videoFile) && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">
                    {mode === "custom_lyrics" ? "আপনার নিজস্ব লিরিক্স লিখুন:" : "রেফারেন্স লিরিক্স:"}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    যেকোনো ভাষা (বাংলা/ইংরেজি/হিন্দি)
                  </span>
                </div>
                <textarea
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  placeholder="এখানে আপনার গানের লিরিক্স লিখুন... যেমন:
[Chorus]
I miss that kind of misery
The kind where you are nice to me...
[Verse 1]
I love you so much that it's dripping from my arms..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:border-purple-500/70 outline-none resize-none font-mono"
                />
              </div>
            )}

            {/* Voice & Vocal Style Customization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 mb-1.5 block">
                  কন্ঠশিল্পী (Vocal Model)
                </label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:border-purple-500 outline-none"
                >
                  <option value="Kore">Kore — কোমল, মিষ্টি ও পেলব নারী কন্ঠ (ভিডিওর সাথে সেরা মিল)</option>
                  <option value="Puck">Puck — তরতাজা ও সুরপ্রধান কন্ঠ</option>
                  <option value="Charon">Charon — গভীর ও আবেগঘন পুরুষ কন্ঠ</option>
                  <option value="Fenrir">Fenrir — গমগমে ও উষ্ণ পুরুষ কন্ঠ</option>
                  <option value="Zephyr">Zephyr — শান্ত ও পরিমিত কন্ঠ</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 mb-1.5 block">
                  ভোকাল স্টাইল (Vocal Vibe)
                </label>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value as VocalStyle)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:border-purple-500 outline-none"
                >
                  <option value="indie">✨ Indie Bedroom Pop — ভিডিওর মত নরম, ব্রেদি ও মিষ্টি মেলানকোলিক</option>
                  <option value="ballad">Soulful Ballad — গভীর আবেগ ও ধীর সুর</option>
                  <option value="melodic">Melodic Singing — সুরেলা মেলোডি</option>
                  <option value="pop">Pop Singing — আধুনিক পপ ছক</option>
                  <option value="rap">Rhythmic Flow — ছন্দময় ছোঁয়া</option>
                </select>
              </div>
            </div>

            {/* Generate Action Button */}
            <button
              id="generate-video-reference-btn"
              onClick={handleAnalyzeAndGenerate}
              disabled={isAnalyzing || (!videoBase64 && !customLyrics.trim())}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-purple-950/80 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.99]"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{statusMessage || "রেফারেন্স অডিও তৈরি হচ্ছে..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>ভিডিও রেফারেন্স অনুযায়ী গান তৈরি করুন (Generate Reference Audio)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Reference Comparison & Result (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {generatedSong ? (
            <div className="p-6 rounded-3xl bg-gradient-to-b from-purple-950/40 via-zinc-900 to-zinc-950 border border-purple-800/50 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    তৈরি হওয়া রেফারেন্স অডিও
                  </h3>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                  Pure Acapella
                </span>
              </div>

              {/* Song metadata card */}
              <div className="p-4 rounded-2xl bg-black/40 border border-purple-900/40 space-y-2">
                <h4 className="text-base font-bold text-white font-['Space_Grotesk']">
                  {generatedSong.title}
                </h4>
                <p className="text-xs text-purple-300 font-medium">
                  {generatedSong.artist}
                </p>
                {analysisReport?.vocalDescription && (
                  <p className="text-[11px] text-zinc-400 italic pt-1 border-t border-zinc-800/60">
                    "{analysisReport.vocalDescription}"
                  </p>
                )}
              </div>

              {/* Audio Player */}
              {generatedSong.audioUrl && (
                <div className="space-y-3">
                  <audio
                    ref={audioPreviewRef}
                    src={generatedSong.audioUrl}
                    onPlay={() => setIsPlayingAudio(true)}
                    onPause={() => setIsPlayingAudio(false)}
                    onEnded={() => setIsPlayingAudio(false)}
                    className="w-full h-10 rounded-xl"
                    controls
                  />

                  <div className="flex items-center gap-2">
                    <button
                      id="play-ref-acapella-btn"
                      onClick={() => {
                        if (audioPreviewRef.current) {
                          if (isPlayingAudio) audioPreviewRef.current.pause();
                          else audioPreviewRef.current.play();
                        }
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-950/60"
                    >
                      {isPlayingAudio ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-white" />
                          <span>পজ করুন</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>খালি কন্ঠ শুনুন (Play Vocals)</span>
                        </>
                      )}
                    </button>

                    <button
                      id="open-in-karaoke-btn"
                      onClick={() => onPlaySong(generatedSong)}
                      className="py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                      title="ভিডিওর মত কারাওকে বৃষ্টি ও নিয়ন স্ক্রিনে শুনুন"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>কারাওকেতে দেখুন</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Download Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                <button
                  id="download-ref-wav-btn"
                  onClick={handleDownloadAudio}
                  className="py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  title="গানটির WAV অডিও ডাউনলোড করুন"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>অডিও ডাউনলোড</span>
                </button>

                <button
                  id="download-ref-lrc-btn"
                  onClick={handleDownloadLrc}
                  className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                  title="টাইম-সিঙ্কড LRC ফাইল ডাউনলোড করুন"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  <span>LRC লিরিক্স</span>
                </button>
              </div>

              {/* Lines Preview */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  সিঙ্কড লিরিক্স ({generatedSong.lines.length} লাইন):
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs font-mono text-zinc-300 scrollbar-thin">
                  {generatedSong.lines.map((line, idx) => (
                    <div key={idx} className="flex items-start gap-2 py-0.5">
                      <span className="text-purple-400 text-[10px] shrink-0 font-bold">
                        [{Math.floor(line.startTime / 60)}:
                        {Math.floor(line.startTime % 60)
                          .toString()
                          .padStart(2, "0")}]
                      </span>
                      <span className="leading-snug">{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 text-center flex flex-col items-center justify-center gap-4 min-h-[380px]">
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Music className="w-8 h-8" />
              </div>
              <div className="max-w-xs space-y-1">
                <h4 className="text-sm font-bold text-white">রেফারেন্স অডিও তৈরি করুন</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  বামপাশে যেকোনো ভিডিও ক্লিপ আপলোড করুন অথবা নমুনা রেফারেন্স লোড করে বোতামটি চাপুন। AI সেই সুর ও ঢং মিলিয়ে নতুন খাঁটি খালি কন্ঠের অডিও প্রস্তুত করে দেবে।
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
