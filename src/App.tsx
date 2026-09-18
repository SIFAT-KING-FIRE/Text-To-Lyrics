import React, { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "./components/Header";
import { KaraokeLyricsView } from "./components/KaraokeLyricsView";
import { StudioEditorView } from "./components/StudioEditorView";
import { VideoReferenceStudio } from "./components/VideoReferenceStudio";
import { BottomPlayer } from "./components/BottomPlayer";
import { FullscreenKaraoke } from "./components/FullscreenKaraoke";
import { PRESET_SONGS } from "./data/presetSongs";
import { Song, LyricLine, VoiceName, VocalStyle } from "./types";
import { audioEngine } from "./utils/audioSynthesizer";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

export default function App() {
  const [presetSongs, setPresetSongs] = useState<Song[]>(PRESET_SONGS);
  const [currentSong, setCurrentSong] = useState<Song>(PRESET_SONGS[0]);
  const [activeTab, setActiveTab] = useState<"lyrics" | "studio" | "video_ref">("lyrics");

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);
  const [vocalVolume, setVocalVolume] = useState<number>(1.0);
  // Default beat volume is 0.0 so no background music plays - pure vocal singing only!
  const [beatVolume, setBeatVolume] = useState<number>(0.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Async state
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState<boolean>(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState<boolean>(false);
  const [isSingingCustom, setIsSingingCustom] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  // Visualizer canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Virtual time tracking when no audio element is loaded
  const startTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);

  const showToast = (text: string, type: "success" | "info" | "error" = "info") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Calculate total song duration based on last line
  const calculateTotalDuration = useCallback((song: Song): number => {
    if (!song.lines.length) return 30;
    const lastLine = song.lines[song.lines.length - 1];
    return Math.max(30, Number((lastLine.startTime + lastLine.duration + 1.5).toFixed(1)));
  }, []);

  const totalDuration = calculateTotalDuration(currentSong);

  // Visualizer frame loop
  useEffect(() => {
    const renderVisualizer = () => {
      if (canvasRef.current) {
        audioEngine.drawVisualizer(canvasRef.current, isPlaying ? "#f43f5e" : "#52525b");
      }
      animFrameIdRef.current = requestAnimationFrame(renderVisualizer);
    };

    animFrameIdRef.current = requestAnimationFrame(renderVisualizer);
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isPlaying]);

  // Stop playback when song changes
  const handleSelectSong = (song: Song) => {
    audioEngine.stopAudio();
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveLineIndex(0);
    playbackOffsetRef.current = 0;
    setCurrentSong(song);
  };

  // Synchronize playback timeline & update active lyric line
  useEffect(() => {
    let intervalId: number;

    if (isPlaying) {
      intervalId = window.setInterval(() => {
        let currentPos: number;

        if (currentSong.audioUrl) {
          currentPos = audioEngine.getAudioCurrentTime();
        } else {
          // Virtual clock based on high-res timestamp
          const elapsed = (performance.now() - startTimeRef.current) / 1000;
          currentPos = playbackOffsetRef.current + elapsed;
        }

        if (currentPos >= totalDuration) {
          if (isLooping) {
            handleSeek(0);
          } else {
            audioEngine.pauseAudio();
            setIsPlaying(false);
            setCurrentTime(0);
            setActiveLineIndex(0);
            playbackOffsetRef.current = 0;
          }
          return;
        }

        setCurrentTime(currentPos);

        // Find active line index
        const index = currentSong.lines.findIndex((line, i) => {
          const nextLine = currentSong.lines[i + 1];
          const endTime = nextLine ? nextLine.startTime : line.startTime + line.duration;
          return currentPos >= line.startTime && currentPos < endTime;
        });

        if (index !== -1) {
          setActiveLineIndex(index);
        } else if (currentSong.lines.length > 0 && currentPos < currentSong.lines[0].startTime) {
          setActiveLineIndex(0);
        }
      }, 50);
    }

    return () => clearInterval(intervalId);
  }, [isPlaying, currentSong, totalDuration, isLooping]);

  // Play / Pause Toggle
  const handlePlayPause = () => {
    audioEngine.initContext();

    if (isPlaying) {
      audioEngine.pauseAudio();
      playbackOffsetRef.current = currentTime;
      setIsPlaying(false);
    } else {
      startTimeRef.current = performance.now();

      // Backing instrumental track is played ONLY if user explicitly enabled it and style !== 'none'
      if (currentSong.backingTrackStyle !== "none" && beatVolume > 0) {
        audioEngine.startBackingTrack(
          currentSong.backingTrackStyle,
          currentSong.bpm,
          currentTime
        );
      } else {
        audioEngine.stopBackingTrack();
      }

      // Start vocal speech track if audioUrl exists
      if (currentSong.audioUrl) {
        audioEngine.playAudioUrl(currentSong.audioUrl, currentTime, () => {
          if (isLooping) {
            handleSeek(0);
          } else {
            setIsPlaying(false);
            setCurrentTime(0);
            setActiveLineIndex(0);
          }
        });
      } else {
        // Automatically synthesize vocal singing with Gemini TTS
        handleGenerateSpeech();

        // Fallback: Speak current active line with Web Speech if waiting
        const currentLine = currentSong.lines[activeLineIndex] || currentSong.lines[0];
        if (currentLine) {
          audioEngine.speakFallback(currentLine.text, "Google US English", 0.95, 1.1);
        }
      }

      setIsPlaying(true);
    }
  };

  // Seek to specific time
  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, time));
    setCurrentTime(clamped);
    playbackOffsetRef.current = clamped;
    startTimeRef.current = performance.now();

    if (currentSong.audioUrl) {
      audioEngine.seekAudio(clamped);
    }

    if (isPlaying) {
      if (currentSong.backingTrackStyle !== "none" && beatVolume > 0) {
        audioEngine.startBackingTrack(
          currentSong.backingTrackStyle,
          currentSong.bpm,
          clamped
        );
      } else {
        audioEngine.stopBackingTrack();
      }
    }

    // Update active line index
    const index = currentSong.lines.findIndex((l) => l.startTime >= clamped);
    setActiveLineIndex(index !== -1 ? Math.max(0, index - 1) : currentSong.lines.length - 1);
  };

  // Seek directly to a lyric line
  const handleSeekLine = (index: number) => {
    if (index >= 0 && index < currentSong.lines.length) {
      const targetLine = currentSong.lines[index];
      handleSeek(targetLine.startTime);
      setActiveLineIndex(index);

      if (!isPlaying) {
        // Auto start playback on line click for instant karaoke feel
        setTimeout(() => {
          handlePlayPause();
        }, 50);
      }
    }
  };

  const handlePrevLine = () => {
    if (activeLineIndex > 0) {
      handleSeekLine(activeLineIndex - 1);
    }
  };

  const handleNextLine = () => {
    if (activeLineIndex < currentSong.lines.length - 1) {
      handleSeekLine(activeLineIndex + 1);
    }
  };

  const handleRestart = () => {
    handleSeek(0);
    setActiveLineIndex(0);
  };

  // Volume Handlers
  const handleVocalVolumeChange = (vol: number) => {
    setVocalVolume(vol);
    audioEngine.setVocalVolume(vol);
  };

  const handleBeatVolumeChange = (vol: number) => {
    setBeatVolume(vol);
    audioEngine.setBeatVolume(vol);
  };

  // Synthesize Text-to-Speech via Server-Side Gemini TTS
  const handleGenerateSpeech = async () => {
    setIsGeneratingSpeech(true);
    showToast("Synthesizing song lyrics with Gemini TTS...", "info");

    try {
      // Assemble full song lyrics with rhythm markers
      const fullLyricsText = currentSong.lines.map((l) => l.text).join(". ");

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullLyricsText,
          voice: currentSong.voice,
          style: currentSong.vocalStyle,
          bpm: currentSong.bpm,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate speech audio");
      }

      const data = await res.json();
      if (data.audioUrl) {
        setCurrentSong((prev) => ({
          ...prev,
          audioUrl: data.audioUrl,
        }));
        if (data.notice) {
          showToast(data.notice, "info");
        } else {
          showToast("AI Song Vocals generated successfully! Hit Play to listen.", "success");
        }
      }
    } catch (err: any) {
      console.warn("Gemini TTS endpoint error, falling back to Web Audio synthesis:", err);
      showToast(
        "Using instant client-side musical speech synthesizer (Server Gemini TTS fallback).",
        "info"
      );
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  // Handle singing custom raw lyrics with pure vocals (no background music)
  const handleSingCustomLyrics = async (
    lyrics: string,
    title: string,
    voice: VoiceName,
    style: VocalStyle
  ) => {
    setIsSingingCustom(true);
    showToast("লিরিক্স সুরে বেঁধে গান তৈরি হচ্ছে (Synthesizing Pure Vocals)...", "info");

    try {
      const res = await fetch("/api/sing-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics,
          title,
          voice,
          style,
          bpm: 82,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to sing lyrics");
      }

      const newSong: Song = await res.json();

      // Guarantee no background music
      newSong.backingTrackStyle = "none";

      // Stop previous audio
      audioEngine.stopAudio();
      audioEngine.stopBackingTrack();
      setIsPlaying(false);
      setCurrentTime(0);
      setActiveLineIndex(0);
      playbackOffsetRef.current = 0;

      // Update songs list and current song
      setPresetSongs((prev) => [newSong, ...prev.filter((s) => s.id !== newSong.id)]);
      setCurrentSong(newSong);

      showToast(`"${newSong.title}" কন্ঠে গান গাওয়া শুরু হচ্ছে! (Pure Vocals)`, "success");

      // Auto start playback with pure vocal singing
      setTimeout(() => {
        audioEngine.initContext();
        audioEngine.stopBackingTrack(); // Guarantee no background music!

        if (newSong.audioUrl) {
          startTimeRef.current = performance.now();
          audioEngine.playAudioUrl(newSong.audioUrl, 0, () => {
            setIsPlaying(false);
            setCurrentTime(0);
            setActiveLineIndex(0);
          });
          setIsPlaying(true);
        } else {
          const firstLine = newSong.lines[0]?.text || lyrics;
          audioEngine.speakFallback(firstLine, "Google US English", 0.95, 1.1);
          setIsPlaying(true);
        }
      }, 350);
    } catch (err: any) {
      console.error("Failed to sing lyrics:", err);
      showToast(err.message || "Failed to sing lyrics", "error");
    } finally {
      setIsSingingCustom(false);
    }
  };

  // Generate Song Lyrics via Server-Side Gemini
  const handleGenerateAiLyrics = async (prompt: string, genre: string, mood: string) => {
    setIsGeneratingLyrics(true);
    showToast("Gemini is composing custom song lyrics & rhythmic timing...", "info");

    try {
      const res = await fetch("/api/generate-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt || "Late night neon city drive",
          genre: genre || "Pop",
          mood: mood || "Euphoric",
          bpm: currentSong.bpm,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate lyrics");
      }

      const songData = await res.json();

      const newSong: Song = {
        id: `ai-song-${Date.now()}`,
        title: songData.title || "Electric Dreams",
        artist: songData.artist || "AI Songwriter",
        genre: songData.genre || genre,
        mood: songData.mood || mood,
        bpm: songData.bpm || currentSong.bpm,
        key: songData.key || "C Major",
        themeColor: "from-rose-500 via-purple-600 to-indigo-600",
        vocalStyle: currentSong.vocalStyle,
        voice: currentSong.voice,
        backingTrackStyle: (genre.toLowerCase().includes("lofi")
          ? "lofi"
          : genre.toLowerCase().includes("trap") || genre.toLowerCase().includes("hip")
          ? "trap"
          : genre.toLowerCase().includes("synth")
          ? "synthwave"
          : "pop") as any,
        lines: songData.lines || currentSong.lines,
        audioUrl: undefined,
      };

      audioEngine.stopAudio();
      setIsPlaying(false);
      setCurrentTime(0);
      setActiveLineIndex(0);
      setCurrentSong(newSong);
      setActiveTab("lyrics");

      showToast(`Created "${newSong.title}" with ${newSong.lines.length} synchronized lines!`, "success");
    } catch (err: any) {
      console.error("Lyrics generation failed:", err);
      showToast(err.message || "Failed to generate lyrics. Please try again.", "error");
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  // Export Lyrics to standard Karaoke (.lrc) format
  const handleExportLrc = () => {
    const header = `[ti:${currentSong.title}]\n[ar:${currentSong.artist}]\n[al:${currentSong.genre}]\n[by:LyricTTS]\n\n`;
    const lines = currentSong.lines
      .map((l) => {
        const m = Math.floor(l.startTime / 60);
        const s = Math.floor(l.startTime % 60);
        const ms = Math.floor((l.startTime % 1) * 100);
        const timestamp = `[${m.toString().padStart(2, "0")}:${s
          .toString()
          .padStart(2, "0")}.${ms.toString().padStart(2, "0")}]`;
        return `${timestamp} ${l.text}`;
      })
      .join("\n");

    const fullContent = header + lines;
    const blob = new Blob([fullContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentSong.title.toLowerCase().replace(/\s+/g, "_")}_lyrics.lrc`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported synchronized LRC karaoke lyrics file!", "success");
  };

  // Download Audio WAV of the current song (synthesizes first if not yet generated)
  const handleDownloadAudio = async () => {
    try {
      let audioToDownload = currentSong.audioUrl;
      if (!audioToDownload) {
        showToast("গানটির অডিও সিন্থেসাইজ করা হচ্ছে, অনুগ্রহ করে একটু অপেক্ষা করুন...", "info");
        const fullLyrics = currentSong.lines.map((l) => l.text).join("\n");
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: fullLyrics,
            voice: currentSong.voice,
            style: currentSong.vocalStyle,
            bpm: currentSong.bpm,
          }),
        });
        const data = await response.json();
        if (data.audioUrl) {
          audioToDownload = data.audioUrl;
          setCurrentSong((prev) => ({ ...prev, audioUrl: data.audioUrl }));
        } else {
          showToast(data.error || "অডিও প্রস্তুত করা যায়নি", "error");
          return;
        }
      }

      if (!audioToDownload) {
        showToast("অডিও প্রস্তুত করা যায়নি", "error");
        return;
      }

      const a = document.createElement("a");
      a.href = audioToDownload;
      const safeTitle = currentSong.title.replace(/[^a-zA-Z0-9_\u0980-\u09FF\s-]/g, "").trim().replace(/\s+/g, "_");
      a.download = `${safeTitle || "song"}_pure_vocals.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`"${currentSong.title}" গানটির অডিও সফলভাবে ডাউনলোড হয়েছে!`, "success");
    } catch (err: any) {
      console.error("Download error:", err);
      showToast("গান ডাউনলোড করতে সমস্যা হয়েছে", "error");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-['Plus_Jakarta_Sans'] pb-28">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 text-xs font-semibold ${
              toastMessage.type === "success"
                ? "bg-emerald-950/90 border-emerald-700/80 text-emerald-200 shadow-emerald-950/50"
                : toastMessage.type === "error"
                ? "bg-rose-950/90 border-rose-700/80 text-rose-200 shadow-rose-950/50"
                : "bg-zinc-900/90 border-zinc-700/80 text-zinc-200 shadow-black/60"
            }`}
          >
            {toastMessage.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {toastMessage.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {toastMessage.type === "info" && <Info className="w-4 h-4 text-purple-400" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main App Navigation Header */}
      <Header
        currentSong={currentSong}
        presetSongs={presetSongs}
        onSelectSong={handleSelectSong}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onExport={handleExportLrc}
        onDownloadAudio={handleDownloadAudio}
        isGenerating={isGeneratingSpeech || isGeneratingLyrics}
      />

      {/* Dynamic Content View */}
      <main className="flex-1 w-full">
        {activeTab === "lyrics" ? (
          <KaraokeLyricsView
            song={currentSong}
            currentTime={currentTime}
            duration={totalDuration}
            isPlaying={isPlaying}
            activeLineIndex={activeLineIndex}
            onSeekLine={handleSeekLine}
            onPlayPause={handlePlayPause}
            onGenerateSpeech={handleGenerateSpeech}
            isGeneratingSpeech={isGeneratingSpeech}
            hasCachedAudio={Boolean(currentSong.audioUrl)}
            canvasRef={canvasRef}
            onSingCustomLyrics={handleSingCustomLyrics}
            isSingingCustom={isSingingCustom}
            onDownloadAudio={handleDownloadAudio}
            onExportLrc={handleExportLrc}
            onOpenVideoRef={() => setActiveTab("video_ref")}
          />
        ) : activeTab === "studio" ? (
          <StudioEditorView
            song={currentSong}
            onUpdateSong={setCurrentSong}
            onGenerateSpeech={handleGenerateSpeech}
            isGeneratingSpeech={isGeneratingSpeech}
            onGenerateAiLyrics={handleGenerateAiLyrics}
            isGeneratingLyrics={isGeneratingLyrics}
          />
        ) : (
          <div className="p-4 sm:p-6 md:p-8">
            <VideoReferenceStudio
              onSongGenerated={(newSong) => {
                setPresetSongs((prev) => [newSong, ...prev.filter((s) => s.id !== newSong.id)]);
                setCurrentSong(newSong);
                handleSelectSong(newSong);
              }}
              onPlaySong={(song) => {
                setCurrentSong(song);
                handleSelectSong(song);
                setActiveTab("lyrics");
                setTimeout(() => {
                  handlePlayPause();
                }, 150);
              }}
              showToast={showToast}
            />
          </div>
        )}
      </main>

      {/* Fixed Sticky Transport Player */}
      <BottomPlayer
        song={currentSong}
        currentTime={currentTime}
        duration={totalDuration}
        isPlaying={isPlaying}
        activeLineIndex={activeLineIndex}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onPrevLine={handlePrevLine}
        onNextLine={handleNextLine}
        onRestart={handleRestart}
        vocalVolume={vocalVolume}
        beatVolume={beatVolume}
        onVocalVolumeChange={handleVocalVolumeChange}
        onBeatVolumeChange={handleBeatVolumeChange}
        isLooping={isLooping}
        onToggleLoop={() => setIsLooping(!isLooping)}
        onToggleFullscreen={() => setIsFullscreen(true)}
        onDownloadAudio={handleDownloadAudio}
      />

      {/* Fullscreen Karaoke Mode Modal */}
      {isFullscreen && (
        <FullscreenKaraoke
          song={currentSong}
          currentTime={currentTime}
          duration={totalDuration}
          isPlaying={isPlaying}
          activeLineIndex={activeLineIndex}
          onPlayPause={handlePlayPause}
          onPrevLine={handlePrevLine}
          onNextLine={handleNextLine}
          onClose={() => setIsFullscreen(false)}
          onSeekLine={handleSeekLine}
        />
      )}
    </div>
  );
}
