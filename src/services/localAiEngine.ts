import { pipeline, env } from '@huggingface/transformers';
import { GeneratedPanelScript } from './geminiClient';

// Configure transformers.js to cache locally in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

export type AiEngineType = 'cloud-gemini' | 'in-browser-model' | 'local-ollama';

export interface HardwarePreset {
  id: string;
  name: string;
  gpuTarget: string;
  ramTarget: string;
  description: string;
  recommendedScriptModel: string;
  recommendedTtsModel: string;
  defaultFps: number;
  defaultBitrate: number;
  vramUsageEstimate: string;
}

export const HARDWARE_PRESETS: HardwarePreset[] = [
  {
    id: 'rtx-5070ti-beast',
    name: 'RTX 5070 Ti Beast Preset',
    gpuTarget: 'RTX 5070 Ti (12-16GB VRAM)',
    ramTarget: '32 GB RAM',
    description: 'Tuned for your RTX 5070 Ti & 32GB RAM: Fast WebGPU local scripting, SpeechT5 local neural voiceover, and 1080p 60FPS high-bitrate export. (For 7B/8B models, use Ollama native mode).',
    recommendedScriptModel: 'onnx-community/Qwen2.5-0.5B-Instruct',
    recommendedTtsModel: 'Xenova/speecht5_tts',
    defaultFps: 60,
    defaultBitrate: 20_000_000, // 20 Mbps
    vramUsageEstimate: '~1.8 GB VRAM (Leaves 12+ GB free)',
  },
  {
    id: 'standard-laptop',
    name: 'Balanced Laptop Preset',
    gpuTarget: 'Mid-range GPU / Integrated',
    ramTarget: '16 GB RAM',
    description: 'Fast lightweight model for standard laptops. Instant download, smooth 30 FPS rendering.',
    recommendedScriptModel: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    recommendedTtsModel: 'native-browser-speech',
    defaultFps: 30,
    defaultBitrate: 14_000_000,
    vramUsageEstimate: '~800 MB VRAM',
  },
  {
    id: 'ollama-powerhouse',
    name: 'Ollama Native Localhost',
    gpuTarget: 'RTX 5070 Ti / Desktop GPU',
    ramTarget: '32 GB RAM',
    description: 'Connects to your local Ollama running Llama-3.2-Vision or Qwen2.5-VL natively on your machine.',
    recommendedScriptModel: 'ollama:llama3.2-vision',
    recommendedTtsModel: 'native-browser-speech',
    defaultFps: 60,
    defaultBitrate: 20_000_000,
    vramUsageEstimate: '~6.0 GB VRAM',
  },
];

export interface LocalModelInfo {
  id: string;
  name: string;
  sizeMb: number;
  description: string;
  category: 'script' | 'tts' | 'vision';
  recommendedFor5070Ti: boolean;
}

export const AVAILABLE_LOCAL_MODELS: LocalModelInfo[] = [
  {
    id: 'onnx-community/Qwen2.5-1.5B-Instruct',
    name: 'Qwen 2.5 1.5B Instruct (Top Script & Humor)',
    sizeMb: 1100,
    description: 'BEST FOR RTX 5070 Ti: Outstanding 4th-wall roasts, comic timing, and manhwa meme awareness.',
    category: 'script',
    recommendedFor5070Ti: true,
  },
  {
    id: 'Xenova/speecht5_tts',
    name: 'SpeechT5 Neural Voiceover (Local TTS)',
    sizeMb: 280,
    description: 'BEST LOCAL VOICE: Neural text-to-speech running locally on WebGPU. Generates clear, energetic narrator audio.',
    category: 'tts',
    recommendedFor5070Ti: true,
  },
  {
    id: 'Qwen/Qwen2.5-0.5B-Instruct',
    name: 'Qwen 2.5 0.5B Instruct (Fast Comedy)',
    sizeMb: 480,
    description: 'Blazing fast, ~80 tokens/sec on 5070 Ti. Snappy Mamoru roasts with minimal footprint.',
    category: 'script',
    recommendedFor5070Ti: false,
  },
  {
    id: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    name: 'SmolLM2 360M (Instant Test)',
    sizeMb: 240,
    description: 'Ultra-compact model. Downloads in seconds, runs anywhere.',
    category: 'script',
    recommendedFor5070Ti: false,
  },
];

