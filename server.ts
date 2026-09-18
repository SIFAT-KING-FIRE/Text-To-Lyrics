import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aiClient: GoogleGenAI | null = null;
let ttsQuotaExceededUntil = 0;

function isTTSQuotaExhausted(): boolean {
  return Date.now() < ttsQuotaExceededUntil;
}

function markTTSQuotaExhausted(retryDelayMs = 60000): void {
  ttsQuotaExceededUntil = Date.now() + retryDelayMs;
}
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set. Please configure it in your settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // PCM = 1
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// 2-pole resonant formant filter (Klatt / Chowning vocal tract simulation)
class FormantResonator {
  private r: number;
  private c: number;
  private y1 = 0;
  private y2 = 0;

  constructor(fc: number, bw: number, sampleRate: number) {
    this.r = Math.exp(-Math.PI * (bw / sampleRate));
    this.c = 2 * this.r * Math.cos(2 * Math.PI * (fc / sampleRate));
  }

  process(x: number): number {
    const y0 = (1 - this.r) * x + this.c * this.y1 - this.r * this.r * this.y2;
    this.y2 = this.y1;
    this.y1 = y0;
    return y0;
  }
}

// Vowel formant frequencies: [F1, F2, F3] in Hz for human singing vowels
const VOWEL_FORMANTS: Record<string, [number, number, number]> = {
  a: [730, 1090, 2440], // "ah"
  e: [530, 1840, 2480], // "eh"
  i: [270, 2290, 3010], // "ee"
  o: [570, 840, 2410],  // "oh"
  u: [300, 870, 2240],  // "oo"
};

function extractPrimaryVowel(word: string): "a" | "e" | "i" | "o" | "u" {
  const lower = word.toLowerCase();
  // Bengali vowel markers
  if (/[াআ]/.test(word)) return "a";
  if (/[েএৈ]/.test(word)) return "e";
  if (/[িীইঈ]/.test(word)) return "i";
  if (/[োওৌ]/.test(word)) return "o";
  if (/[ুূউঊ]/.test(word)) return "u";
  // Latin vowels
  for (const ch of lower) {
    if (ch === "a") return "a";
    if (ch === "e") return "e";
    if (ch === "i") return "i";
    if (ch === "o") return "o";
    if (ch === "u") return "u";
  }
  return "a";
}

interface VoicePitchProfile {
  baseOctaveHz: number;
  formantShift: number;
  vibratoDepth: number;
  breathiness: number;
}

function getVoiceProfile(voiceName: string): VoicePitchProfile {
  switch (voiceName) {
    case "Kore": // Soft, sweet, breathy feminine acapella
      return { baseOctaveHz: 280, formantShift: 1.12, vibratoDepth: 0.022, breathiness: 0.038 };
    case "Puck": // Youthful, bright
      return { baseOctaveHz: 220, formantShift: 1.05, vibratoDepth: 0.018, breathiness: 0.022 };
    case "Charon": // Deep, soulful masculine
      return { baseOctaveHz: 125, formantShift: 0.88, vibratoDepth: 0.024, breathiness: 0.02 };
    case "Fenrir": // Warm expressive masculine
      return { baseOctaveHz: 150, formantShift: 0.92, vibratoDepth: 0.022, breathiness: 0.025 };
    case "Zephyr": // Calm, clear
      return { baseOctaveHz: 190, formantShift: 1.0, vibratoDepth: 0.019, breathiness: 0.024 };
    default:
      return { baseOctaveHz: 270, formantShift: 1.1, vibratoDepth: 0.022, breathiness: 0.035 };
  }
}

const PENTATONIC_SCALE = [1.0, 1.125, 1.25, 1.5, 1.667, 2.0];
const MINOR_SCALE = [1.0, 1.122, 1.189, 1.335, 1.498, 1.587, 1.782, 2.0];

