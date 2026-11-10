import { SoundEffectType } from '../types/manhwa';

export interface AudioDiagnostics {
  duration: number; // raw duration in seconds
  sampleRate: number;
  channels: number;
  peakDb: number; // e.g. -0.8 dB
  peakLinear: number; // 0.0 to 1.0+
  rmsDb: number; // e.g. -16.2 dB
  clippedSamples: number;
  isClipping: boolean;
  flatTopCount: number;
  dcOffset: number;
  health: 'clean' | 'warning' | 'distorted';
  healthMessage: string;
  points: Array<{ min: number; max: number; isClipped: boolean; timeSec: number }>;
}

// Helper to inspect binary audio and ensure standard 44-byte RIFF WAV header for raw PCM
function ensureWavBuffer(bytes: Uint8Array, sampleRate = 24000): ArrayBuffer {
  // If already starts with 'RIFF', return a clean ArrayBuffer
  if (bytes.length >= 44 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    return ab;
  }

  // Prepend standard 44-byte RIFF header (24kHz, 16-bit, 1 channel mono)
  const dataLen = bytes.length;
  const ab = new ArrayBuffer(44 + dataLen);
  const wav = new Uint8Array(ab);
  const view = new DataView(ab);

  // 'RIFF'
  wav[0] = 0x52; wav[1] = 0x49; wav[2] = 0x46; wav[3] = 0x46;
  view.setUint32(4, 36 + dataLen, true);
  // 'WAVE'
  wav[8] = 0x57; wav[9] = 0x41; wav[10] = 0x56; wav[11] = 0x45;
  // 'fmt '
  wav[12] = 0x66; wav[13] = 0x6d; wav[14] = 0x74; wav[15] = 0x20;
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // 'data'
  wav[36] = 0x64; wav[37] = 0x61; wav[38] = 0x74; wav[39] = 0x61;
  view.setUint32(40, dataLen, true);

  wav.set(bytes, 44);
  return ab;
}

// Synthesizer and Web Audio Player for Background Music, Sound Effects, and Voice Mixing
class AudioEngine {
  private ctx: AudioContext | null = null;
  private bgmGainNode: GainNode | null = null;
  private voiceGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  private isBgmPlaying = false;
  private activeBgmInterval: number | null = null;
  private currentBgmTrack: string = 'funny-lofi';
  private bgmBaseVolume = 0.35;
  private voiceBaseVolume = 1.0;

  // Sound effects buffer cache
  private sfxCache: Map<string, AudioBuffer> = new Map();
  // Voice cache
  private voiceBufferCache: Map<string, AudioBuffer> = new Map();
  private currentVoiceSource: AudioBufferSourceNode | null = null;

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGainNode = this.ctx.createGain();
      this.masterGainNode.gain.value = 1.0;

      this.bgmGainNode = this.ctx.createGain();
      this.bgmGainNode.gain.value = this.bgmBaseVolume;

      this.voiceGainNode = this.ctx.createGain();
      this.voiceGainNode.gain.value = this.voiceBaseVolume;

      this.sfxGainNode = this.ctx.createGain();
      this.sfxGainNode.gain.value = 0.7;

      // Create stream destination for high-quality export
      this.destinationNode = this.ctx.createMediaStreamDestination();

      // Connect nodes
      this.bgmGainNode.connect(this.masterGainNode);
      this.voiceGainNode.connect(this.masterGainNode);
      this.sfxGainNode.connect(this.masterGainNode);

      // Connect to speakers
      this.masterGainNode.connect(this.ctx.destination);
      // And connect to recording stream
      this.masterGainNode.connect(this.destinationNode);

      this.preloadProceduralSFX();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  getAudioContext(): AudioContext | null {
    this.init();
    return this.ctx;
  }

  getMediaStreamDestination(): MediaStreamAudioDestinationNode | null {
    this.init();
    return this.destinationNode;
  }