export interface DownloadProgress {
  status: 'idle' | 'downloading' | 'ready' | 'error';
  progress: number; // 0 - 100
  currentModelName?: string;
  file?: string;
  loadedMb?: number;
  totalMb?: number;
  stage?: string;
  error?: string;
}

// Convert Float32Array PCM to Base64 WAV
function float32ToWavBase64(samples: Float32Array, sampleRate = 16000): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples (Float32 -> Int16)
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  // Convert binary array to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

class LocalAiEngine {
  private activeEngine: AiEngineType = 'cloud-gemini';
  private selectedPresetId: string = 'rtx-5070ti-beast';
  private selectedLocalModelId: string = 'onnx-community/Qwen2.5-0.5B-Instruct';
  private selectedTtsModelId: string = 'Xenova/speecht5_tts';
  private ollamaHost: string = 'http://127.0.0.1:11434';
  private ollamaModel: string = 'llama3.2';

  // Cached pipelines
  private scriptPipeline: any = null;
  private ttsPipeline: any = null;
  private isAutoDownloadingSuite: boolean = false;
  private downloadProgressListeners: ((p: DownloadProgress) => void)[] = [];

  constructor() {
    const savedEngine = localStorage.getItem('manhwa_ai_engine');
    // Default to 'cloud-gemini' for guaranteed zero-OOM reliability out of the box
    if (savedEngine && ['cloud-gemini', 'in-browser-model', 'local-ollama'].includes(savedEngine)) {
      this.activeEngine = savedEngine as AiEngineType;
    } else {
      this.activeEngine = 'cloud-gemini';
    }

    const savedPreset = localStorage.getItem('manhwa_hardware_preset');
    if (savedPreset) this.selectedPresetId = savedPreset;

    const savedModel = localStorage.getItem('manhwa_local_model_id');
    if (savedModel && savedModel !== 'onnx-community/Qwen2.5-1.5B-Instruct') {
      this.selectedLocalModelId = savedModel;
    } else {
      // 0.5B fits cleanly inside 32-bit WASM heap without std::bad_alloc
      this.selectedLocalModelId = 'onnx-community/Qwen2.5-0.5B-Instruct';
    }

    const savedOllamaHost = localStorage.getItem('manhwa_ollama_host');
    if (savedOllamaHost) this.ollamaHost = savedOllamaHost;

    const savedOllamaModel = localStorage.getItem('manhwa_ollama_model');
    if (savedOllamaModel) this.ollamaModel = savedOllamaModel;
  }

  getActiveEngine(): AiEngineType {
    return this.activeEngine;
  }

  setActiveEngine(engine: AiEngineType) {
    this.activeEngine = engine;
    localStorage.setItem('manhwa_ai_engine', engine);
  }

  getSelectedPresetId(): string {
    return this.selectedPresetId;
  }

  applyHardwarePreset(presetId: string) {
    this.selectedPresetId = presetId;
    localStorage.setItem('manhwa_hardware_preset', presetId);

    const preset = HARDWARE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    if (preset.id === 'ollama-powerhouse') {
      this.setActiveEngine('local-ollama');
      this.ollamaModel = 'llama3.2-vision';
    } else {
      this.setActiveEngine('in-browser-model');
      this.selectedLocalModelId = preset.recommendedScriptModel;
      this.selectedTtsModelId = preset.recommendedTtsModel;
      localStorage.setItem('manhwa_local_model_id', this.selectedLocalModelId);
    }
  }

  getSelectedLocalModelId(): string {
    return this.selectedLocalModelId;
  }

  setSelectedLocalModelId(id: string) {
    this.selectedLocalModelId = id;
    localStorage.setItem('manhwa_local_model_id', id);
    this.scriptPipeline = null;
  }