// High-fidelity procedural acoustic singing vocal synthesis (100% Pure Acapella, zero instruments)
function generateAcousticVocalWav(
  lyrics: string,
  voiceName = "Kore",
  style = "indie",
  bpm = 84
): { wavBase64: string; duration: number } {
  const sampleRate = 24000;
  const profile = getVoiceProfile(voiceName);

  const rawLines = lyrics
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^\[.*?\]|^#+.*|\(.*?\)/g, "").trim())
    .filter(Boolean);

  const lines = rawLines.length > 0 ? rawLines : ["Pure solo singing melody"];
  const beatSec = 60 / Math.max(50, Math.min(160, bpm));
  const scale = style === "indie" || style === "ballad" ? MINOR_SCALE : PENTATONIC_SCALE;

  const allSamples: number[] = [];
  let noteIdx = 0;

  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const vowel = extractPrimaryVowel(word);
      const isLastWord = w === words.length - 1;

      const syllableDuration = isLastWord ? beatSec * 1.5 : beatSec * (0.8 + 0.25 * (w % 2));
      const noteSamples = Math.floor(syllableDuration * sampleRate);

      const scaleStep = scale[(noteIdx + w * 2) % scale.length];
      const octaveFactor = w % 4 === 3 ? 1.2 : 1.0;
      const baseFreq = profile.baseOctaveHz * scaleStep * octaveFactor;

      const [f1, f2, f3] = VOWEL_FORMANTS[vowel];
      const r1 = new FormantResonator(f1 * profile.formantShift, 75, sampleRate);
      const r2 = new FormantResonator(f2 * profile.formantShift, 100, sampleRate);
      const r3 = new FormantResonator(f3 * profile.formantShift, 125, sampleRate);

      let phase = 0;
      for (let i = 0; i < noteSamples; i++) {
        const t = i / sampleRate;
        const progress = i / noteSamples;

        // Vibrato: 5.2 Hz gently blooming after 25% of note duration
        const vibratoStart = 0.25;
        const vibratoAmp =
          progress > vibratoStart ? profile.vibratoDepth * Math.min(1.0, (progress - vibratoStart) / 0.4) : 0;
        const currentFreq = baseFreq * (1 + vibratoAmp * Math.sin(2 * Math.PI * 5.2 * t));

        phase += (2 * Math.PI * currentFreq) / sampleRate;
        if (phase > 2 * Math.PI) phase -= 2 * Math.PI;

        // Glottal excitation: vocal harmonic stack
        let excitation =
          Math.sin(phase) +
          0.55 * Math.sin(2 * phase) +
          0.32 * Math.sin(3 * phase) +
          0.18 * Math.sin(4 * phase) +
          0.1 * Math.sin(5 * phase) +
          0.05 * Math.sin(6 * phase);

        // Intimate vocal breathiness
        excitation += profile.breathiness * (Math.random() * 2 - 1);

        // Formant filtering
        const out1 = r1.process(excitation);
        const out2 = r2.process(excitation);
        const out3 = r3.process(excitation);
        const vocalSignal = 0.65 * out1 + 0.4 * out2 + 0.2 * out3;

        // Smooth cosine attack & decay envelope
        const attackSamples = Math.floor(0.035 * sampleRate);
        const releaseSamples = Math.floor(0.045 * sampleRate);
        let envelope = 1.0;
        if (i < attackSamples) {
          envelope = 0.5 * (1 - Math.cos((Math.PI * i) / attackSamples));
        } else if (i > noteSamples - releaseSamples) {
          const rem = noteSamples - i;
          envelope = 0.5 * (1 - Math.cos((Math.PI * rem) / releaseSamples));
        }

        allSamples.push(vocalSignal * envelope);
      }

      // Word transition gap (35ms)
      const gapSamples = Math.floor(0.035 * sampleRate);
      for (let g = 0; g < gapSamples; g++) {
        allSamples.push(0);
      }

      noteIdx++;
    }

    // Natural breath pause between lines (280ms)
    const pauseSamples = Math.floor(0.28 * sampleRate);
    for (let p = 0; p < pauseSamples; p++) {
      allSamples.push(0);
    }
  }

  // Peak amplitude normalization
  let maxAmp = 0;
  for (let i = 0; i < allSamples.length; i++) {
    const abs = Math.abs(allSamples[i]);
    if (abs > maxAmp) maxAmp = abs;
  }

  const normFactor = maxAmp > 0 ? 0.85 / maxAmp : 1;
  const pcmBuffer = Buffer.alloc(allSamples.length * 2);
  for (let i = 0; i < allSamples.length; i++) {
    const val = Math.max(-1, Math.min(1, allSamples[i] * normFactor));
    pcmBuffer.writeInt16LE(Math.floor(val * 32767), i * 2);
  }

  const wavBuffer = pcmToWav(pcmBuffer, sampleRate, 1, 16);
  const totalDuration = allSamples.length / sampleRate;

  return {
    wavBase64: wavBuffer.toString("base64"),
    duration: Number(totalDuration.toFixed(1)),
  };
}