  setVolumes(bgmVol: number, voiceVol: number) {
    this.bgmBaseVolume = Math.max(0, Math.min(1, bgmVol));
    this.voiceBaseVolume = Math.max(0, Math.min(1, voiceVol));

    if (this.bgmGainNode && this.ctx) {
      this.bgmGainNode.gain.setValueAtTime(this.bgmBaseVolume, this.ctx.currentTime);
    }
    if (this.voiceGainNode && this.ctx) {
      this.voiceGainNode.gain.setValueAtTime(this.voiceBaseVolume, this.ctx.currentTime);
    }
  }

  // Audio ducking when voiceover speaks
  duckBgm(isDucking: boolean) {
    if (!this.bgmGainNode || !this.ctx) return;
    const now = this.ctx.currentTime;
    const target = isDucking ? this.bgmBaseVolume * 0.25 : this.bgmBaseVolume;
    this.bgmGainNode.gain.cancelScheduledValues(now);
    this.bgmGainNode.gain.linearRampToValueAtTime(target, now + 0.15);
  }

  // Generate procedural high quality sound effects
  private preloadProceduralSFX() {
    if (!this.ctx) return;

    // 1. Vine Boom (Sub-bass thunder drop)
    const vineBoomBuf = this.createToneBuffer(1.4, (t) => {
      const freq = Math.max(25, 110 * Math.exp(-t * 3.8));
      const osc = Math.sin(2 * Math.PI * freq * t);
      const sub = Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.7;
      const distortion = Math.tanh((osc + sub) * 2.2);
      const env = Math.exp(-t * 2.5);
      return distortion * env;
    });
    this.sfxCache.set('vine-boom', vineBoomBuf);

    // 2. Record Scratch (Filtered chirp noise)
    const scratchBuf = this.createToneBuffer(0.35, (t) => {
      const pitch = 300 + Math.sin(t * 35) * 220;
      const noise = (Math.random() * 2 - 1) * 0.4;
      const tone = Math.sin(2 * Math.PI * pitch * t);
      const env = (1 - t / 0.35);
      return (tone * 0.6 + noise) * env;
    });
    this.sfxCache.set('record-scratch', scratchBuf);

    // 3. Anime Punch (Explosive action impact with transient pop)
    const punchBuf = this.createToneBuffer(0.6, (t) => {
      const popFreq = 160 * Math.exp(-t * 18);
      const pop = Math.sin(2 * Math.PI * popFreq * t);
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 12);
      const sub = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 4);
      return (pop * 0.8 + noise * 0.9 + sub * 0.7);
    });
    this.sfxCache.set('anime-punch', punchBuf);

    // 4. Discord / Meme Ping (Two chime bells 880Hz -> 1760Hz)
    const pingBuf = this.createToneBuffer(0.8, (t) => {
      const bell1 = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 5);
      const bell2 = t > 0.08 ? Math.sin(2 * Math.PI * 1320 * (t - 0.08)) * Math.exp(-(t - 0.08) * 6) : 0;
      return (bell1 * 0.6 + bell2 * 0.8);
    });
    this.sfxCache.set('discord-ping', pingBuf);

    // 5. Epic Choir / Awakening Chord
    const choirBuf = this.createToneBuffer(1.8, (t) => {
      const f1 = Math.sin(2 * Math.PI * 220 * t);
      const f2 = Math.sin(2 * Math.PI * 277.18 * t);
      const f3 = Math.sin(2 * Math.PI * 329.63 * t);
      const f4 = Math.sin(2 * Math.PI * 440 * t);
      const env = Math.min(t * 3, 1) * Math.exp(-t * 0.9);
      return (f1 + f2 + f3 + f4) * 0.25 * env;
    });
    this.sfxCache.set('choir-epic', choirBuf);

    // 6. Level Up Fanfare
    const levelUpBuf = this.createToneBuffer(1.2, (t) => {
      let freq = 440;
      if (t > 0.1) freq = 554.37;
      if (t > 0.2) freq = 659.25;
      if (t > 0.35) freq = 880;
      const env = Math.exp(-((t % 0.15) * 4));
      return Math.sin(2 * Math.PI * freq * t) * 0.5 * (t > 0.35 ? Math.exp(-(t - 0.35) * 1.5) : env);
    });
    this.sfxCache.set('level-up', levelUpBuf);

    // 7. Crickets Awkward Silence
    const cricketsBuf = this.createToneBuffer(1.5, (t) => {
      const burst = Math.sin(t * 80) > 0.6 ? 1 : 0;
      const tone = Math.sin(2 * Math.PI * 4600 * t);
      return burst * tone * 0.2;
    });
    this.sfxCache.set('crickets', cricketsBuf);
  }

  private createToneBuffer(duration: number, generator: (t: number) => number): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext not ready');
    const sampleRate = this.ctx.sampleRate;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, numSamples, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      channelData[i] = Math.max(-1, Math.min(1, generator(t)));
    }
    return buffer;
  }

  // Play a specific sound effect
  playSoundEffect(type: SoundEffectType) {
    if (type === 'none') return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    const buffer = this.sfxCache.get(type);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxGainNode);
    source.start();
  }

  // Play Base64 Audio with real video editor clip settings (speed, pitch, volume, EQ, fade)
  async playVoiceBase64(
    base64Wav: string, 
    settings?: {
      volume?: number;
      speed?: number;
      pitch?: number;
      fadeIn?: number;
      fadeOut?: number;
      isMuted?: boolean;
      startOffset?: number;
      eqFilter?: string;
    }
  ): Promise<number> {
    if (settings?.isMuted) return 0;
    this.init();
    if (!this.ctx || !this.voiceGainNode) return 0;

    // Stop current voice if playing
    this.stopVoice();

    let buffer = this.voiceBufferCache.get(base64Wav);
    if (!buffer) {
      const cleanBase64 = base64Wav.includes(',') ? base64Wav.split(',')[1] : base64Wav;
      const binaryStr = atob(cleanBase64.trim());
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const arrayBuffer = ensureWavBuffer(bytes);
      buffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.voiceBufferCache.set(base64Wav, buffer);
    }

    this.duckBgm(true);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Playback Speed & Pitch Detune
    const speed = Math.max(0.5, Math.min(2.0, settings?.speed ?? 1.0));
    source.playbackRate.value = speed;

    const pitchSemitones = Math.max(-12, Math.min(12, settings?.pitch ?? 0));
    source.detune.value = pitchSemitones * 100; // 100 cents per semitone

    // Per-clip Gain Node for Volume & Fades
    const clipGain = this.ctx.createGain();
    const clipVol = Math.max(0, Math.min(2.5, settings?.volume ?? 1.0));
    const now = this.ctx.currentTime;
    const dur = buffer.duration / speed;

    const fadeIn = Math.max(0, settings?.fadeIn ?? 0.05);
    const fadeOut = Math.max(0, settings?.fadeOut ?? 0.05);

    clipGain.gain.setValueAtTime(fadeIn > 0 ? 0.001 : clipVol, now);
    if (fadeIn > 0) {
      clipGain.gain.linearRampToValueAtTime(clipVol, now + fadeIn);
    }

    if (fadeOut > 0 && dur > fadeOut) {
      clipGain.gain.setValueAtTime(clipVol, now + dur - fadeOut);
      clipGain.gain.linearRampToValueAtTime(0.001, now + dur);
    }

    // EQ Filter insertion if selected
    let lastNode: AudioNode = source;
    if (settings?.eqFilter && settings.eqFilter !== 'clean' && settings.eqFilter !== 'none') {
      const filter = this.ctx.createBiquadFilter();
      if (settings.eqFilter === 'bass-boost') {
        filter.type = 'lowshelf';
        filter.frequency.value = 160;
        filter.gain.value = 8.5; // punchy meme bass
      } else if (settings.eqFilter === 'phone-radio') {
        filter.type = 'bandpass';
        filter.frequency.value = 1500;
        filter.Q.value = 2.0;
      } else if (settings.eqFilter === 'warm-broadcast') {
        filter.type = 'peaking';
        filter.frequency.value = 240;
        filter.gain.value = 4.0;
      }
      source.connect(filter);
      lastNode = filter;
    }

    lastNode.connect(clipGain);
    clipGain.connect(this.voiceGainNode);
    
    source.onended = () => {
      this.duckBgm(false);
      if (this.currentVoiceSource === source) {
        this.currentVoiceSource = null;
      }
    };

    this.currentVoiceSource = source;
    
    const delay = Math.max(0, settings?.startOffset ?? 0);
    source.start(now + delay);

    return buffer.duration / speed + delay;
  }

  // Extract normalized peaks waveform for visual audio track
  async getAudioBufferWaveform(base64Wav: string, numBars = 48): Promise<number[]> {
    this.init();
    if (!this.ctx) return new Array(numBars).fill(0.3);

    try {
      const buffer = await this.decodeAudioBuffer(base64Wav);
      const channel = buffer.getChannelData(0);
      const blockSize = Math.max(1, Math.floor(channel.length / numBars));
      const peaks: number[] = [];

      for (let i = 0; i < numBars; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          const idx = i * blockSize + j;
          if (idx < channel.length) {
            sum += Math.abs(channel[idx]);
          }
        }
        peaks.push(Math.min(1.0, (sum / blockSize) * 2.8));
      }
      return peaks;
    } catch {
      return new Array(numBars).fill(0.4);
    }
  }

  // Comprehensive Audio Diagnostics for inspecting waveform, distortion, clipping, dynamic range, and exact duration
  async getAudioDiagnostics(base64Wav: string, numPoints = 140): Promise<AudioDiagnostics> {
    const buffer = await this.decodeAudioBuffer(base64Wav);
    const channel = buffer.getChannelData(0);
    const totalSamples = channel.length;
    const duration = buffer.duration;
    const sampleRate = buffer.sampleRate;
    const channels = buffer.numberOfChannels;

    let peakLinear = 0;
    let sumSquares = 0;
    let sumSamples = 0;
    let clippedSamples = 0;
    let flatTopCount = 0;
    let consecutiveMax = 0;

    for (let i = 0; i < totalSamples; i++) {
      const s = channel[i];
      const abs = Math.abs(s);
      if (abs > peakLinear) peakLinear = abs;
      sumSquares += s * s;
      sumSamples += s;

      // Digital clipping occurs at or very near 0 dBFS (>= 0.985)
      if (abs >= 0.985) {
        clippedSamples++;
        consecutiveMax++;
        if (consecutiveMax >= 4) {
          flatTopCount++;
        }
      } else {
        consecutiveMax = 0;
      }
    }

    const dcOffset = sumSamples / Math.max(1, totalSamples);
    const rms = Math.sqrt(sumSquares / Math.max(1, totalSamples));
    const peakDb = peakLinear > 0.00001 ? Math.max(-60, 20 * Math.log10(peakLinear)) : -60;
    const rmsDb = rms > 0.00001 ? Math.max(-60, 20 * Math.log10(rms)) : -60;

    // Detailed bipolar points (min & max for dual-rail envelope)
    const points: Array<{ min: number; max: number; isClipped: boolean; timeSec: number }> = [];
    const blockSize = Math.max(1, Math.floor(totalSamples / numPoints));

    for (let i = 0; i < numPoints; i++) {
      const start = i * blockSize;
      const end = Math.min(totalSamples, start + blockSize);
      let min = 0;
      let max = 0;
      let pointClipped = false;

      for (let j = start; j < end; j++) {
        const val = channel[j];
        if (val < min) min = val;
        if (val > max) max = val;
        if (Math.abs(val) >= 0.985) pointClipped = true;
      }
      const timeSec = (start / Math.max(1, totalSamples)) * duration;
      points.push({ min, max, isClipped: pointClipped, timeSec });
    }

    const isClipping = clippedSamples > 0;
    const isSevereDistortion = clippedSamples > 50 || flatTopCount > 8;

    let health: 'clean' | 'warning' | 'distorted' = 'clean';
    let healthMessage = 'Crisp & natural waveform. No digital clipping or flat-topping detected.';

    if (isSevereDistortion) {
      health = 'distorted';
      healthMessage = `Distortion warning: ${clippedSamples} samples clipped at 0 dBFS ceiling with flat-topping.`;
    } else if (isClipping || peakDb > -0.2) {
      health = 'warning';
      healthMessage = `Minor peak saturation: Peak at ${peakDb.toFixed(1)} dBFS (${clippedSamples} hot samples).`;
    } else if (Math.abs(dcOffset) > 0.08) {
      health = 'warning';
      healthMessage = `DC offset asymmetry detected (${(dcOffset * 100).toFixed(1)}%).`;
    }

    return {
      duration,
      sampleRate,
      channels,
      peakDb,
      peakLinear,
      rmsDb,
      clippedSamples,
      isClipping,
      flatTopCount,
      dcOffset,
      health,
      healthMessage,
      points,
    };
  }

  // Decode Base64 audio to AudioBuffer for exports or offline processing
  async decodeAudioBuffer(base64Wav: string): Promise<AudioBuffer> {
    this.init();
    if (!this.ctx) throw new Error('AudioContext missing');
    const cached = this.voiceBufferCache.get(base64Wav);
    if (cached) return cached;

    const cleanBase64 = base64Wav.includes(',') ? base64Wav.split(',')[1] : base64Wav;
    const binaryStr = atob(cleanBase64.trim());
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const arrayBuffer = ensureWavBuffer(bytes);
    const buffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.voiceBufferCache.set(base64Wav, buffer);
    return buffer;
  }

  stopVoice() {
    if (this.currentVoiceSource) {
      try {
        this.currentVoiceSource.stop();
      } catch {
        // already stopped
      }
      this.currentVoiceSource = null;
    }
    this.duckBgm(false);
  }

  // Background Music procedural loop generator
  startBgm(trackName: string) {
    if (trackName === 'none') {
      this.stopBgm();
      return;
    }

    this.init();
    if (this.isBgmPlaying && this.currentBgmTrack === trackName) return;

    this.stopBgm();
    this.isBgmPlaying = true;
    this.currentBgmTrack = trackName;

    let step = 0;
    const intervalMs = trackName === 'phonk-combat' ? 140 : trackName === 'funny-lofi' ? 240 : 200;

    this.activeBgmInterval = window.setInterval(() => {
      if (!this.isBgmPlaying || !this.ctx || !this.bgmGainNode) return;
      this.triggerBgmStep(trackName, step);
      step = (step + 1) % 16;
    }, intervalMs);
  }

  private triggerBgmStep(track: string, step: number) {
    if (!this.ctx || !this.bgmGainNode) return;
    const now = this.ctx.currentTime;

    if (track === 'phonk-combat') {
      // Hard phonk cowbell & heavy 808 kick
      if (step === 0 || step === 8 || step === 14) {
        // Kick
        this.playOscTone(58, 0.22, 'sine', 0.6, now, 28);
      }
      if (step === 4 || step === 12) {
        // Snare / clap
        this.playNoiseHit(0.12, 0.4, now);
      }
      // Memetic cowbell melody
      const cowbellNotes = [587, 587, 784, 659, 587, 523, 587, 880];
      const note = cowbellNotes[step % cowbellNotes.length];
      if (step % 2 === 0) {
        this.playOscTone(note, 0.16, 'sawtooth', 0.25, now);
      }
    } else if (track === 'funny-lofi') {
      // Playful bouncy comedy lofi groove
      if (step === 0 || step === 6 || step === 10) {
        this.playOscTone(75, 0.2, 'triangle', 0.45, now, 45);
      }
      if (step === 4 || step === 12) {
        this.playNoiseHit(0.08, 0.25, now);
      }
      // Warm jazz piano / rhodes arpeggio (Cmaj7 / Am9)
      const lofiChords = [
        [261.63, 329.63, 392.00, 493.88], // Cmaj7
        [220.00, 261.63, 329.63, 392.00], // Am7
        [174.61, 220.00, 261.63, 329.63], // Fmaj7
        [196.00, 246.94, 293.66, 349.23], // G7
      ];
      const chord = lofiChords[Math.floor(step / 4)];
      const chordNote = chord[step % 4];
      this.playOscTone(chordNote, 0.35, 'sine', 0.2, now);
    } else if (track === 'epic-orchestral') {
      // Dramatic dungeon boss orchestral hits
      if (step === 0 || step === 8) {
        this.playOscTone(45, 0.6, 'sawtooth', 0.5, now, 30);
        this.playOscTone(130.81, 0.8, 'sawtooth', 0.3, now); // C3
        this.playOscTone(196.00, 0.8, 'sawtooth', 0.3, now); // G3
        this.playOscTone(246.94, 0.8, 'sawtooth', 0.3, now); // B3
      }
      if (step % 2 === 0) {
        this.playOscTone(392, 0.1, 'sawtooth', 0.15, now); // string staccato
      }
    } else if (track === 'synthwave-hype') {
      // Neon 80s hype bassline
      const bassNotes = [110, 110, 130.81, 146.83, 164.81, 146.83, 130.81, 110];
      const bNote = bassNotes[step % bassNotes.length];
      this.playOscTone(bNote, 0.12, 'sawtooth', 0.35, now);
      if (step % 4 === 0) {
        this.playOscTone(60, 0.18, 'sine', 0.5, now, 35);
      }
    } else if (track === 'chill-reading') {
      // Relaxed acoustic-like chime
      const pentatonic = [329.63, 392.00, 440.00, 523.25, 659.25];
      if (step % 3 === 0) {
        const pNote = pentatonic[step % pentatonic.length];
        this.playOscTone(pNote, 0.5, 'sine', 0.15, now);
      }
    }
  }

  private playOscTone(freq: number, duration: number, type: OscillatorType, gainVal: number, startTime: number, endFreq?: number) {
    if (!this.ctx || !this.bgmGainNode) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), startTime + duration);
    }

    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(g);
    g.connect(this.bgmGainNode);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  private playNoiseHit(duration: number, gainVal: number, startTime: number) {
    if (!this.ctx || !this.bgmGainNode) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.bgmGainNode);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  stopBgm() {
    this.isBgmPlaying = false;
    if (this.activeBgmInterval !== null) {
      clearInterval(this.activeBgmInterval);
      this.activeBgmInterval = null;
    }
  }

  // Merge all panel voiceover audio clips into one single continuous WAV file
  async exportMergedVoiceoverWav(panels: Array<{ audioBase64?: string; duration: number }>): Promise<Blob | null> {
    this.init();
    if (!this.ctx) return null;

    const clipsToMerge: Array<{ buffer: AudioBuffer; startTime: number }> = [];
    let accumulatedTime = 0;

    for (const panel of panels) {
      if (panel.audioBase64) {
        try {
          const rawBuf = await this.decodeAudioBuffer(panel.audioBase64);
          clipsToMerge.push({ buffer: rawBuf, startTime: accumulatedTime });
        } catch (e) {
          console.warn('Could not decode audio for panel:', e);
        }
      }
      accumulatedTime += panel.duration;
    }

    if (clipsToMerge.length === 0) return null;

    const totalDuration = Math.max(1, accumulatedTime);
    const sampleRate = 24000;
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(totalDuration * sampleRate), sampleRate);

    clipsToMerge.forEach(({ buffer, startTime }) => {
      const src = offlineCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(offlineCtx.destination);
      src.start(startTime);
    });

    const rendered = await offlineCtx.startRendering();
    return audioBufferToWavBlob(rendered);
  }

  destroy() {
    this.stopBgm();
    this.stopVoice();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const samples = buffer.getChannelData(0);
  const dataLength = samples.length * 2;
  const bufferArray = new ArrayBuffer(44 + dataLength);
  const view = new DataView(bufferArray);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

export const audioEngine = new AudioEngine();