  getOllamaConfig() {
    return {
      host: this.ollamaHost,
      model: this.ollamaModel,
    };
  }

  setOllamaConfig(host: string, model: string) {
    this.ollamaHost = host;
    this.ollamaModel = model;
    localStorage.setItem('manhwa_ollama_host', host);
    localStorage.setItem('manhwa_ollama_model', model);
  }

  subscribeDownloadProgress(cb: (p: DownloadProgress) => void) {
    this.downloadProgressListeners.push(cb);
    return () => {
      this.downloadProgressListeners = this.downloadProgressListeners.filter(l => l !== cb);
    };
  }

  private emitProgress(p: DownloadProgress) {
    this.downloadProgressListeners.forEach(cb => cb(p));
  }

  isModelDownloaded(modelId: string): boolean {
    return localStorage.getItem(`model_downloaded_${modelId}`) === 'true';
  }

  // 1-Click Auto Download All Local Models for RTX 5070 Ti Suite
  async autoDownloadRtx5070TiSuite(onStageUpdate?: (stage: string) => void): Promise<void> {
    if (this.isAutoDownloadingSuite) return;
    this.isAutoDownloadingSuite = true;

    try {
      // Stage 1: Download Qwen 2.5 0.5B (Fast, reliable, fits in browser WebGPU memory without WASM bad_alloc)
      const scriptModelId = 'onnx-community/Qwen2.5-0.5B-Instruct';
      if (onStageUpdate) onStageUpdate('1/2: Downloading Qwen 2.5 0.5B (WASM-Optimized Script Model)...');
      
      this.emitProgress({
        status: 'downloading',
        progress: 10,
        currentModelName: 'Qwen 2.5 0.5B Instruct',
        stage: 'Downloading Script & 4th-Wall Comedy Model from Hugging Face...',
      });

      this.scriptPipeline = await pipeline('text-generation', scriptModelId, {
        dtype: 'q4',
        device: 'webgpu',
        progress_callback: (info: any) => {
          if (info.status === 'progress' && info.total) {
            const pct = Math.min(100, Math.round((info.loaded / info.total) * 100));
            this.emitProgress({
              status: 'downloading',
              progress: Math.round(pct * 0.65), // 0 to 65%
              currentModelName: 'Qwen 2.5 0.5B',
              file: info.file,
              loadedMb: Math.round(info.loaded / (1024 * 1024)),
              totalMb: Math.round(info.total / (1024 * 1024)),
              stage: 'Downloading Qwen 2.5 model weights to browser cache...',
            });
          }
        },
      });
      localStorage.setItem(`model_downloaded_${scriptModelId}`, 'true');
      this.selectedLocalModelId = scriptModelId;

      // Stage 2: Download SpeechT5 Neural Voiceover (TTS Model)
      const ttsModelId = 'Xenova/speecht5_tts';
      if (onStageUpdate) onStageUpdate('2/2: Downloading SpeechT5 Neural Voiceover Model from Hugging Face...');

      this.emitProgress({
        status: 'downloading',
        progress: 70,
        currentModelName: 'SpeechT5 TTS',
        stage: 'Downloading SpeechT5 Neural TTS Voiceover Model...',
      });

      this.ttsPipeline = await pipeline('text-to-speech', ttsModelId, {
        dtype: 'fp32',
        progress_callback: (info: any) => {
          if (info.status === 'progress' && info.total) {
            const pct = Math.min(100, Math.round((info.loaded / info.total) * 100));
            this.emitProgress({
              status: 'downloading',
              progress: 65 + Math.round(pct * 0.35), // 65% to 100%
              currentModelName: 'SpeechT5 TTS',
              file: info.file,
              loadedMb: Math.round(info.loaded / (1024 * 1024)),
              totalMb: Math.round(info.total / (1024 * 1024)),
              stage: 'Caching local neural TTS model weights...',
            });
          }
        },
      });
      localStorage.setItem(`model_downloaded_${ttsModelId}`, 'true');

      this.isAutoDownloadingSuite = false;
      this.setActiveEngine('in-browser-model');
      this.emitProgress({
        status: 'ready',
        progress: 100,
        currentModelName: 'RTX 5070 Ti Suite',
        stage: 'All local models downloaded and ready on WebGPU!',
      });
    } catch (err: any) {
      console.error('Auto download suite error:', err);
      this.isAutoDownloadingSuite = false;
      this.emitProgress({
        status: 'error',
        progress: 0,
        error: err.message || 'Failed to download local models from Hugging Face',
      });
      throw err;
    }
  }

