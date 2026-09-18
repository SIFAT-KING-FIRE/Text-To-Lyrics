import { BackingTrackStyle, LyricLine, Song } from "../types";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private vocalGain: GainNode | null = null;
  private beatGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;

  // Backing beat scheduling
  private isBeatRunning = false;
  private currentBpm = 100;
  private currentStyle: BackingTrackStyle = "synthwave";
  private beatTimerId: number | null = null;
  private nextBeatTime = 0;
  private currentStep = 0;

  // Active audio element for TTS WAV playback
  private audioElement: HTMLAudioElement | null = null;
  private audioSourceNode: MediaElementAudioSourceNode | null = null;

  // SpeechSynthesis fallback
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private isUsingSpeechSynthesis = false;

  constructor() {
    // Lazy initialized on first user interaction
  }

  public initContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.9;

      this.vocalGain = this.ctx.createGain();
      this.vocalGain.gain.value = 1.0;

      // Default beat gain is 0 so pure acapella singing has no background music
      this.beatGain = this.ctx.createGain();
      this.beatGain.gain.value = 0.0;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.85;

      this.vocalGain.connect(this.masterGain);
      this.beatGain.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public setVocalVolume(vol: number) {
    if (this.vocalGain && this.ctx) {
      this.vocalGain.gain.setTargetAtTime(Math.max(0, Math.min(1.5, vol)), this.ctx.currentTime, 0.05);
    }
  }

  public setBeatVolume(vol: number) {
    if (this.beatGain && this.ctx) {
      this.beatGain.gain.setTargetAtTime(Math.max(0, Math.min(1.5, vol)), this.ctx.currentTime, 0.05);
    }
  }

  // --- Procedural Drum & Musical Synthesizers ---
  private triggerKick(time: number) {
    if (!this.ctx || !this.beatGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(this.beatGain);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  private triggerSnare(time: number, isClap = false) {
    if (!this.ctx || !this.beatGain) return;

    // Noise buffer for snare/clap body
    const bufferSize = this.ctx.sampleRate * 0.18;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = isClap ? "bandpass" : "highpass";
    filter.frequency.value = isClap ? 1200 : 800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isClap ? 0.35 : 0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (isClap ? 0.22 : 0.18));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatGain);

    noise.start(time);
    noise.stop(time + 0.25);

    // Tonal snap
    const toneOsc = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    toneOsc.frequency.setValueAtTime(180, time);
    toneOsc.frequency.exponentialRampToValueAtTime(80, time + 0.08);

    toneGain.gain.setValueAtTime(0.3, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    toneOsc.connect(toneGain);
    toneGain.connect(this.beatGain);

    toneOsc.start(time);
    toneOsc.stop(time + 0.1);
  }

  private triggerHiHat(time: number, isOpen = false) {
    if (!this.ctx || !this.beatGain) return;
    const bufferSize = this.ctx.sampleRate * (isOpen ? 0.25 : 0.04);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 6500;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isOpen ? 0.25 : 0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (isOpen ? 0.22 : 0.04));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatGain);

    noise.start(time);
    noise.stop(time + (isOpen ? 0.25 : 0.05));
  }

  private triggerChord(time: number, frequencies: number[], duration = 0.5, style: BackingTrackStyle = "synthwave") {
    if (!this.ctx || !this.beatGain) return;

    frequencies.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      if (style === "lofi") {
        osc.type = "sine";
        filter.type = "lowpass";
        filter.frequency.value = 850;
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.linearRampToValueAtTime(0.08, time + duration * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      } else if (style === "synthwave") {
        osc.type = "sawtooth";
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1400, time);
        filter.frequency.exponentialRampToValueAtTime(600, time + duration);
        gain.gain.setValueAtTime(0.09, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      } else if (style === "trap") {
        osc.type = "triangle";
        filter.type = "lowpass";
        filter.frequency.value = 1100;
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      } else {
        // pop / acoustic
        osc.type = "triangle";
        filter.type = "lowpass";
        filter.frequency.value = 2200;
        gain.gain.setValueAtTime(0.11, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      }

      osc.frequency.value = freq;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.beatGain!);

      osc.start(time);
      osc.stop(time + duration);
    });
  }

  // --- Musical Clock & Accompaniment Scheduler ---
  public startBackingTrack(style: BackingTrackStyle, bpm: number, startTime = 0) {
    this.initContext();
    if (style === "none" || !this.ctx || !this.beatGain || this.beatGain.gain.value <= 0.01) {
      this.stopBackingTrack();
      return;
    }

    this.currentStyle = style;
    this.currentBpm = bpm;
    this.isBeatRunning = true;

    // Reset step counter matching startTime offset
    const secondsPer16th = (60 / bpm) / 4;
    this.currentStep = Math.floor(startTime / secondsPer16th) % 16;
    this.nextBeatTime = this.ctx.currentTime + 0.05;

    this.scheduleBeats();
  }

  private scheduleBeats = () => {
    if (!this.isBeatRunning || !this.ctx) return;

    const secondsPer16th = (60 / this.currentBpm) / 4;
    const scheduleAheadTime = 0.2;

    while (this.nextBeatTime < this.ctx.currentTime + scheduleAheadTime) {
      this.playStep(this.currentStep, this.nextBeatTime);
      this.nextBeatTime += secondsPer16th;
      this.currentStep = (this.currentStep + 1) % 16;
    }

    this.beatTimerId = window.setTimeout(this.scheduleBeats, 50);
  };

  private playStep(step: number, time: number) {
    const s = this.currentStyle;

    // 16-step drum patterns
    if (s === "synthwave") {
      // 4-on-the-floor kick
      if (step % 4 === 0) this.triggerKick(time);
      // Snare on 4 and 12 (beats 2 and 4)
      if (step === 4 || step === 12) this.triggerSnare(time);
      // 16th note rolling hats
      this.triggerHiHat(time, step % 4 === 2);

      // Bass / chord arpeggio
      const chords = [
        [220, 261.63, 329.63], // Am
        [174.61, 220, 261.63], // F
        [261.63, 329.63, 392], // C
        [196, 246.94, 293.66], // G
      ];
      const chordIndex = Math.floor(step / 4);
      if (step % 2 === 0) {
        this.triggerChord(time, chords[chordIndex], 0.25, "synthwave");
      }
    } else if (s === "lofi") {
      // Boom bap kick
      if (step === 0 || step === 10) this.triggerKick(time);
      // Rim/snare on 4 and 12
      if (step === 4 || step === 12) this.triggerSnare(time, true);
      // Swung hats on even steps
      if (step % 2 === 0) this.triggerHiHat(time, step === 6 || step === 14);

      // Warm jazzy 7th chords
      const lofiChords = [
        [174.61, 220, 261.63, 329.63], // Fmaj7
        [220, 261.63, 329.63, 392.0],  // Am7
        [146.83, 174.61, 220, 261.63], // Dm7
        [196.0, 246.94, 293.66, 349.23], // G7
      ];
      if (step === 0 || step === 8) {
        const chord = lofiChords[Math.floor(step / 8)];
        this.triggerChord(time, chord, 1.2, "lofi");
      }
    } else if (s === "trap") {
      // 808 kick
      if (step === 0 || step === 6 || step === 10) this.triggerKick(time);
      // Snare/clap on 8
      if (step === 8) this.triggerSnare(time, true);
      // Trap hi-hat rolls
      if (step % 2 === 0 || (step >= 12 && step <= 15)) {
        this.triggerHiHat(time, false);
      }
      if (step === 0 || step === 8) {
        this.triggerChord(time, [146.83, 220, 293.66], 0.9, "trap");
      }
    } else if (s === "pop" || s === "acoustic") {
      // Pop dance kick
      if (step === 0 || step === 8 || step === 12) this.triggerKick(time);
      if (step === 4 || step === 12) this.triggerSnare(time);
      if (step % 2 === 0) this.triggerHiHat(time, step % 4 === 2);

      const popChords = [
        [261.63, 329.63, 392.0],  // C
        [196.0, 246.94, 293.66],  // G
        [220.0, 261.63, 329.63],  // Am
        [174.61, 220.0, 261.63],  // F
      ];
      if (step % 4 === 0) {
        this.triggerChord(time, popChords[Math.floor(step / 4)], 0.45, "pop");
      }
    }
  }

  public stopBackingTrack() {
    this.isBeatRunning = false;
    if (this.beatTimerId) {
      clearTimeout(this.beatTimerId);
      this.beatTimerId = null;
    }
  }

  // --- Vocal Audio Playback (Gemini TTS WAV or Web Speech) ---
  public playAudioUrl(url: string, startTime = 0, onEnded?: () => void): HTMLAudioElement {
    this.initContext();
    this.stopAudio();

    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.currentTime = startTime;

    if (this.ctx && this.vocalGain) {
      try {
        const source = this.ctx.createMediaElementSource(audio);
        source.connect(this.vocalGain);
        this.audioSourceNode = source;
      } catch (e) {
        console.warn("Could not route audio through Web Audio node, playing directly", e);
      }
    }

    if (onEnded) {
      audio.onended = onEnded;
    }

    audio.play().catch((err) => {
      console.warn("Audio play blocked or interrupted", err);
    });

    this.audioElement = audio;
    return audio;
  }

  public pauseAudio() {
    if (this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause();
    }
    if (this.isUsingSpeechSynthesis && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    this.stopBackingTrack();
  }

  public resumeAudio() {
    if (this.audioElement && this.audioElement.paused) {
      this.audioElement.play().catch(() => {});
    }
    if (this.isUsingSpeechSynthesis && window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  public seekAudio(time: number) {
    if (this.audioElement) {
      this.audioElement.currentTime = time;
    }
  }

  public stopAudio() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isUsingSpeechSynthesis = false;
    this.stopBackingTrack();
  }

  public getAudioCurrentTime(): number {
    if (this.audioElement) {
      return this.audioElement.currentTime;
    }
    return 0;
  }

  public getAudioDuration(): number {
    if (this.audioElement && !isNaN(this.audioElement.duration)) {
      return this.audioElement.duration;
    }
    return 0;
  }

  // Fallback speech synthesis for instantaneous playback without API call
  public speakFallback(
    text: string,
    voiceName = "Google US English",
    rate = 0.95,
    pitch = 1.1,
    onEnd?: () => void
  ) {
    if (!window.speechSynthesis) return;
    this.stopAudio();
    this.isUsingSpeechSynthesis = true;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;

    const isBengali = /[\u0980-\u09FF]/.test(text);
    const voices = window.speechSynthesis.getVoices();
    let match = null;

    if (isBengali) {
      match = voices.find((v) => v.lang.startsWith("bn"));
    }
    if (!match) {
      match = voices.find((v) => v.name.toLowerCase().includes(voiceName.toLowerCase()) || v.lang.startsWith("en"));
    }
    if (match) {
      utterance.voice = match;
    }

    if (onEnd) {
      utterance.onend = () => {
        this.isUsingSpeechSynthesis = false;
        onEnd();
      };
      utterance.onerror = () => {
        this.isUsingSpeechSynthesis = false;
        onEnd();
      };
    }

    window.speechSynthesis.speak(utterance);
    this.activeUtterance = utterance;
  }

  // Draw frequency bars or wave into canvas
  public drawVisualizer(canvas: HTMLCanvasElement, color = "#ec4899") {
    if (!this.analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / (bufferLength * 0.7)) * 2.2;
    let x = 0;

    for (let i = 0; i < bufferLength * 0.7; i++) {
      const barHeight = (dataArray[i] / 255) * (canvas.height * 0.85);

      const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "#f43f5e");

      ctx.fillStyle = grad;
      ctx.fillRect(x, canvas.height - barHeight, barWidth - 1.5, barHeight);

      x += barWidth;
    }
  }
}

export const audioEngine = new AudioEngine();
