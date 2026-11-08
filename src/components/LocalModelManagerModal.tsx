import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Cpu, 
  Server, 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Play, 
  RefreshCw, 
  HardDrive, 
  Terminal,
  Volume2,
  Sparkles,
  Zap,
  Globe,
  Flame,
  Gauge,
  Sliders,
  Check
} from 'lucide-react';
import { 
  localAiEngine, 
  AiEngineType, 
  AVAILABLE_LOCAL_MODELS, 
  HARDWARE_PRESETS,
  DownloadProgress 
} from '../services/localAiEngine';
import { audioEngine } from '../services/audioEngine';
import { speakBrowserVoice } from '../services/geminiClient';

interface LocalModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEngineChanged: (engine: AiEngineType) => void;
}

export const LocalModelManagerModal: React.FC<LocalModelManagerModalProps> = ({
  isOpen,
  onClose,
  onEngineChanged,
}) => {
  const [activeEngine, setActiveEngine] = useState<AiEngineType>(localAiEngine.getActiveEngine());
  const [selectedPreset, setSelectedPreset] = useState<string>(localAiEngine.getSelectedPresetId());
  const [selectedLocalModel, setSelectedLocalModel] = useState<string>(localAiEngine.getSelectedLocalModelId());
  
  // Auto-download progress state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    status: 'idle',
    progress: 0,
  });

  // Ollama state
  const [ollamaHost, setOllamaHost] = useState(localAiEngine.getOllamaConfig().host);
  const [ollamaModel, setOllamaModel] = useState(localAiEngine.getOllamaConfig().model);
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [detectedOllamaModels, setDetectedOllamaModels] = useState<any[]>([]);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  // Test prompt & Voice state
  const [testPrompt, setTestPrompt] = useState('Chat, look at this F-rank cleaner fighting a 10-foot orc with a golden dustpan!');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [isTestingTts, setIsTestingTts] = useState(false);

  useEffect(() => {
    const unsub = localAiEngine.subscribeDownloadProgress((p) => {
      setDownloadProgress(p);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleSelectEngine = (engine: AiEngineType) => {
    setActiveEngine(engine);
    localAiEngine.setActiveEngine(engine);
    onEngineChanged(engine);
  };

  const handleApplyPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    localAiEngine.applyHardwarePreset(presetId);
    setActiveEngine(localAiEngine.getActiveEngine());
    setSelectedLocalModel(localAiEngine.getSelectedLocalModelId());
    onEngineChanged(localAiEngine.getActiveEngine());
  };

  // 1-Click Auto Download All Models for RTX 5070 Ti Suite
  const handleAutoDownload5070TiSuite = async () => {
    handleApplyPreset('rtx-5070ti-beast');
    try {
      await localAiEngine.autoDownloadRtx5070TiSuite();
    } catch {
      // error handled in listener
    }
  };

  const handleTestOllama = async () => {
    setOllamaStatus('testing');
    setOllamaError(null);
    try {
      const result = await localAiEngine.testOllamaConnection(ollamaHost);
      if (result.success) {
        setOllamaStatus('connected');
        setDetectedOllamaModels(result.models || []);
        if (result.models.length > 0 && !result.models.some((m: any) => m.name === ollamaModel)) {
          setOllamaModel(result.models[0].name);
          localAiEngine.setOllamaConfig(ollamaHost, result.models[0].name);
        }
      } else {
        setOllamaStatus('failed');
        setOllamaError(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setOllamaStatus('failed');
      setOllamaError(err.message || 'Could not connect to Ollama');
    }
  };

  const handleSaveOllamaConfig = () => {
    localAiEngine.setOllamaConfig(ollamaHost, ollamaModel);
    handleSelectEngine('local-ollama');
  };

  // Run test script inference
  const handleRunTestGeneration = async () => {
    setIsTestingModel(true);
    setTestOutput(null);

    try {
      if (activeEngine === 'in-browser-model') {
        const out = await localAiEngine.generateWithBrowserModel(testPrompt, 220);
        setTestOutput(out);
      } else if (activeEngine === 'local-ollama') {
        const out = await localAiEngine.generateWithOllama({ prompt: testPrompt });
        setTestOutput(out);
      } else {
        setTestOutput('Cloud Gemini engine is active. Switch to Local Browser Model or Ollama to test local inference.');
      }
    } catch (err: any) {
      setTestOutput(`Error: ${err.message || 'Inference failed'}`);
    } finally {
      setIsTestingModel(false);
    }
  };

  // Run test local voice synthesis
  const handleRunTestVoice = async () => {
    setIsTestingTts(true);
    try {
      const base64Wav = await localAiEngine.synthesizeLocalVoice(testPrompt);
      await audioEngine.playVoiceBase64(base64Wav);
    } catch (err: any) {
      console.warn('Local SpeechT5 error, testing browser speech fallback:', err);
      speakBrowserVoice(testPrompt);
    } finally {
      setIsTestingTts(false);
    }
  };

  const isScriptDownloaded = localAiEngine.isModelDownloaded(selectedLocalModel) || localAiEngine.isModelDownloaded('onnx-community/Qwen2.5-0.5B-Instruct');
  const isTtsDownloaded = localAiEngine.isModelDownloaded('Xenova/speecht5_tts');
  const isAllSuiteDownloaded = isScriptDownloaded && isTtsDownloaded;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#10101a] border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Specs Tag */}
        <div className="px-6 py-4 bg-[#141422] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#12121a] rounded-[10px] flex items-center justify-center text-emerald-400">
                <Gauge className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white font-['Cabinet_Grotesk'] tracking-wide">
                  HARDWARE PRESETS & LOCAL MODELS
                </h2>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-black text-[10px] border border-emerald-500/40 flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-emerald-400" />
                  RTX 5070 Ti + 32GB RAM
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                1-click auto-download Hugging Face local models tuned for your laptop GPU & memory
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* HARDWARE PRESETS CARDS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-extrabold text-zinc-200 text-xs flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Select Hardware Preset for Your Machine
              </label>
              <span className="text-[11px] text-zinc-400 font-mono">
                GPU VRAM: ~12-16GB &bull; System: 32GB RAM
              </span>
            </div>

            <div className="space-y-2.5">
              {HARDWARE_PRESETS.map((p) => {
                const isSelected = selectedPreset === p.id;
                const is5070Ti = p.id === 'rtx-5070ti-beast';

                return (
                  <div
                    key={p.id}
                    onClick={() => handleApplyPreset(p.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-950/20 shadow-md shadow-emerald-500/15 ring-1 ring-emerald-400/50'
                        : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-xs">{p.name}</span>
                        {is5070Ti && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black font-black text-[9px] uppercase tracking-wider flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5 fill-black" /> BEST MATCH FOR YOUR SPECS
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-emerald-400 font-bold">
                        {p.vramUsageEstimate}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{p.description}</p>

                    <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center gap-4 text-[10px] text-zinc-400 font-mono">
                      <span><strong>Script:</strong> {p.recommendedScriptModel.replace('onnx-community/', '')}</span>
                      <span><strong>Voice:</strong> {p.recommendedTtsModel.replace('Xenova/', '')}</span>
                      <span><strong>Render:</strong> 1080p {p.defaultFps}FPS @ {p.defaultBitrate / 1_000_000}Mbps</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 1-CLICK AUTO DOWNLOAD BANNER FOR RTX 5070 Ti */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-teal-950/40 to-cyan-950/50 border border-emerald-500/40 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-sm">
                    RTX 5070 Ti Local AI Suite (Hugging Face)
                  </span>
                  {isAllSuiteDownloaded && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] flex items-center gap-1 border border-emerald-500/40">
                      <CheckCircle2 className="w-3 h-3" /> Fully Installed
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5">
                  Downloads Qwen 2.5 1.5B (4th-Wall Comedy Scripting) + SpeechT5 (Local Neural Voiceover) to your browser cache.
                </p>
              </div>

              {!isAllSuiteDownloaded ? (
                <button
                  onClick={handleAutoDownload5070TiSuite}
                  disabled={downloadProgress.status === 'downloading'}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all flex-shrink-0"
                >
                  {downloadProgress.status === 'downloading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Downloading ({downloadProgress.progress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 stroke-[2.5]" />
                      <span>Auto-Download All Models</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Ready on WebGPU</span>
                </div>
              )}
            </div>

            {/* Multi-stage download progress indicator */}
            {downloadProgress.status === 'downloading' && (
              <div className="p-3 bg-black/60 rounded-xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-200 font-bold font-mono">
                    {downloadProgress.stage || 'Downloading model weights from Hugging Face...'}
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">{downloadProgress.progress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-150"
                    style={{ width: `${downloadProgress.progress}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">
                  Target: {downloadProgress.currentModelName} &bull; {downloadProgress.loadedMb || 0} / {downloadProgress.totalMb || 1400} MB
                </div>
              </div>
            )}
          </div>

          {/* ENGINE TOGGLE BUTTONS */}
          <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 flex items-center justify-between">
            <span className="font-bold text-zinc-300">Active Execution Mode:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleSelectEngine('in-browser-model')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeEngine === 'in-browser-model'
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>In-Browser WebGPU</span>
              </button>

              <button
                onClick={() => handleSelectEngine('local-ollama')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeEngine === 'local-ollama'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Ollama Localhost</span>
              </button>

              <button
                onClick={() => handleSelectEngine('cloud-gemini')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeEngine === 'cloud-gemini'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Cloud Gemini</span>
              </button>
            </div>
          </div>

          {/* INTERACTIVE TEST LAB: SCRIPT & NEURAL VOICE */}
          <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Local AI Test Lab (Scripts & Voiceover)
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Engine: {activeEngine}
              </span>
            </div>

            <textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              rows={2}
              className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-xs focus:outline-none focus:border-emerald-400 resize-none font-sans"
              placeholder="Test prompt for script or voice..."
            />

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunTestGeneration}
                disabled={isTestingModel}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isTestingModel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Test Local Script (Qwen 2.5)</span>
              </button>

              <button
                onClick={handleRunTestVoice}
                disabled={isTestingTts}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isTestingTts ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
                <span>Test Local Voiceover (SpeechT5)</span>
              </button>
            </div>

            {testOutput && (
              <div className="p-3 bg-black rounded-lg border border-zinc-800 text-[11px] text-zinc-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                {testOutput}
              </div>
            )}
          </div>

          {/* OLLAMA LOCALHOST CONFIG IF SELECTED */}
          {activeEngine === 'local-ollama' && (
            <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-3">
              <span className="font-bold text-zinc-200 block">Ollama Localhost Configuration</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ollamaHost}
                  onChange={(e) => setOllamaHost(e.target.value)}
                  placeholder="http://127.0.0.1:11434"
                  className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleTestOllama}
                  disabled={ollamaStatus === 'testing'}
                  className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test Connection</span>
                </button>
              </div>

              {ollamaStatus === 'connected' && (
                <div className="text-emerald-400 text-[11px] font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Connected to Ollama! Found {detectedOllamaModels.length} models installed.</span>
                </div>
              )}

              {detectedOllamaModels.length > 0 && (
                <div>
                  <label className="text-zinc-400 block mb-1">Select Local Ollama Model</label>
                  <select
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                  >
                    {detectedOllamaModels.map((m: any) => (
                      <option key={m.name} value={m.name}>
                        {m.name} ({(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="text-amber-300 bg-black/60 p-2 rounded border border-zinc-800 font-mono text-[11px]">
                ollama run llama3.2-vision
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#141422] border-t border-zinc-800 flex items-center justify-between">
          <div className="text-xs text-zinc-400 font-mono">
            VRAM Profile: <strong className="text-emerald-400">RTX 5070 Ti Optimized</strong>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition-all shadow-md shadow-emerald-500/20"
          >
            Apply & Done
          </button>
        </div>
      </div>
    </div>
  );
};