  // Synthesize voice locally using downloaded SpeechT5 model
  async synthesizeLocalVoice(text: string): Promise<string> {
    try {
      if (!this.ttsPipeline) {
        this.ttsPipeline = await pipeline('text-to-speech', 'Xenova/speecht5_tts', { dtype: 'fp32' });
        localStorage.setItem('model_downloaded_Xenova/speecht5_tts', 'true');
      }

      // Default energetic narrator speaker embedding
      const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
      const cleanText = text.slice(0, 250);

      const out = await this.ttsPipeline(cleanText, { speaker_embeddings });
      if (out && out.audio) {
        const base64Wav = float32ToWavBase64(out.audio, out.sampling_rate || 16000);
        return base64Wav;
      }
      throw new Error('Local TTS synthesis returned empty audio');
    } catch (err) {
      console.warn('Local TTS failed, resetting pipeline cache:', err);
      this.ttsPipeline = null;
      throw err;
    }
  }

  // Generate script locally using downloaded Qwen / Llama model with memory safety
  async generateWithBrowserModel(prompt: string, maxNewTokens = 350): Promise<string> {
    try {
      if (!this.scriptPipeline) {
        // Fall back to 0.5B if 1.5B caused issues
        const modelId = this.selectedLocalModelId.includes('1.5B') 
          ? 'onnx-community/Qwen2.5-0.5B-Instruct' 
          : this.selectedLocalModelId;

        this.scriptPipeline = await pipeline('text-generation', modelId, {
          dtype: 'q4',
          device: 'webgpu',
        });
        localStorage.setItem(`model_downloaded_${modelId}`, 'true');
      }

      const messages = [
        {
          role: 'system',
          content: `You are @MamoruManhwa, the viral YouTube manhwa recap narrator.
Personality: You break the 4th wall, roast tropes, and talk directly to chat ("Chat look at bro", "Bro really thought he had plot armor").
Output MUST be a valid JSON array of panel objects with keys: "commentary", "suggestedCamera", "soundEffect", "durationSeconds".`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      const output = await this.scriptPipeline(messages, {
        max_new_tokens: maxNewTokens,
        temperature: 0.72,
        do_sample: true,
      });

      const generatedText = output?.[0]?.generated_text;
      if (Array.isArray(generatedText)) {
        return generatedText[generatedText.length - 1]?.content || '';
      }
      return String(generatedText || '');
    } catch (err: any) {
      console.warn('Local browser model error (WASM heap or WebGPU):', err);
      this.scriptPipeline = null;
      throw err;
    }
  }

  // Check local Ollama connection
  async testOllamaConnection(host = this.ollamaHost): Promise<{ success: boolean; models: any[]; error?: string }> {
    try {
      const res = await fetch('/api/local/ollama/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        models: [],
        error: err.message || 'Failed to connect to local Ollama',
      };
    }
  }

  // Generate with local Ollama
  async generateWithOllama(params: {
    prompt: string;
    system?: string;
    images?: string[];
  }): Promise<string> {
    const res = await fetch('/api/local/ollama/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: this.ollamaHost,
        model: this.ollamaModel,
        prompt: params.prompt,
        system: params.system,
        images: params.images || [],
        format: 'json',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Local Ollama generation failed');
    }
    return data.response;
  }

  // Unified script generator with bulletproof fallback
  async generateRecapScriptUnified(params: {
    chapterTitle: string;
    genre?: string;
    tone?: string;
    panelDescriptions: string[];
    userNotes?: string;
    images?: string[];
  }): Promise<GeneratedPanelScript[]> {
    const engine = this.getActiveEngine();

    if (engine === 'local-ollama') {
      try {
        const prompt = `Create a comedic 4th-wall breaking manhwa recap script for Chapter: "${params.chapterTitle}" (${params.genre || 'Action Manhwa'}).
Tone: ${params.tone || 'Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy)'}
User Notes: ${params.userNotes || ''}
Number of panels: ${params.panelDescriptions.length}
Panels:
${params.panelDescriptions.map((desc, i) => `Panel ${i + 1}: ${desc}`).join('\n')}

Return a valid JSON array of panel scripts. Each item has:
"commentary": hilarious 1-3 lines speaking to chat,
"suggestedCamera": 'crash-zoom' | 'pan-down' | 'pan-right' | 'shake-impact' | 'slow-drift',
"soundEffect": 'vine-boom' | 'record-scratch' | 'anime-punch' | 'discord-ping' | 'level-up' | 'none',
"durationSeconds": 5.0`;

        const responseText = await this.generateWithOllama({
          prompt,
          images: params.images || [],
        });

        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const res = Array.isArray(parsed) ? parsed : (parsed.panels || []);
        if (res.length > 0) return res;
      } catch (ollamaErr) {
        console.warn('Ollama generation failed, falling back to Cloud Gemini:', ollamaErr);
      }
    }

    if (engine === 'in-browser-model') {
      try {
        const prompt = `Chapter: "${params.chapterTitle}". Panels count: ${params.panelDescriptions.length}.
Generate a JSON array of humorous recap lines breaking the 4th wall for these panels:
${params.panelDescriptions.map((desc, i) => `${i + 1}. ${desc}`).join('\n')}`;

        const raw = await this.generateWithBrowserModel(prompt, 350);
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (browserErr) {
        console.warn('In-browser model encountered error (WASM heap/OOM), falling back to Cloud Gemini:', browserErr);
      }
    }

    // Default & Fallback: Cloud Gemini with full Vision and OCR if images are present
    try {
      const { requestScriptGeneration, requestSegmentedChapterGeneration } = await import('./geminiClient');

      if (params.images && params.images.length > 0) {
        const visionPayload = params.images.map((img) => ({
          base64: img,
          mimeType: img.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
        }));

        try {
          const segmentedResult = await requestSegmentedChapterGeneration({
            images: visionPayload,
            chapterTitle: params.chapterTitle,
            tone: params.tone,
            userNotes: params.userNotes,
            segmentSize: 4,
          });
          if (segmentedResult && segmentedResult.length > 0) {
            return segmentedResult;
          }
        } catch (segErr) {
          console.warn('Segmented vision chapter generation failed, trying direct generation:', segErr);
        }
      }

      return await requestScriptGeneration({
        chapterTitle: params.chapterTitle,
        genre: params.genre,
        tone: params.tone,
        panelDescriptions: params.panelDescriptions,
        userNotes: params.userNotes,
        images: params.images?.map(img => ({ base64: img, mimeType: 'image/jpeg' })),
      });
    } catch (cloudErr) {
      console.warn('Cloud Gemini script generation error, using dynamic panel recap defaults:', cloudErr);
      // Failsafe dynamic generator
      return params.panelDescriptions.map((desc, i) => ({
        title: `Scene ${i + 1}`,
        commentary: i === 0 
          ? `Check out the situation right here in Scene ${i + 1}: ${desc.slice(0, 70)}!`
          : `Notice what is happening in panel ${i + 1}: ${desc.slice(0, 70)}!`,
        suggestedCamera: i % 2 === 0 ? 'crash-zoom' : 'pan-down',
        soundEffect: i === 0 ? 'record-scratch' : (i % 2 === 1 ? 'vine-boom' : 'none'),
        durationSeconds: 5.2,
      }));
    }
  }
}

export const localAiEngine = new LocalAiEngine();