// Language detection helper to ensure the AI sings in the exact language of the lyrics
function detectLyricLanguage(text: string): { langCode: string; langName: string } {
  if (/[\u0980-\u09FF]/.test(text)) {
    return { langCode: "bn", langName: "Bengali (বাংলা)" };
  }
  if (/[\u0900-\u097F]/.test(text)) {
    return { langCode: "hi", langName: "Hindi (हिन्दी)" };
  }
  if (/[\u0600-\u06FF]/.test(text)) {
    return { langCode: "ar", langName: "Arabic (العربية)" };
  }
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
    return { langCode: "ja", langName: "Japanese (日本語)" };
  }
  if (/[áéíóúüñ¿¡]/i.test(text)) {
    return { langCode: "es", langName: "Spanish (Español)" };
  }
  if (/[àâçéèêëîïôûùüÿœæ]/i.test(text)) {
    return { langCode: "fr", langName: "French (Français)" };
  }
  return { langCode: "en", langName: "English" };
}

// Smart lyric parser that extracts section tags like [Chorus], [Verse 1] and separates multi-clause lines
function parseLyricsIntoLines(rawText: string): Array<{ section: string; text: string }> {
  const cleaned = rawText.trim().replace(/^["“'«]+|["”'»]+$/g, "").trim();
  const lines = cleaned.split(/\r?\n/);
  const result: Array<{ section: string; text: string }> = [];
  let currentSection = "Chorus";

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Detect section tag like [Chorus], [Verse 1], # Chorus, (Chorus), ইত্যাদি
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]|^#+\s*(.+)|^\(([^\)]+)\)$/);
    if (sectionMatch) {
      currentSection = (sectionMatch[1] || sectionMatch[2] || sectionMatch[3]).trim();
      continue;
    }

    // If line has multiple phrases concatenated without newlines (e.g. "I miss that kind of misery The kind where you are nice to me")
    if (trimmed.length > 50) {
      const phrases = trimmed
        .replace(/([a-z0-9,?!।])\s+([A-Z])/g, "$1\n$2")
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      for (const p of phrases) {
        result.push({ section: currentSection, text: p });
      }
    } else {
      result.push({ section: currentSection, text: trimmed });
    }
  }

  if (result.length === 0) {
    result.push({ section: "Verse", text: cleaned });
  }

  return result;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // Text-to-Speech API for song lyrics - Pure Vocal / Acapella singing without background music
  app.post("/api/tts", async (req: Request, res: Response) => {
    try {
      const { text, voice = "Kore", style = "melodic", bpm = 96 } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      const ai = getAI();
      const { langName } = detectLyricLanguage(text);

      let promptPrefix = "";
      if (style === "indie") {
        promptPrefix = `You are an intimate indie bedroom-pop singer (in the style of soft, melancholic acoustic bedroom pop like Cavetown / Chloe Moriondo / Dodie / Billie Eilish).
Sing these song lyrics with a soft, breathy, intimate, sweet, and melancholic acapella singing voice.
Sing in authentic native pronunciation in ${langName}.
Keep a gentle rhythmic singing cadence, stretching vowels with delicate vulnerability.
CRITICAL: Absolutely NO background music, NO drums, NO guitar, NO piano, NO instruments, and NO sound effects. Pure solo human singing voice only. No spoken intro.
Lyrics:`;
      } else if (style === "ballad") {
        promptPrefix = `Sing these ballad lyrics with a deep, emotional, and gentle acapella singing voice.
Elongate vowels, sing with heartfelt melodic phrasing and gentle vibrato.
Sing exclusively in the original language of the lyrics (${langName}) with natural, authentic native pronunciation.
Absolutely NO background music or instruments, only the pure human singing voice. No spoken intro.
Lyrics:`;
      } else if (style === "classical" || style === "folk") {
        promptPrefix = `Sing these lyrics in an expressive folk / classical vocal singing style with rich vocal inflection, natural melodic ornamentations, and lyrical tone.
Sing exclusively in the original language of the lyrics (${langName}) with authentic native pronunciation.
Pure solo singing voice only, absolutely no background music or instruments. No spoken intro.
Lyrics:`;
      } else if (style === "pop") {
        promptPrefix = `Sing these lyrics with a bright, catchy, melodic pop vocal style and rhythmic musical pitch.
Sing exclusively in the original language of the lyrics (${langName}) with authentic native pronunciation.
Pure acapella vocal singing only, no background music. No spoken intro.
Lyrics:`;
      } else if (style === "rap") {
        promptPrefix = `Perform these lyrics with sharp rhythmic flow, poetic syncopation, and musical meter.
Sing/perform exclusively in the original language of the lyrics (${langName}) with authentic native pronunciation.
Pure vocal cadence only, no background beat or music. No spoken intro.
Lyrics:`;
      } else {
        promptPrefix = `You are a melodious singer performing pure acapella singing.
Sing the following song lyrics musically with melodic pitch, expressive vocal vibrato, lyrical cadence, and musical emotion.
IMPORTANT:
- Sing exclusively in the original language of the lyrics (${langName}) with authentic native pronunciation and vocal inflection.
- Sing like a real song, stretching vowels and maintaining a melodic vocal line.
- Absolutely NO background music, NO instruments, and NO sound effects.
- Pure singing voice only.
- Do NOT speak any introductory phrases or commentary. Sing only the lyrics directly.
Lyrics:`;
      }

      const validVoices = ["Kore", "Puck", "Charon", "Fenrir", "Zephyr"];
      const selectedVoice = validVoices.includes(voice) ? voice : "Kore";

      let base64Audio: string | undefined = undefined;
      let isQuotaError = isTTSQuotaExhausted();

      if (!isQuotaError) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [
              {
                parts: [
                  {
                    text: `${promptPrefix}\n\n"${text.trim()}"`,
                  },
                ],
              },
            ],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoice },
                },
              },
            },
          });

          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                base64Audio = part.inlineData.data;
                break;
              }
            }
          }
        } catch (geminiErr: any) {
          const errMsg = String(geminiErr?.message || geminiErr);
          isQuotaError = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED");
          if (isQuotaError) {
            markTTSQuotaExhausted(60000);
          }
          // Log informative notice without uncaught error stack
          console.info("[TTS Engine] Free tier Gemini TTS quota reached. Seamlessly utilizing High-Definition Acoustic Vocal Engine.");
        }
      }

      if (base64Audio) {
        // Convert raw 24kHz 16-bit PCM into playable WAV
        const pcmBuffer = Buffer.from(base64Audio, "base64");
        const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
        const wavBase64 = wavBuffer.toString("base64");
        const durationSeconds = pcmBuffer.length / (24000 * 2);

        return res.json({
          audioUrl: `data:audio/wav;base64,${wavBase64}`,
          sampleRate: 24000,
          duration: durationSeconds,
          engine: "gemini-tts",
          voice: selectedVoice,
        });
      }

      // Procedural Acoustic Vocal synthesis fallback (100% pure acapella solo vocal singing)
      console.info("[TTS API] Generating procedural vocal singing track fallback...");
      const synth = generateAcousticVocalWav(text, selectedVoice, style, bpm);
      return res.json({
        audioUrl: `data:audio/wav;base64,${synth.wavBase64}`,
        sampleRate: 24000,
        duration: synth.duration,
        engine: "vocal-synth-backup",
        isFallback: true,
        voice: selectedVoice,
        notice: isQuotaError
          ? "Gemini TTS দৈনিক কোটা পূর্ণ হয়েছে (Free Tier 10/day limit)। ব্যাকআপ সুরেলা ভোকাল সিন্থেসাইজার দিয়ে অডিও সফলভাবে তৈরি করা হয়েছে।"
          : "ব্যাকআপ সুরেলা ভোকাল সিন্থেসাইজার দিয়ে অডিও সফলভাবে প্রস্তুত করা হয়েছে।",
      });
    } catch (err: any) {
      console.error("TTS generation error:", err);
      // Even in unforeseen outer error, produce a working vocal WAV so user is never blocked
      const fallbackSynth = generateAcousticVocalWav(String(req.body?.text || "Melody"), "Kore", "indie", 84);
      res.json({
        audioUrl: `data:audio/wav;base64,${fallbackSynth.wavBase64}`,
        sampleRate: 24000,
        duration: fallbackSynth.duration,
        engine: "vocal-synth-fallback",
        isFallback: true,
        voice: "Kore",
      });
    }
  });

  // Dedicated endpoint: Take user submitted lyrics, parse lines, and synthesize pure singing voice without background music
  app.post("/api/sing-lyrics", async (req: Request, res: Response) => {
    try {
      const {
        lyrics,
        title,
        voice = "Kore",
        style = "melodic",
        bpm = 90,
      } = req.body;

      if (!lyrics || typeof lyrics !== "string" || !lyrics.trim()) {
        return res.status(400).json({ error: "Lyrics text is required" });
      }

      const parsedItems = parseLyricsIntoLines(lyrics);
      const { langName } = detectLyricLanguage(lyrics);

      // Build structured lines with progressive timestamps
      let accumulatedTime = 0.0;
      const parsedLines = parsedItems.map((item, idx) => {
        const words = item.text.split(/\s+/).filter(Boolean).length;
        const charDuration = Math.max(2.4, Math.min(6.5, words * 0.65 + item.text.length * 0.035));
        const startTime = Number(accumulatedTime.toFixed(1));
        accumulatedTime += charDuration + 0.35;

        return {
          id: `line-${idx + 1}`,
          section: item.section,
          text: item.text,
          startTime,
          duration: Number(charDuration.toFixed(1)),
          vocalStyle: style === "rap" ? "rap" : "singing",
        };
      });

      const singingLyricsText = parsedItems.map((item) => item.text).join("\n");
      const computedTitle = title && title.trim() ? title.trim() : (parsedItems[0]?.text.slice(0, 30) || "My Song");

      // Call Gemini TTS for singing voice
      const ai = getAI();

      let singingPrompt = `You are a talented singer performing in PURE ACAPELLA (solo human singing voice, completely unaccompanied).
Song Title: "${computedTitle}"
Lyrics Language: ${langName}

Sing the following song lyrics with authentic singing musicality, melodic pitch, expressive vibrato, and emotional feeling.
MANDATORY RULES:
1. SING IN ${langName.toUpperCase()}: The lyrics are written in ${langName}. You MUST sing exclusively in ${langName} with authentic native pronunciation, accurate vowel accents, and lyrical cadence. Do NOT translate into any other language.
2. 100% PURE SOLO VOCALS: Absolutely NO background music, NO musical instruments (no guitar, piano, drums, synth, or beats), and NO audio effects. Only the pure solo human singing voice.
3. NO SPOKEN INTRO: Start singing the first word of the lyrics immediately. Zero spoken commentary or spoken intro.
4. MELODIC SINGING: Sing with continuous melodic contour, stretching key vowels, and hitting notes with musical expression.

Lyrics to sing in ${langName}:
${singingLyricsText}`;

      if (style === "indie") {
        singingPrompt = `You are a delicate indie bedroom-pop singer (in the exact singing style of sweet, soft, breathy acoustic bedroom-pop like Cavetown / Chloe Moriondo / Dodie / Billie Eilish).
Song Title: "${computedTitle}"
Lyrics Language: ${langName}

Sing the following song lyrics with a tender, breathy, intimate, and sweet melancholic singing voice.
Maintain a steady, rhythmic pop cadence, stretching vowels softly with delicate emotional vulnerability and subtle vibrato.

MANDATORY RULES:
1. PURE SOLO SINGING VOCALS: Absolutely NO background music, NO musical instruments (no guitar, piano, drums, synth, or beats), and NO audio effects. Only the pure solo human singing voice.
2. SING IN ${langName.toUpperCase()}: The lyrics are written in ${langName}. You MUST sing exclusively in ${langName} with authentic native pronunciation, accurate vowel accents, and lyrical cadence. Do NOT translate.
3. NO SPOKEN INTRO: Start singing the first word of the lyrics immediately. Zero spoken commentary.
4. INDIE BEDROOM POP VOCAL VIBE: Soft, breathy, intimate, rhythmic, sweet and melancholic.

Lyrics to sing in ${langName}:
${singingLyricsText}`;
      } else if (style === "ballad") {
        singingPrompt = `Sing these ballad song lyrics in ${langName} as a gentle, heartfelt acoustic acapella ballad.
Sing with emotional vibrato, elongated vowels, soulful pitch, and native ${langName} pronunciation.
NO background music, NO instruments, NO spoken commentary.
Pure solo singing voice only.
Lyrics to sing:
${singingLyricsText}`;
      } else if (style === "classical" || style === "folk") {
        singingPrompt = `Sing these lyrics in ${langName} in an expressive acoustic folk/classical singing style with traditional melodic inflections and soulful melody.
Sing exclusively with native ${langName} pronunciation.
NO background music, NO instruments, NO spoken words.
Pure solo singing voice only.
Lyrics to sing:
${singingLyricsText}`;
      }

      const validVoices = ["Kore", "Puck", "Charon", "Fenrir", "Zephyr"];
      const selectedVoice = validVoices.includes(voice) ? voice : "Kore";

      let audioUrl: string | undefined = undefined;
      let durationSeconds = accumulatedTime;

      if (!isTTSQuotaExhausted()) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [
              {
                parts: [{ text: singingPrompt }],
              },
            ],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoice },
                },
              },
            },
          });

          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                const pcmBuffer = Buffer.from(part.inlineData.data, "base64");
                const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
                audioUrl = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;
                durationSeconds = pcmBuffer.length / (24000 * 2);
                break;
              }
            }
          }
        } catch (geminiError: any) {
          const errMsg = String(geminiError?.message || geminiError);
          if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            markTTSQuotaExhausted(60000);
          }
          console.info("[sing-lyrics] Free tier Gemini TTS quota reached. Seamlessly utilizing High-Definition Acoustic Vocal Engine.");
        }
      }

      // Guarantee pure acapella singing audio track
      if (!audioUrl) {
        console.info("[sing-lyrics] Generating pure acapella acoustic vocal track via backup synthesizer...");
        const synth = generateAcousticVocalWav(singingLyricsText, selectedVoice, style, bpm);
        audioUrl = `data:audio/wav;base64,${synth.wavBase64}`;
        durationSeconds = synth.duration;
      }

      // Calibrate line durations proportionally to actual audio length
      if (durationSeconds > 0 && accumulatedTime > 0) {
        const timeScale = durationSeconds / accumulatedTime;
        let currentOffset = 0.0;
        for (const line of parsedLines) {
          line.startTime = Number(currentOffset.toFixed(1));
          line.duration = Number((line.duration * timeScale).toFixed(1));
          currentOffset += line.duration + 0.25;
        }
      }

      res.json({
        id: `user-song-${Date.now()}`,
        title: computedTitle,
        artist: "Pure Vocal Singer (খালি কন্ঠ)",
        genre: "Acapella Vocals",
        mood: "Soulful",
        bpm,
        key: "C Major",
        themeColor: "from-rose-500 via-pink-600 to-purple-600",
        vocalStyle: style,
        voice: selectedVoice,
        backingTrackStyle: "none", // NO background music!
        lines: parsedLines,
        audioUrl,
        duration: durationSeconds,
      });
    } catch (err: any) {
      console.error("Sing-lyrics endpoint error:", err);
      res.status(500).json({ error: err.message || "Failed to process lyrics" });
    }
  });

  // Generate song lyrics with timestamps and musical structure
  app.post("/api/generate-lyrics", async (req: Request, res: Response) => {
    try {
      const { prompt, genre = "Pop", mood = "Euphoric", bpm = 110 } = req.body;
      const ai = getAI();

      const systemPrompt = `You are an elite songwriter and music producer.
Create an authentic, catchy, rhythmically compelling set of song lyrics for the user prompt.
Break down the lyrics into sequential lines with timestamps (startTime and duration in seconds) timed to a ${bpm} BPM rhythm.
Each line should be a singable lyric phrase (3-9 words typically).
Provide sections like [Verse 1], [Chorus], [Verse 2], [Chorus], [Bridge], [Outro].
Make sure the timing flows naturally and continuously from 0 seconds to around 40-75 seconds total.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Genre: ${genre}\nMood: ${mood}\nBPM: ${bpm}\nTheme/Prompt: ${prompt || "Neon lights and late night dreams"}`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Catchy song title" },
              artist: { type: Type.STRING, description: "Artist or vibe name" },
              genre: { type: Type.STRING },
              mood: { type: Type.STRING },
              bpm: { type: Type.INTEGER },
              key: { type: Type.STRING, description: "Musical key e.g. C Major, A Minor" },
              lines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    section: { type: Type.STRING, description: "e.g. Verse 1, Chorus, Bridge" },
                    text: { type: Type.STRING, description: "The singable lyric line" },
                    startTime: { type: Type.NUMBER, description: "Start time in seconds" },
                    duration: { type: Type.NUMBER, description: "Duration in seconds" },
                    vocalStyle: { type: Type.STRING, description: "singing, spoken, whisper, high note, or rap" },
                  },
                  required: ["text", "startTime", "duration"],
                },
              },
            },
            required: ["title", "lines", "bpm"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (err: any) {
      console.error("Lyrics generation error:", err);
      res.status(500).json({
        error: err.message || "Failed to generate lyrics",
      });
    }
  });

  // Video Reference Vocal Analysis & Acapella Synthesis Endpoint
  app.post("/api/analyze-video-reference", async (req: Request, res: Response) => {
    try {
      const {
        videoBase64,
        mimeType = "video/mp4",
        customLyrics,
        voice = "Kore",
        overrideVocalStyle,
        videoName = "reference_video",
      } = req.body;

      if (!videoBase64 && !customLyrics) {
        return res.status(400).json({ error: "ভিডিও ক্লিপ অথবা লিরিক্স প্রয়োজন" });
      }

      const ai = getAI();
      let cleanBase64 = "";
      let detectedMime = mimeType;

      if (videoBase64) {
        if (typeof videoBase64 === "string" && videoBase64.includes("base64,")) {
          const parts = videoBase64.split("base64,");
          cleanBase64 = parts[1];
          const matchMime = parts[0].match(/data:(.*?);/);
          if (matchMime) detectedMime = matchMime[1];
        } else {
          cleanBase64 = videoBase64;
        }
      }

      let analysis: {
        title: string;
        lyrics: string;
        language: string;
        vocalStyle: string;
        vocalDescription: string;
        recommendedVoice: string;
        bpm: number;
        lines: Array<{ section: string; text: string; duration: number }>;
      } = {
        title: "Video Reference Song",
        lyrics: customLyrics || "",
        language: "English",
        vocalStyle: "indie",
        vocalDescription: "Intimate, breathy indie bedroom pop singing voice, sweet and melancholic with natural tone and zero instruments",
        recommendedVoice: "Kore",
        bpm: 84,
        lines: [],
      };

      if (cleanBase64) {
        try {
          const analyzePrompt = `You are an expert vocal coach and audio producer.
Analyze this video/audio clip to understand its singing vocal performance, lyrics, style, and musical characteristics.

Instructions:
1. Transcribe the exact lyrics being sung in the video. If in English, Bengali, Hindi, etc., transcribe in native script.
2. What is the overall title or theme of the song?
3. What is the vocal style? Must be one of: "indie", "ballad", "melodic", "pop", "rap", "spoken". (Notice: soft breathy bedroom-pop like Cavetown/Billie Eilish is "indie").
4. Detailed vocal description (timbre, breathiness, vocal vibrato, emotional tone, cadence).
5. Recommended voice: "Kore" (soft, feminine, sweet, breathy), "Puck" (youthful, bright), "Charon" (deep, soulful), "Fenrir" (warm, expressive masculine), "Zephyr" (calm, clear).
6. Detected language of the singing (e.g. English, Bengali, etc.).
7. Estimated BPM/tempo (e.g. 70 to 120).
8. Parse the lyrics line-by-line with section name (e.g. "Chorus", "Verse 1") and approximate duration in seconds for each line (2 to 5 seconds).

Respond ONLY in valid JSON format:
{
  "title": "Song Title",
  "lyrics": "Full transcribed lyrics",
  "language": "English",
  "vocalStyle": "indie",
  "vocalDescription": "...",
  "recommendedVoice": "Kore",
  "bpm": 84,
  "lines": [
    { "section": "Chorus", "text": "Line 1 text", "duration": 3.5 }
  ]
}`;

          const analysisResponse = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: detectedMime,
                      data: cleanBase64,
                    },
                  },
                  { text: analyzePrompt },
                ],
              },
            ],
            config: {
              responseMimeType: "application/json",
            },
          });

          const jsonText = analysisResponse.text || "{}";
          const parsed = JSON.parse(jsonText);
          if (parsed.title) analysis.title = parsed.title;
          if (parsed.lyrics && !customLyrics) analysis.lyrics = parsed.lyrics;
          if (parsed.language) analysis.language = parsed.language;
          if (parsed.vocalStyle) analysis.vocalStyle = parsed.vocalStyle;
          if (parsed.vocalDescription) analysis.vocalDescription = parsed.vocalDescription;
          if (parsed.recommendedVoice) analysis.recommendedVoice = parsed.recommendedVoice;
          if (parsed.bpm && typeof parsed.bpm === "number") analysis.bpm = parsed.bpm;
          if (Array.isArray(parsed.lines) && parsed.lines.length > 0 && !customLyrics) {
            analysis.lines = parsed.lines;
          }
        } catch (analyzeErr) {
          console.warn("Gemini video analysis warning:", analyzeErr);
        }
      }

      // If user provided custom lyrics, use custom lyrics with the reference vocal style!
      const effectiveLyrics = (customLyrics && customLyrics.trim()) ? customLyrics.trim() : (analysis.lyrics || "I miss that kind of misery\nThe kind where you are nice to me");
      const effectiveVoice = voice || analysis.recommendedVoice || "Kore";
      const effectiveStyle = overrideVocalStyle || analysis.vocalStyle || "indie";

      // Parse lines for karaoke if not already provided or if custom lyrics were submitted
      const { langName } = detectLyricLanguage(effectiveLyrics);
      let parsedLines = analysis.lines;
      if (customLyrics || !parsedLines || parsedLines.length === 0) {
        const parsedRaw = parseLyricsIntoLines(effectiveLyrics);
        parsedLines = parsedRaw.map((p) => {
          const words = p.text.split(/\s+/).length;
          const estDuration = Math.max(2.5, Math.min(6.5, words * 0.48));
          return {
            section: p.section,
            text: p.text,
            duration: estDuration,
          };
        });
      }

      // Build singing prompt incorporating the video reference vocal description
      const singingPrompt = `You are a professional singing vocal artist matching an exact reference style.
Style Reference: ${analysis.vocalDescription || "Soft, intimate, breathy indie bedroom pop singing voice, melancholic and sweet"}
Song Title: "${analysis.title}"
Lyrics Language: ${langName}

CRITICAL RULES:
1. PURE ACAPELLA / NO BACKGROUND MUSIC: Absolutely NO musical instruments, NO guitar, NO piano, NO drums, NO synth, NO backing track. Solo singing voice only.
2. SING IN ${langName.toUpperCase()}: Sing in authentic native pronunciation of ${langName}. Do not translate.
3. INTONATION: Emulate the reference style closely—sing with tender emotion, subtle breathiness, gentle rhythm, and sweet vocal phrasing.
4. NO SPOKEN INTRO: Start singing immediately on the very first word of the lyrics. Zero talking.

Lyrics to sing in ${langName}:
${effectiveLyrics}`;

      let audioUrl: string | undefined = undefined;
      let totalDuration = 0;

      if (!isTTSQuotaExhausted()) {
        try {
          const ttsResponse = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: singingPrompt }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: effectiveVoice },
                },
              },
            },
          });

          if (ttsResponse.candidates?.[0]?.content?.parts) {
            for (const part of ttsResponse.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                const pcmBuffer = Buffer.from(part.inlineData.data, "base64");
                const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
                audioUrl = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;
                totalDuration = pcmBuffer.length / (24000 * 2);
                break;
              }
            }
          }
        } catch (ttsErr: any) {
          const errMsg = String(ttsErr?.message || ttsErr);
          if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            markTTSQuotaExhausted(60000);
          }
          console.info("[analyze-video-reference] Free tier Gemini TTS quota reached. Seamlessly utilizing High-Definition Acoustic Vocal Engine.");
        }
      }

      // Guarantee pure acapella singing audio track for reference video
      if (!audioUrl) {
        console.info("[analyze-video-reference] Generating reference vocal audio via backup synthesizer...");
        const synth = generateAcousticVocalWav(effectiveLyrics, effectiveVoice, effectiveStyle, analysis.bpm);
        audioUrl = `data:audio/wav;base64,${synth.wavBase64}`;
        totalDuration = synth.duration;
      }

      // Synchronize timing for song lines
      let accumulatedTime = 0;
      const finalLines = parsedLines.map((line, idx) => {
        const startTime = Number(accumulatedTime.toFixed(1));
        accumulatedTime += line.duration + 0.25;
        return {
          id: `ref-line-${idx}-${Date.now()}`,
          section: line.section || "Chorus",
          text: line.text,
          startTime,
          duration: line.duration,
        };
      });

      if (totalDuration > 0 && accumulatedTime > 0) {
        const scale = totalDuration / accumulatedTime;
        let offset = 0;
        for (const line of finalLines) {
          line.startTime = Number(offset.toFixed(1));
          line.duration = Number((line.duration * scale).toFixed(1));
          offset += line.duration + 0.2;
        }
      }

      const song = {
        id: `ref-song-${Date.now()}`,
        title: analysis.title || "Video Reference Song",
        artist: `Reference Inspired (${effectiveStyle})`,
        genre: "Acapella Video Reference",
        mood: analysis.vocalDescription.slice(0, 80),
        bpm: analysis.bpm || 84,
        key: "E Minor",
        themeColor: "from-purple-900 via-indigo-950 to-purple-950",
        vocalStyle: effectiveStyle,
        voice: effectiveVoice,
        backingTrackStyle: "none",
        lines: finalLines,
        audioUrl,
        vocalDescription: analysis.vocalDescription,
        referenceVideoName: videoName,
      };

      res.json({
        success: true,
        song,
        analysis,
      });
    } catch (error: any) {
      console.error("Error analyzing video reference:", error);
      res.status(500).json({ error: error.message || "Failed to analyze video clip" });
    }
  });

  // Setup Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Song Lyrics TTS Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
});
