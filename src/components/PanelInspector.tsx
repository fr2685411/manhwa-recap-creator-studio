import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Volume2, 
  Sliders, 
  Zap, 
  Sparkles, 
  Play, 
  Square,
  Type, 
  Clock, 
  Flame, 
  RefreshCw,
  Layers,
  VolumeX,
  Mic,
  Upload,
  Headphones,
  FileText,
  Palette,
  Check,
  RotateCcw,
  Copy,
  Eye,
  SlidersHorizontal,
  Sun,
  Contrast,
  ListOrdered,
  Maximize2,
  Minimize2,
  Download,
  ExternalLink
} from 'lucide-react';
import { 
  Panel, 
  ProjectSettings, 
  CameraMotionType, 
  TransitionType, 
  SoundEffectType, 
  TRANSITION_LIBRARY, 
  VoiceClipSettings, 
  VoiceEqPreset,
  SubtitleStyle,
  SubtitleShadowPreset
} from '../types/manhwa';
import { audioEngine } from '../services/audioEngine';
import { requestTtsAudio, speakBrowserVoice } from '../services/geminiClient';
import { localAiEngine } from '../services/localAiEngine';

export type InspectorTabType = 'script' | 'full-script' | 'voice' | 'camera' | 'sfx' | 'subtitles' | 'subtitle-settings';

interface PanelInspectorProps {
  panel: Panel | undefined;
  panelIndex: number;
  project: ProjectSettings;
  onUpdatePanel: (updated: Panel) => void;
  onUpdateProject: (updater: (prev: ProjectSettings) => ProjectSettings) => void;
  onSelectPanel?: (index: number) => void;
  onSeek?: (time: number) => void;
  activeTab?: InspectorTabType;
  onTabChange?: (tab: InspectorTabType) => void;
}

export const PanelInspector: React.FC<PanelInspectorProps> = ({
  panel,
  panelIndex,
  project,
  onUpdatePanel,
  onUpdateProject,
  onSelectPanel,
  onSeek,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);
  const [internalActiveTab, setInternalActiveTab] = useState<InspectorTabType>('voice');
  const activeTab = controlledTab ?? internalActiveTab;
  const setActiveTab = (tab: InspectorTabType) => {
    setInternalActiveTab(tab);
    onTabChange?.(tab);
  };

  const [copiedAllStatus, setCopiedAllStatus] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullScriptMode, setFullScriptMode] = useState<'segmented' | 'continuous'>('segmented');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedTtsLines, setCopiedTtsLines] = useState(false);
  const [ttsExportFormat, setTtsExportFormat] = useState<'clean' | 'numbered' | 'full'>('clean');
  const [isBatchVoicingAll, setIsBatchVoicingAll] = useState(false);
  const [batchVoiceStatus, setBatchVoiceStatus] = useState('');
  const [auditioningPanelId, setAuditioningPanelId] = useState<string | null>(null);

  // Subtitle style helper for current panel (falls back to project default)
  const currentSubtitleStyle: SubtitleStyle = {
    ...project.subtitleStyle,
    ...(panel?.subtitleStyle || {}),
  };

  const updateSubtitleStyle = (partial: Partial<SubtitleStyle>) => {
    if (!panel) return;
    const updated: SubtitleStyle = {
      ...currentSubtitleStyle,
      ...partial,
      isCustom: true,
    };
    onUpdatePanel({
      ...panel,
      subtitleStyle: updated,
    });
  };

  const resetSubtitleStyle = () => {
    if (!panel) return;
    onUpdatePanel({
      ...panel,
      subtitleStyle: undefined,
    });
  };

  const applySubtitleStyleToAll = () => {
    if (!panel) return;
    const styleToApply: SubtitleStyle = { ...currentSubtitleStyle, isCustom: true };
    onUpdateProject((prev) => ({
      ...prev,
      subtitleStyle: styleToApply,
      panels: prev.panels.map(p => ({
        ...p,
        subtitleStyle: { ...styleToApply },
      })),
    }));
    setCopiedAllStatus(true);
    setTimeout(() => setCopiedAllStatus(false), 2000);
  };

  // Full script calculations across all panels
  const fullScriptText = project.panels
    .map(p => p.commentary.trim())
    .filter(Boolean)
    .join('\n\n');

  const totalWords = fullScriptText.split(/\s+/).filter(Boolean).length;
  const totalDuration = project.panels.reduce((sum, p) => sum + p.duration, 0);
  const panelsWithVoice = project.panels.filter(p => p.commentary && p.audioBase64).length;
  const totalCommentaryPanels = project.panels.filter(p => p.commentary).length;

  const getPanelStartTime = (idx: number) => {
    return project.panels.slice(0, idx).reduce((sum, p) => sum + p.duration, 0);
  };

  const formatPanelTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const handleCopyFullScript = () => {
    navigator.clipboard.writeText(fullScriptText);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleExportScriptTxt = () => {
    let content = `========================================================\n`;
    content += `MANHWA RECAP STORY SCRIPT: ${project.title || 'Untitled'}\n`;
    content += `Aspect Ratio: ${project.aspectRatio} | Voice Persona: ${project.voicePersona} | Panels: ${project.panels.length}\n`;
    content += `Total Words: ${totalWords} | Estimated Duration: ~${totalDuration.toFixed(1)}s\n`;
    content += `========================================================\n\n`;

    project.panels.forEach((p, idx) => {
      const startSec = getPanelStartTime(idx);
      const endSec = startSec + p.duration;
      content += `[PANEL ${idx + 1}] (${formatPanelTime(startSec)} - ${formatPanelTime(endSec)} | ${p.duration.toFixed(1)}s) - "${p.title}"\n`;
      content += `${p.commentary || '(No commentary written yet)'}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project.title || 'manhwa_recap').replace(/[^a-zA-Z0-9_-]/g, '_')}_script.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate clean voiceover text lines for TTS engines (ElevenLabs, Edge-TTS, Kokoro, Chatterbox, Bark)
  const getTtsTextContent = (format: 'clean' | 'numbered' | 'full' = ttsExportFormat) => {
    if (format === 'clean') {
      // 1 line per panel commentary: ideal for batch TTS audio generators
      return project.panels
        .map(p => p.commentary.trim())
        .filter(Boolean)
        .join('\n');
    }
    if (format === 'numbered') {
      return project.panels
        .map((p, idx) => `[Panel ${idx + 1}] ${p.commentary.trim()}`)
        .filter(line => !line.endsWith(']'))
        .join('\n');
    }
    // full teleprompter
    let content = `========================================================\n`;
    content += `MANHWA RECAP STORY SCRIPT: ${project.title || 'Untitled'}\n`;
    content += `Aspect Ratio: ${project.aspectRatio} | Voice Persona: ${project.voicePersona} | Panels: ${project.panels.length}\n`;
    content += `Total Words: ${totalWords} | Estimated Duration: ~${totalDuration.toFixed(1)}s\n`;
    content += `========================================================\n\n`;
    project.panels.forEach((p, idx) => {
      const startSec = getPanelStartTime(idx);
      const endSec = startSec + p.duration;
      content += `[PANEL ${idx + 1}] (${formatPanelTime(startSec)} - ${formatPanelTime(endSec)} | ${p.duration.toFixed(1)}s) - "${p.title}"\n`;
      content += `${p.commentary || '(No commentary written yet)'}\n\n`;
    });
    return content;
  };

  const handleCopyTtsLines = (format: 'clean' | 'numbered' | 'full' = ttsExportFormat) => {
    const text = getTtsTextContent(format);
    navigator.clipboard.writeText(text);
    setCopiedTtsLines(true);
    setTimeout(() => setCopiedTtsLines(false), 2000);
  };

  const handleExportTtsLinesTxt = (format: 'clean' | 'numbered' | 'full' = ttsExportFormat) => {
    const text = getTtsTextContent(format);
    const suffix = format === 'clean' ? '_tts_lines' : (format === 'numbered' ? '_tts_numbered' : '_script');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project.title || 'manhwa_recap').replace(/[^a-zA-Z0-9_-]/g, '_')}${suffix}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAuditionPanelVoice = async (targetPanel: Panel) => {
    if (!targetPanel.commentary) return;
    if (auditioningPanelId === targetPanel.id) {
      audioEngine.stopVoice();
      setAuditioningPanelId(null);
      return;
    }

    setAuditioningPanelId(targetPanel.id);
    if (targetPanel.audioBase64) {
      try {
        await audioEngine.playVoiceBase64(targetPanel.audioBase64, targetPanel.voiceSettings);
      } catch (err) {
        console.warn('Playback error:', err);
      } finally {
        setAuditioningPanelId(null);
      }
    } else {
      speakBrowserVoice(targetPanel.commentary, () => {
        setAuditioningPanelId(null);
      });
    }
  };

  const handleBatchVoiceAllPanels = async () => {
    const unvoiced = project.panels.filter(p => p.commentary && !p.audioBase64);
    if (unvoiced.length === 0) return;

    setIsBatchVoicingAll(true);
    let done = 0;
    try {
      const updatedPanels = [...project.panels];
      for (let i = 0; i < updatedPanels.length; i++) {
        const p = updatedPanels[i];
        if (p.commentary && !p.audioBase64) {
          done++;
          setBatchVoiceStatus(`Synthesizing line ${done}/${unvoiced.length}...`);
          try {
            const persona = p.voiceSettings?.voicePersona || project.voicePersona || 'Puck';
            const style = p.voiceSettings?.stylePrompt || 'Energetic comedic anime manhwa recap host speaking naturally to the audience';
            const audioBase64 = await requestTtsAudio(p.commentary, persona, style);
            updatedPanels[i] = { ...p, audioBase64 };
            onUpdateProject(prev => ({ ...prev, panels: [...updatedPanels] }));
          } catch (e) {
            console.warn(`Voice synthesis failed for panel ${i + 1}:`, e);
          }
        }
      }
    } finally {
      setIsBatchVoicingAll(false);
      setBatchVoiceStatus('');
    }
  };

  // Mic recording state
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Waveform visualization state
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');

  // Default voice settings if not set
  const currentVoiceSettings: VoiceClipSettings = panel?.voiceSettings || {
    volume: 1.0,
    speed: 1.0,
    pitch: 0,
    startOffset: 0.0,
    fadeIn: 0.05,
    fadeOut: 0.05,
    isMuted: false,
    voicePersona: project.voicePersona,
    stylePrompt: 'Energetic comedic anime manhwa recap host speaking naturally to the audience',
    eqFilter: 'clean',
  };

  // Update voice settings helper
  const updateVoiceSettings = (partial: Partial<VoiceClipSettings>) => {
    if (!panel) return;
    const updated = {
      ...currentVoiceSettings,
      ...partial,
    };
    onUpdatePanel({
      ...panel,
      voiceSettings: updated,
    });
  };

  // Compute waveform whenever audioBase64 changes
  useEffect(() => {
    if (panel?.audioBase64) {
      audioEngine.getAudioBufferWaveform(panel.audioBase64, 32).then(bars => {
        setWaveformBars(bars);
      });
    } else {
      setWaveformBars([]);
    }
  }, [panel?.audioBase64]);

  if (!panel) {
    return (
      <div className="w-80 md:w-96 bg-[#0e0e16] border-l border-zinc-800 p-6 flex flex-col items-center justify-center text-zinc-500 text-sm">
        <Layers className="w-10 h-10 mb-2 opacity-30" />
        <p>Select a panel from the timeline to edit</p>
      </div>
    );
  }

  // Camera preset handler
  const applyCameraPreset = (preset: CameraMotionType) => {
    let start = { x: 0.5, y: 0.5, zoom: 1.0 };
    let end = { x: 0.5, y: 0.5, zoom: 1.3 };
    let shakeIntensity = 0;
    let easing: 'ease-in-out' | 'ease-out' | 'linear' | 'punch' = 'ease-in-out';

    if (preset === 'crash-zoom') {
      start = { x: 0.5, y: 0.45, zoom: 1.0 };
      end = { x: 0.52, y: 0.42, zoom: 2.1 };
      shakeIntensity = 0.7;
      easing = 'punch';
    } else if (preset === 'pan-down') {
      start = { x: 0.5, y: 0.2, zoom: 1.15 };
      end = { x: 0.5, y: 0.75, zoom: 1.3 };
      easing = 'ease-in-out';
    } else if (preset === 'pan-right') {
      start = { x: 0.25, y: 0.5, zoom: 1.2 };
      end = { x: 0.75, y: 0.5, zoom: 1.4 };
      easing = 'ease-in-out';
    } else if (preset === 'shake-impact') {
      start = { x: 0.5, y: 0.5, zoom: 1.25 };
      end = { x: 0.5, y: 0.5, zoom: 1.55 };
      shakeIntensity = 1.0;
      easing = 'punch';
    } else if (preset === 'slow-drift') {
      start = { x: 0.5, y: 0.6, zoom: 1.05 };
      end = { x: 0.5, y: 0.4, zoom: 1.25 };
      easing = 'linear';
    } else if (preset === 'zoom-in') {
      start = { x: 0.5, y: 0.5, zoom: 1.0 };
      end = { x: 0.5, y: 0.5, zoom: 1.6 };
      easing = 'ease-out';
    } else if (preset === 'zoom-out') {
      start = { x: 0.5, y: 0.5, zoom: 1.6 };
      end = { x: 0.5, y: 0.5, zoom: 1.05 };
      easing = 'ease-out';
    }

    onUpdatePanel({
      ...panel,
      camera: {
        ...panel.camera,
        type: preset,
        start,
        end,
        shakeIntensity,
        easing,
      },
    });
  };

  // Sound effect preview and select
  const handleSelectSfx = (sfx: SoundEffectType) => {
    onUpdatePanel({ ...panel, soundEffect: sfx });
    if (sfx !== 'none') {
      audioEngine.playSoundEffect(sfx);
    }
  };

  // AI Voice Synthesis (Local SpeechT5 or Gemini TTS)
  const handleSynthesizeVoice = async () => {
    if (!panel.commentary) return;
    setIsGeneratingTts(true);
    try {
      let audioBase64: string;

      if (localAiEngine.getActiveEngine() === 'in-browser-model') {
        audioBase64 = await localAiEngine.synthesizeLocalVoice(panel.commentary);
      } else {
        const persona = currentVoiceSettings.voicePersona || project.voicePersona;
        const style = currentVoiceSettings.stylePrompt || 'Energetic comedic anime manhwa recap host speaking naturally to the audience';
        audioBase64 = await requestTtsAudio(panel.commentary, persona as any, style);
      }
      
      onUpdatePanel({
        ...panel,
        audioBase64,
        voiceSettings: currentVoiceSettings,
      });

      // Play test preview with settings
      await audioEngine.playVoiceBase64(audioBase64, currentVoiceSettings);
    } catch (err: any) {
      console.warn('Voice synthesis error, using browser speech fallback:', err);
      speakBrowserVoice(panel.commentary);
    } finally {
      setIsGeneratingTts(false);
    }
  };

  // Batch synthesize AI voice for all panels in project
  const handleGenerateAllVoices = async () => {
    const panelsWithText = project.panels.filter(p => p.commentary);
    if (panelsWithText.length === 0) return;

    setIsBatchGenerating(true);
    setBatchProgress(`0/${panelsWithText.length}`);
    try {
      const updatedPanels = [...project.panels];
      let count = 0;
      for (let i = 0; i < updatedPanels.length; i++) {
        const p = updatedPanels[i];
        if (p.commentary) {
          count++;
          setBatchProgress(`${count}/${panelsWithText.length}`);
          const persona = p.voiceSettings?.voicePersona || currentVoiceSettings.voicePersona || project.voicePersona || 'Puck';
          const style = p.voiceSettings?.stylePrompt || currentVoiceSettings.stylePrompt || 'Energetic comedic anime manhwa recap host speaking naturally to the audience';
          try {
            const audioBase64 = await requestTtsAudio(p.commentary, persona as any, style);
            updatedPanels[i] = {
              ...p,
              audioBase64,
              voiceSettings: {
                ...currentVoiceSettings,
                ...(p.voiceSettings || {}),
                voicePersona: persona,
              },
            };
          } catch (e) {
            console.warn(`Batch voice error on panel ${i + 1}:`, e);
          }
        }
      }
      onUpdateProject((prev) => ({ ...prev, panels: updatedPanels }));
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress('');
    }
  };

  // Audition voice with all video editor filters (pitch, speed, gain, EQ)
  const handleAuditionVoice = async () => {
    if (isPlayingAudition) {
      audioEngine.stopVoice();
      setIsPlayingAudition(false);
      return;
    }

    if (panel.audioBase64) {
      setIsPlayingAudition(true);
      const dur = await audioEngine.playVoiceBase64(panel.audioBase64, currentVoiceSettings);
      setTimeout(() => {
        setIsPlayingAudition(false);
      }, (dur || 1.5) * 1000);
    } else if (panel.commentary) {
      speakBrowserVoice(panel.commentary);
    }
  };

  // Microphone recording
  const startRecordingMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setIsRecordingMic(false);

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          if (base64) {
            onUpdatePanel({
              ...panel,
              audioBase64: base64,
              voiceSettings: {
                ...currentVoiceSettings,
                voicePersona: 'Custom',
              },
            });
            audioEngine.playVoiceBase64(base64, currentVoiceSettings);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start();
      setIsRecordingMic(true);
      setRecordingSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access failed:', err);
      alert('Microphone access denied or not available. Please allow mic permissions in your browser.');
    }
  };

  const stopRecordingMic = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // File upload for custom audio
  const handleUploadAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        onUpdatePanel({
          ...panel,
          audioBase64: base64,
          voiceSettings: {
            ...currentVoiceSettings,
            voicePersona: 'Custom',
          },
        });
        audioEngine.playVoiceBase64(base64, currentVoiceSettings);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Clear audio
  const handleClearVoice = () => {
    audioEngine.stopVoice();
    onUpdatePanel({
      ...panel,
      audioBase64: undefined,
    });
  };

  // Auto generate subtitles from commentary text
  const handleRegenerateSubtitles = () => {
    if (!panel.commentary) return;
    const rawWords = panel.commentary.split(/\s+/).filter(Boolean);
    const wordDur = panel.duration / Math.max(1, rawWords.length);
    const subtitles = rawWords.map((w, idx) => ({
      text: w,
      startTime: Math.round(idx * wordDur * 100) / 100,
      endTime: Math.round((idx + 1) * wordDur * 100) / 100,
      isPunch: /^[A-Z0-9!]{3,}|bro|wait|dead|what|he|him|fr/i.test(w) || w.includes('!') || w.includes('?'),
    }));
    onUpdatePanel({ ...panel, subtitles });
  };

  // Toggle punch word in subtitles
  const togglePunchWord = (idx: number) => {
    const subs = [...panel.subtitles];
    if (subs[idx]) {
      subs[idx] = { ...subs[idx], isPunch: !subs[idx].isPunch };
      onUpdatePanel({ ...panel, subtitles: subs });
    }
  };

  return (
    <div className={`${isExpanded ? 'w-80 md:w-[600px] lg:w-[680px]' : 'w-80 md:w-96'} bg-[#0f0f17] border-l border-zinc-800 flex flex-col h-full overflow-hidden select-none z-10 transition-all duration-200`}>
      {/* Panel Inspector Header */}
      <div className="p-3.5 bg-[#12121e] border-b border-zinc-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-black text-xs border border-amber-500/30">
              PANEL #{panelIndex + 1}
            </span>
            <input
              type="text"
              value={panel.title}
              onChange={(e) => onUpdatePanel({ ...panel, title: e.target.value })}
              className="bg-transparent text-sm font-bold text-white focus:outline-none focus:border-b focus:border-amber-400"
            />
          </div>
        </div>

        {/* Duration tweak badge & expand toggle */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 font-mono text-xs bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800 text-zinc-300">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{panel.duration.toFixed(1)}s</span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse inspector width' : 'Expand width for full script reading'}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-[#0c0c14] text-[11px] font-semibold overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('script')}
          className={`flex-1 min-w-[50px] py-2.5 flex items-center justify-center gap-1 transition-all border-b-2 shrink-0 ${
            activeTab === 'script'
              ? 'border-amber-400 text-amber-400 bg-amber-400/5'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
          title="Current Panel Commentary"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Panel</span>
        </button>

        <button
          onClick={() => setActiveTab('full-script')}
          className={`flex-1 min-w-[76px] py-2.5 flex items-center justify-center gap-1 transition-all border-b-2 relative shrink-0 ${
            activeTab === 'full-script'
              ? 'border-amber-400 text-amber-400 bg-amber-400/5'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
          title="Whole Story Voiceover Script (All Panels)"
        >
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          <span>Full Script</span>
          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded font-mono font-bold">
            {project.panels.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('voice')}
          className={`flex-1 min-w-[54px] py-2.5 flex items-center justify-center gap-1 transition-all border-b-2 relative shrink-0 ${
            activeTab === 'voice'
              ? 'border-blue-400 text-blue-400 bg-blue-400/5'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
          title="Video Editor Voiceover Studio"
        >
          <Mic className="w-3.5 h-3.5 text-blue-400" />
          <span>Voice</span>
          {panel.audioBase64 && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-2 right-1.5 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('camera')}
          className={`flex-1 min-w-[54px] py-2.5 flex items-center justify-center gap-1 transition-all border-b-2 shrink-0 ${
            activeTab === 'camera'
              ? 'border-amber-400 text-amber-400 bg-amber-400/5'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
          title="Camera Pan/Zoom & Transitions"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Cam</span>
        </button>

        <button
          onClick={() => setActiveTab('sfx')}
          className={`flex-1 min-w-[48px] py-2.5 flex items-center justify-center gap-1 transition-all border-b-2 shrink-0 ${
            activeTab === 'sfx'
              ? 'border-red-400 text-red-400 bg-red-400/5'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
          title="Sound FX & Music"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>SFX</span>
        </button>

        <button
          onClick={() => setActiveTab('subtitles')}
          className={`flex-1 min-w-[52px] py-2.5 flex items-center justify-center gap-1 transition-all border-b-2 shrink-0 ${
            activeTab === 'subtitles'
              ? 'border-amber-400 text-amber-400 bg-amber-400/5'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
          title="Karaoke Word Timings & Punchlines"
        >
          <Type className="w-3.5 h-3.5" />
          <span>Words</span>
        </button>

        <button
          onClick={() => setActiveTab('subtitle-settings')}
          className={`flex-1 min-w-[70px] py-2.5 flex items-center justify-center gap-1 transition-all border-b-2 relative shrink-0 ${
            activeTab === 'subtitle-settings'
              ? 'border-amber-400 text-amber-400 bg-amber-400/5'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
          title="Subtitle Settings: font style, text color, stroke outline & shadow effects"
        >
          <Palette className="w-3.5 h-3.5 text-amber-400" />
          <span>Subtitles</span>
          {panel.subtitleStyle?.isCustom && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-2 right-1.5" />
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* TAB 1: SCRIPT & MAMORU COMMENTARY */}
        {activeTab === 'script' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-zinc-200 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  4th-Wall Commentary (Mamoru Style)
                </label>
                <span className="text-[10px] text-amber-400/80 font-mono">
                  {panel.commentary.length} chars
                </span>
              </div>
              <textarea
                value={panel.commentary}
                onChange={(e) => onUpdatePanel({ ...panel, commentary: e.target.value })}
                rows={5}
                placeholder="Write humorous 4th-wall commentary reacting to this panel..."
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl p-3 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-sans leading-relaxed text-xs resize-none"
              />
            </div>

            {/* Quick Link to Voice Studio */}
            <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-zinc-200 text-xs">Voiceover Ready</div>
                <div className="text-[10px] text-zinc-400">
                  {panel.audioBase64 ? '✓ Audio attached to this panel' : 'No voice clip attached yet'}
                </div>
              </div>
              <button
                onClick={() => setActiveTab('voice')}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 transition-all"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Open Voice Studio</span>
              </button>
            </div>

            {/* Natural Pacing / Duration Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-zinc-300">Panel Duration / Pacing</label>
                <span className="font-mono text-amber-400 font-bold">{panel.duration.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={2.0}
                max={15.0}
                step={0.5}
                value={panel.duration}
                onChange={(e) => onUpdatePanel({ ...panel, duration: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Mamoru pacing: 4-6s per punchy panel keeps high viral viewer retention.
              </p>
            </div>

            {/* Quick Link to Whole Story Script */}
            <button
              onClick={() => setActiveTab('full-script')}
              className="w-full p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold flex items-center justify-between text-xs transition-all"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>View Whole Voiceover Story Script ({project.panels.length} Panels)</span>
              </div>
              <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-black">
                FULL SCRIPT
              </span>
            </button>
          </div>
        )}

        {/* TAB: WHOLE STORY VOICEOVER SCRIPT (ACROSS ALL PANELS) */}
        {activeTab === 'full-script' && (
          <div className="space-y-4">
            {/* 1. Script Analytics & Header Card */}
            <div className="p-3.5 bg-zinc-900/90 rounded-2xl border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200 text-xs flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-400" />
                      Whole Voiceover Story Script
                    </span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
                      {project.panels.length} Panels
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Complete compiled comedic commentary and narrator lines for the entire recap
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isExpanded ? 'Compact' : 'Expand'}</span>
                </button>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-800 text-center font-mono">
                <div className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500 font-sans">Total Words</div>
                  <div className="font-bold text-sm text-white">{totalWords}</div>
                </div>

                <div className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500 font-sans">Spoken Time</div>
                  <div className="font-bold text-sm text-amber-400">~{Math.round(totalWords / 2.5)}s</div>
                </div>

                <div className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500 font-sans">Voiced Clips</div>
                  <div className={`font-bold text-sm ${panelsWithVoice === totalCommentaryPanels && totalCommentaryPanels > 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {panelsWithVoice}/{totalCommentaryPanels}
                  </div>
                </div>
              </div>

              {/* Fast Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
                <button
                  onClick={handleCopyFullScript}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                    copiedScript
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  }`}
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{copiedScript ? 'Copied Entire Script!' : 'Copy Script'}</span>
                </button>

                <button
                  onClick={() => handleExportTtsLinesTxt('clean')}
                  className="py-1.5 px-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all"
                  title="Export clean line-by-line script for TTS audio generation"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>TTS Lines (.TXT)</span>
                </button>

                {panelsWithVoice < totalCommentaryPanels && (
                  <button
                    onClick={handleBatchVoiceAllPanels}
                    disabled={isBatchVoicingAll}
                    className="py-1.5 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-600/30"
                    title="Synthesize AI voiceover for all unvoiced panels"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isBatchVoicingAll ? 'Synthesizing...' : 'Voice All'}</span>
                  </button>
                )}
              </div>

              {/* Batch voice progress notification */}
              {batchVoiceStatus && (
                <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-800 text-blue-300 text-[11px] flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span>{batchVoiceStatus}</span>
                </div>
              )}
            </div>

            {/* TTS Voiceover Export Box (Ready for ElevenLabs, Edge-TTS, Kokoro, Whisper) */}
            <div className="p-3.5 bg-gradient-to-br from-blue-950/40 via-indigo-950/30 to-zinc-900/90 rounded-2xl border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">TTS Script Export for Audio Generation</span>
                    <span className="text-[10px] text-zinc-400">Generate voiceover audio with external TTS engines using these text lines</span>
                  </div>
                </div>
                <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold">
                  TTS Ready
                </span>
              </div>

              {/* Format selection */}
              <div className="flex items-center gap-1.5 bg-zinc-950/70 p-1 rounded-xl border border-zinc-800 text-[11px]">
                <button
                  onClick={() => setTtsExportFormat('clean')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center ${
                    ttsExportFormat === 'clean'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="1 line per panel - standard input format for ElevenLabs, Edge-TTS CLI, Kokoro"
                >
                  Line-by-Line (Clean)
                </button>
                <button
                  onClick={() => setTtsExportFormat('numbered')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center ${
                    ttsExportFormat === 'numbered'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="[Panel 1] line format"
                >
                  Numbered Prompts
                </button>
                <button
                  onClick={() => setTtsExportFormat('full')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center ${
                    ttsExportFormat === 'full'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Full teleprompter document with durations"
                >
                  Teleprompter
                </button>
              </div>

              {/* Live Preview Box */}
              <div className="p-2.5 bg-zinc-950/90 rounded-xl border border-zinc-800/80 font-mono text-[10px] text-zinc-300 max-h-24 overflow-y-auto leading-relaxed select-all">
                <div className="text-[9px] text-zinc-500 uppercase font-sans font-bold mb-1">
                  Preview ({ttsExportFormat === 'clean' ? '1 line per panel commentary' : ttsExportFormat === 'numbered' ? 'Numbered panel lines' : 'Teleprompter'})
                </div>
                {getTtsTextContent(ttsExportFormat).slice(0, 300)}
                {getTtsTextContent(ttsExportFormat).length > 300 && '...'}
              </div>

              {/* Action Buttons for TTS */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportTtsLinesTxt(ttsExportFormat)}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-600/25"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .TXT for TTS</span>
                </button>

                <button
                  onClick={() => handleCopyTtsLines(ttsExportFormat)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    copiedTtsLines
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                  }`}
                  title="Copy text lines to clipboard to paste into TTS web tools"
                >
                  {copiedTtsLines ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                  <span>{copiedTtsLines ? 'Copied Lines!' : 'Copy Lines'}</span>
                </button>
              </div>
            </div>

            {/* 2. View Mode Selector (Segmented Flow vs Continuous Teleprompter) */}
            <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setFullScriptMode('segmented')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  fullScriptMode === 'segmented'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Story Flow by Panel</span>
              </button>

              <button
                onClick={() => setFullScriptMode('continuous')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  fullScriptMode === 'continuous'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Continuous Teleprompter</span>
              </button>
            </div>

            {/* 3A. MODE A: SEGMENTED STORY FLOW (PANEL BY PANEL SCRIPT EDITOR) */}
            {fullScriptMode === 'segmented' && (
              <div className="space-y-3">
                {project.panels.map((p, idx) => {
                  const startSec = getPanelStartTime(idx);
                  const endSec = startSec + p.duration;
                  const isCurrent = idx === panelIndex;
                  const wordCount = p.commentary.trim().split(/\s+/).filter(Boolean).length;

                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'bg-[#151525] border-amber-500/60 shadow-lg shadow-black/60 ring-1 ring-amber-500/30'
                          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {/* Panel Card Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {/* Jump to panel button */}
                          <button
                            onClick={() => {
                              onSelectPanel?.(idx);
                              onSeek?.(startSec);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-black transition-all flex items-center gap-1 shrink-0 ${
                              isCurrent
                                ? 'bg-amber-400 text-black'
                                : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/30'
                            }`}
                            title="Jump to this panel in preview and timeline"
                          >
                            <span>#{idx + 1}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                          </button>

                          {/* Mini Thumbnail */}
                          {p.imageUrl && (
                            <img
                              src={p.imageUrl}
                              alt={p.title}
                              className="w-8 h-8 rounded object-cover border border-zinc-700 shrink-0 cursor-pointer"
                              onClick={() => {
                                onSelectPanel?.(idx);
                                onSeek?.(startSec);
                              }}
                            />
                          )}

                          <span className="font-bold text-white text-xs truncate">
                            {p.title}
                          </span>
                        </div>

                        {/* Timing and Audition */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                            {formatPanelTime(startSec)} - {formatPanelTime(endSec)}
                          </span>

                          <button
                            onClick={() => handleAuditionPanelVoice(p)}
                            disabled={!p.commentary}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-40 ${
                              auditioningPanelId === p.id
                                ? 'bg-amber-400 text-black border-amber-300 animate-pulse'
                                : p.audioBase64
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                            }`}
                            title={p.audioBase64 ? 'Play generated AI voice clip' : 'Audition voice using Web Speech'}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{auditioningPanelId === p.id ? 'Playing' : (p.audioBase64 ? 'Voice' : 'Test')}</span>
                          </button>
                        </div>
                      </div>

                      {/* Editable Commentary Line */}
                      <div className="relative">
                        <textarea
                          value={p.commentary}
                          onChange={(e) => {
                            const newCommentary = e.target.value;
                            const updatedPanels = [...project.panels];
                            
                            // Auto recalculate subtitles from commentary words
                            const rawWords = newCommentary.split(/\s+/).filter(Boolean);
                            const wordDur = p.duration / Math.max(1, rawWords.length);
                            const newSubtitles = rawWords.map((w, wIdx) => ({
                              text: w,
                              startTime: Math.round(wIdx * wordDur * 100) / 100,
                              endTime: Math.round((wIdx + 1) * wordDur * 100) / 100,
                              isPunch: /^[A-Z0-9!]{3,}|bro|wait|dead|what|he|him|fr/i.test(w) || w.includes('!') || w.includes('?'),
                            }));

                            updatedPanels[idx] = {
                              ...p,
                              commentary: newCommentary,
                              subtitles: newSubtitles,
                              // If script changed, mark audio for resynthesis
                              audioBase64: newCommentary === p.commentary ? p.audioBase64 : undefined,
                            };
                            onUpdateProject((prev) => ({ ...prev, panels: updatedPanels }));
                          }}
                          rows={2}
                          placeholder={`Commentary for Panel #${idx + 1}...`}
                          className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl p-2.5 text-zinc-200 placeholder:text-zinc-600 font-sans leading-relaxed text-xs resize-none focus:outline-none transition-colors"
                        />

                        {/* Words count indicator */}
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1 px-1">
                          <span>{wordCount} words &bull; ~{Math.round(wordCount / 2.5)}s speech</span>
                          {p.audioBase64 ? (
                            <span className="text-emerald-400 font-semibold">✓ Audio synthesized</span>
                          ) : (
                            <span className="text-amber-400/80">Pending voice synthesis</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3B. MODE B: CONTINUOUS TELEPROMPTER VIEW */}
            {fullScriptMode === 'continuous' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Continuous Story Script (Click any paragraph to jump)</span>
                  <span className="font-mono text-amber-400">{totalWords} words</span>
                </div>

                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 max-h-[65vh] overflow-y-auto space-y-3.5 select-text leading-relaxed">
                  {project.panels.map((p, idx) => {
                    const startSec = getPanelStartTime(idx);
                    const isCurrent = idx === panelIndex;

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          onSelectPanel?.(idx);
                          onSeek?.(startSec);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                          isCurrent
                            ? 'bg-[#151528] border-amber-500/50 text-white'
                            : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono text-zinc-500 group-hover:text-amber-400">
                          <span className="font-bold flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300">
                              #{idx + 1}
                            </span>
                            <span>{p.title}</span>
                          </span>
                          <span>{formatPanelTime(startSec)} ({p.duration.toFixed(1)}s)</span>
                        </div>

                        <p className="text-xs font-sans text-zinc-200 group-hover:text-white leading-relaxed">
                          {p.commentary || <span className="text-zinc-600 italic">(No commentary written)</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PRO VOICEOVER STUDIO (REAL VIDEO EDITOR CONTROLS) */}
        {activeTab === 'voice' && (
          <div className="space-y-4">
            {/* 1. Visual Audio Waveform & Player Card */}
            <div className="p-3.5 bg-zinc-900/90 rounded-2xl border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-200 flex items-center gap-1.5 text-xs">
                  <Headphones className="w-3.5 h-3.5 text-blue-400" />
                  Voiceover Clip Inspector
                </span>

                <div className="flex items-center gap-1.5">
                  {/* Mute Clip Toggle */}
                  <button
                    onClick={() => updateVoiceSettings({ isMuted: !currentVoiceSettings.isMuted })}
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentVoiceSettings.isMuted 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                    title={currentVoiceSettings.isMuted ? 'Clip is Muted' : 'Mute this clip'}
                  >
                    {currentVoiceSettings.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>

                  {/* Audition / Play Test Button */}
                  <button
                    onClick={handleAuditionVoice}
                    disabled={!panel.audioBase64 && !panel.commentary}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                      isPlayingAudition
                        ? 'bg-amber-400 text-black shadow-amber-400/20 animate-pulse'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 disabled:opacity-50'
                    }`}
                  >
                    {isPlayingAudition ? (
                      <>
                        <Square className="w-3 h-3 fill-current" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Audition</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Visual Waveform Display */}
              <div className="h-14 bg-black/70 rounded-xl border border-zinc-800/80 p-2 flex items-center justify-center gap-0.5 overflow-hidden relative">
                {panel.audioBase64 ? (
                  waveformBars.map((peak, idx) => (
                    <div
                      key={idx}
                      className="flex-1 bg-gradient-to-t from-blue-600 to-amber-400 rounded-full transition-all duration-150"
                      style={{
                        height: `${Math.max(12, peak * 100)}%`,
                        opacity: currentVoiceSettings.isMuted ? 0.3 : 0.9,
                      }}
                    />
                  ))
                ) : (
                  <div className="text-[11px] text-zinc-600 flex items-center gap-1.5 italic">
                    <Mic className="w-3.5 h-3.5" />
                    <span>No audio clip generated yet. Choose an option below.</span>
                  </div>
                )}

                {/* Badge overlay */}
                {panel.audioBase64 && (
                  <div className="absolute bottom-1 right-2 flex items-center gap-1 text-[9px] font-mono text-zinc-400 bg-black/80 px-1.5 py-0.5 rounded border border-zinc-800">
                    <span>{currentVoiceSettings.speed.toFixed(1)}x</span>
                    <span>&bull;</span>
                    <span>{currentVoiceSettings.pitch > 0 ? `+${currentVoiceSettings.pitch}` : currentVoiceSettings.pitch}st</span>
                    <span>&bull;</span>
                    <span className="text-amber-400 uppercase">{currentVoiceSettings.eqFilter}</span>
                  </div>
                )}
              </div>

              {panel.audioBase64 && (
                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                  <span className="text-emerald-400 flex items-center gap-1">
                    ✓ High-bitrate audio ready
                  </span>
                  <button
                    onClick={handleClearVoice}
                    className="text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    Clear Audio
                  </button>
                </div>
              )}
            </div>

            {/* 2. Generation & Recording Sources (AI TTS, Mic, File Upload) */}
            <div className="p-3 bg-zinc-900/80 rounded-2xl border border-zinc-800 space-y-3">
              <span className="font-bold text-zinc-300 block text-xs">
                Audio Source & Voice Actors
              </span>

              {/* Persona Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                  Voice Actor Persona
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: 'Puck', label: '🎙️ Puck', desc: 'Energetic Host' },
                    { key: 'Fenrir', label: '⚔️ Fenrir', desc: 'Deep Sarcastic' },
                    { key: 'Zephyr', label: '⚡ Zephyr', desc: 'Fast Hyped Hype' },
                    { key: 'Kore', label: '🌸 Kore', desc: 'Expressive / Shock' },
                    { key: 'Charon', label: '💀 Charon', desc: 'Dark Dramatic' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={() => updateVoiceSettings({ voicePersona: p.key as any })}
                      className={`p-1.5 px-2 rounded-xl text-left border transition-all ${
                        currentVoiceSettings.voicePersona === p.key
                          ? 'border-blue-400 bg-blue-500/15 text-blue-300'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div className="font-bold text-xs">{p.label}</div>
                      <div className="text-[9px] text-zinc-500">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate AI TTS Button */}
              <button
                onClick={handleSynthesizeVoice}
                disabled={isGeneratingTts || !panel.commentary}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 hover:from-blue-500 hover:to-amber-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
              >
                {isGeneratingTts ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing Voiceover...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                    <span>Generate AI Voice for This Panel</span>
                  </>
                )}
              </button>

              {/* Batch Generate for All Panels Button */}
              <button
                onClick={handleGenerateAllVoices}
                disabled={isBatchGenerating || isGeneratingTts}
                className="w-full py-1.5 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 hover:text-white font-bold text-[11px] flex items-center justify-center gap-1.5 border border-zinc-700 transition-all disabled:opacity-50"
              >
                {isBatchGenerating ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    <span>Synthesizing All Clips ({batchProgress})...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3 h-3 text-blue-400" />
                    <span>Batch Synthesize All Panels ({project.panels.filter(p => p.commentary && p.audioBase64).length}/{project.panels.filter(p => p.commentary).length} Ready)</span>
                  </>
                )}
              </button>

              {/* Mic Recording & Audio Upload row */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/80">
                {/* Live Mic Recorder */}
                {isRecordingMic ? (
                  <button
                    onClick={stopRecordingMic}
                    className="py-2 px-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 animate-pulse shadow-md shadow-red-500/30"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop ({recordingSeconds}s)</span>
                  </button>
                ) : (
                  <button
                    onClick={startRecordingMic}
                    className="py-2 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-zinc-700/80"
                    title="Record voiceover directly from microphone"
                  >
                    <Mic className="w-3.5 h-3.5 text-red-400" />
                    <span>Record Mic</span>
                  </button>
                )}

                {/* Upload Audio File */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleUploadAudioFile}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-zinc-700/80"
                    title="Upload custom MP3/WAV audio track"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upload Audio</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Real Video Editor Audio Track Parameters */}
            <div className="p-3.5 bg-zinc-900/90 rounded-2xl border border-zinc-800 space-y-4">
              <span className="font-bold text-zinc-200 flex items-center gap-1.5 text-xs">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Audio Track Mixing Parameters
              </span>

              {/* Pitch Shift (Semitones) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-300 font-medium">Pitch Shift</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {currentVoiceSettings.pitch > 0 ? `+${currentVoiceSettings.pitch}` : currentVoiceSettings.pitch} semitones
                  </span>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={currentVoiceSettings.pitch}
                  onChange={(e) => updateVoiceSettings({ pitch: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[9px] text-zinc-500 mt-1">
                  <span>-12 (Demonic)</span>
                  <span>-3 (Chad Narrator)</span>
                  <span className="text-zinc-400">0 (Normal)</span>
                  <span>+4 (Hype)</span>
                  <span>+12 (Chipmunk)</span>
                </div>
              </div>

              {/* Playback Speed */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-300 font-medium">Speed / Time Stretch</span>
                  <span className="font-mono text-blue-400 font-bold">
                    {currentVoiceSettings.speed.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.8}
                  step={0.05}
                  value={currentVoiceSettings.speed}
                  onChange={(e) => updateVoiceSettings({ speed: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex items-center gap-1 mt-1.5">
                  {[0.8, 1.0, 1.15, 1.25, 1.4].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateVoiceSettings({ speed: s })}
                      className={`flex-1 py-0.5 rounded text-[10px] font-mono border transition-all ${
                        currentVoiceSettings.speed === s
                          ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume Gain Boost */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-300 font-medium">Volume Gain Boost</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {Math.round(currentVoiceSettings.volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2.0}
                  step={0.05}
                  value={currentVoiceSettings.volume}
                  onChange={(e) => updateVoiceSettings({ volume: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Start Delay Offset */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-300 font-medium">Start Delay Offset</span>
                  <span className="font-mono text-amber-400 font-bold">
                    +{currentVoiceSettings.startOffset.toFixed(2)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={Math.max(0.5, panel.duration - 1.0)}
                  step={0.1}
                  value={currentVoiceSettings.startOffset}
                  onChange={(e) => updateVoiceSettings({ startOffset: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
                <p className="text-[9px] text-zinc-500 mt-0.5">
                  Delays speech so the camera pans/zooms first before the punchline begins.
                </p>
              </div>

              {/* Fade In & Fade Out */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-zinc-400">Fade In</span>
                    <span className="font-mono text-zinc-300">{currentVoiceSettings.fadeIn.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0.0}
                    max={0.8}
                    step={0.05}
                    value={currentVoiceSettings.fadeIn}
                    onChange={(e) => updateVoiceSettings({ fadeIn: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-zinc-400">Fade Out</span>
                    <span className="font-mono text-zinc-300">{currentVoiceSettings.fadeOut.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0.0}
                    max={0.8}
                    step={0.05}
                    value={currentVoiceSettings.fadeOut}
                    onChange={(e) => updateVoiceSettings({ fadeOut: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-400"
                  />
                </div>
              </div>

              {/* EQ Filter Presets */}
              <div>
                <label className="text-zinc-300 block mb-1.5 font-medium">Voice EQ & Tone Filter</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: 'clean', label: '🎧 Clean Studio', desc: 'Flat transparent audio' },
                    { key: 'bass-boost', label: '💣 Meme Bass Boost', desc: '+8.5dB punchline 808' },
                    { key: 'phone-radio', label: '📞 Radio / Phone', desc: 'Bandpass tele-filter' },
                    { key: 'warm-broadcast', label: '🎙️ Warm Broadcast', desc: 'Podcast proximity warmth' },
                  ].map((eq) => (
                    <button
                      key={eq.key}
                      onClick={() => updateVoiceSettings({ eqFilter: eq.key as VoiceEqPreset })}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        currentVoiceSettings.eqFilter === eq.key
                          ? 'border-amber-400 bg-amber-500/15 text-amber-300 shadow-sm'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div className="font-bold text-xs">{eq.label}</div>
                      <div className="text-[9px] text-zinc-500">{eq.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CAMERA PAN & ZOOM DIRECTOR */}
        {activeTab === 'camera' && (
          <div className="space-y-4">
            <div>
              <label className="font-bold text-zinc-300 block mb-2">Camera Motion Presets</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'crash-zoom', label: '💥 Crash Zoom', desc: 'Punch-in face' },
                  { key: 'pan-down', label: '📜 Pan Down', desc: 'Webtoon scroll' },
                  { key: 'pan-right', label: '⚔️ Pan Right', desc: 'Action sweep' },
                  { key: 'shake-impact', label: '⚡ Shake Impact', desc: 'Punchline jitter' },
                  { key: 'slow-drift', label: '🎬 Slow Drift', desc: 'Cinematic float' },
                  { key: 'zoom-in', label: '🔍 Zoom In', desc: 'Dramatic tension' },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => applyCameraPreset(preset.key as CameraMotionType)}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      panel.camera.type === preset.key
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300 shadow-sm'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="font-bold text-xs">{preset.label}</div>
                    <div className="text-[10px] text-zinc-500">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Zoom Sliders */}
            <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-400">Start Zoom</span>
                  <span className="font-mono text-amber-400">{panel.camera.start.zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={2.8}
                  step={0.05}
                  value={panel.camera.start.zoom}
                  onChange={(e) => onUpdatePanel({
                    ...panel,
                    camera: {
                      ...panel.camera,
                      start: { ...panel.camera.start, zoom: parseFloat(e.target.value) },
                    },
                  })}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-400">End Zoom</span>
                  <span className="font-mono text-amber-400">{panel.camera.end.zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={2.8}
                  step={0.05}
                  value={panel.camera.end.zoom}
                  onChange={(e) => onUpdatePanel({
                    ...panel,
                    camera: {
                      ...panel.camera,
                      end: { ...panel.camera.end, zoom: parseFloat(e.target.value) },
                    },
                  })}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Shake Intensity */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-red-400" /> Screen Shake Intensity
                  </span>
                  <span className="font-mono text-red-400">
                    {Math.round(panel.camera.shakeIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.0}
                  step={0.05}
                  value={panel.camera.shakeIntensity}
                  onChange={(e) => onUpdatePanel({
                    ...panel,
                    camera: {
                      ...panel.camera,
                      shakeIntensity: parseFloat(e.target.value),
                    },
                  })}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-red-500"
                />
              </div>

              {/* Easing function */}
              <div>
                <label className="text-zinc-400 block mb-1">Camera Easing</label>
                <select
                  value={panel.camera.easing}
                  onChange={(e) => onUpdatePanel({
                    ...panel,
                    camera: {
                      ...panel.camera,
                      easing: e.target.value as any,
                    },
                  })}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-200 text-xs"
                >
                  <option value="punch">Punch (Snappy Mamoru Zoom)</option>
                  <option value="ease-in-out">Smooth Ease In & Out</option>
                  <option value="ease-out">Soft Ease Out</option>
                  <option value="linear">Linear Drift</option>
                </select>
              </div>
            </div>

            {/* Visual Transition Library Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-bold text-zinc-300 block">Visual Transition to Next Panel</label>
                <span className="text-[10px] text-zinc-500">
                  {TRANSITION_LIBRARY.length} Effects Available
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
                {TRANSITION_LIBRARY.map((tr) => {
                  const isCurrent = panel.transition === tr.id;
                  return (
                    <button
                      key={tr.id}
                      onClick={() => {
                        onUpdatePanel({ ...panel, transition: tr.id });
                        if (tr.soundCue) {
                          audioEngine.playSoundEffect(tr.soundCue as any);
                        }
                      }}
                      className={`p-2 rounded-xl text-left border transition-all flex items-center gap-2 ${
                        isCurrent
                          ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-sm ring-1 ring-amber-400/40'
                          : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <span className="text-base flex-shrink-0">{tr.icon}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">{tr.name}</div>
                        <div className="text-[9px] text-zinc-500 capitalize">{tr.category}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SOUND EFFECTS & COMEDY BEATS */}
        {activeTab === 'sfx' && (
          <div className="space-y-4">
            {project.recapMode === 'simple' && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-emerald-300 text-xs">Simple Recap Mode Active</div>
                    <div className="text-[10px] text-zinc-400">Sound effects are muted & disabled for clean, distraction-free storytelling.</div>
                  </div>
                </div>
                <button
                  onClick={() => onUpdateProject(p => ({
                    ...p,
                    panels: p.panels.map(pan => ({ ...pan, soundEffect: 'none' }))
                  }))}
                  className="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 shrink-0 ml-2"
                >
                  Clear All SFX
                </button>
              </div>
            )}

            <div>
              <label className="font-bold text-zinc-300 block mb-2">Comedic Sound Effect Trigger</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'vine-boom', label: '💥 Vine Boom', desc: 'Sub bass roast drop' },
                  { key: 'anime-punch', label: '🥊 Anime Punch', desc: 'Action shockwave hit' },
                  { key: 'record-scratch', label: '💿 Record Scratch', desc: 'Wait what?! freeze' },
                  { key: 'discord-ping', label: '🔔 Discord Ping', desc: 'Meme notification' },
                  { key: 'level-up', label: '🎺 Level Up', desc: 'System OP fanfare' },
                  { key: 'choir-epic', label: '👼 Holy Choir', desc: 'SSS-Rank awakening' },
                  { key: 'crickets', label: '🦗 Crickets', desc: 'Awkward silence' },
                  { key: 'none', label: '🔇 None', desc: 'No sound effect' },
                ].map((sfx) => (
                  <button
                    key={sfx.key}
                    onClick={() => handleSelectSfx(sfx.key as SoundEffectType)}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      panel.soundEffect === sfx.key
                        ? 'border-red-400 bg-red-950/30 text-red-300 shadow-sm'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="font-bold text-xs">{sfx.label}</div>
                    <div className="text-[10px] text-zinc-500">{sfx.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* SFX Trigger Timestamp within panel */}
            {panel.soundEffect !== 'none' && (
              <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-bold">SFX Hit Timing</span>
                  <span className="font-mono text-red-400">{panel.soundEffectTime.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={Math.max(0.5, panel.duration - 0.2)}
                  step={0.1}
                  value={panel.soundEffectTime}
                  onChange={(e) => onUpdatePanel({ ...panel, soundEffectTime: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-red-500"
                />
              </div>
            )}

            {/* Background Music Selector (Project Wide) */}
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2">
              <label className="font-bold text-zinc-300 block">Project Background Music</label>
              <select
                value={project.bgmTrack}
                onChange={(e) => {
                  const track = e.target.value as any;
                  onUpdateProject(p => ({ ...p, bgmTrack: track }));
                  audioEngine.startBgm(track);
                }}
                className="w-full bg-black border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
              >
                <option value="phonk-combat">🔥 Phonk Combat (Hype Cowbell / 808 Trap)</option>
                <option value="funny-lofi">☕ Funny Lo-Fi (Bouncy Comedy Groove)</option>
                <option value="epic-orchestral">👑 Epic Orchestral (Dungeon Boss Choir)</option>
                <option value="synthwave-hype">⚡ Neon Synthwave (Speed Arc)</option>
                <option value="chill-reading">📖 Chill Reading (Gentle Chimes)</option>
                <option value="none">🔇 No BGM</option>
              </select>
            </div>
          </div>
        )}

        {/* TAB 5: KARAOKE SUBTITLES */}
        {activeTab === 'subtitles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-zinc-300">Karaoke Words</label>
              <button
                onClick={handleRegenerateSubtitles}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Auto-Time</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-500">
              Click any word below to toggle [PUNCHLINE] emphasis (highlights in bold neon yellow with pop-in scale).
            </p>

            {/* Word pills */}
            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-2 bg-zinc-950 rounded-xl border border-zinc-800">
              {panel.subtitles.map((w, idx) => (
                <button
                  key={idx}
                  onClick={() => togglePunchWord(idx)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                    w.isPunch
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30 ring-1 ring-amber-300 scale-105'
                      : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
                  }`}
                  title={`${w.startTime.toFixed(1)}s - ${w.endTime.toFixed(1)}s`}
                >
                  {w.text}
                </button>
              ))}
            </div>

            {/* Quick jump to detailed Subtitle Settings tab */}
            <button
              onClick={() => setActiveTab('subtitle-settings')}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold flex items-center justify-between text-xs transition-all"
            >
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-400" />
                <span>Customize Font, Stroke & Shadow Effects</span>
              </div>
              <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-black">
                OPEN
              </span>
            </button>
          </div>
        )}

        {/* TAB 6: DEDICATED SUBTITLE SETTINGS STUDIO */}
        {activeTab === 'subtitle-settings' && (
          <div className="space-y-4">
            {/* Header Status & Fast Actions */}
            <div className="p-3 bg-zinc-900/90 rounded-2xl border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-zinc-200 text-xs flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5 text-amber-400" />
                      Panel Subtitle Styling
                    </span>
                    {panel.subtitleStyle?.isCustom ? (
                      <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-400 px-1.5 py-0.2 rounded font-bold uppercase">
                        Custom
                      </span>
                    ) : (
                      <span className="text-[9px] bg-zinc-800 border border-zinc-700 text-zinc-400 px-1.5 py-0.2 rounded font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {panel.subtitleStyle?.isCustom
                      ? 'Customized specifically for this panel'
                      : 'Inheriting project global subtitle defaults'}
                  </p>
                </div>

                {/* Reset button */}
                {panel.subtitleStyle?.isCustom && (
                  <button
                    onClick={resetSubtitleStyle}
                    title="Reset this panel back to project default subtitle style"
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons: Apply to All Panels */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
                <button
                  onClick={applySubtitleStyleToAll}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                    copiedAllStatus
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 hover:border-zinc-600'
                  }`}
                >
                  {copiedAllStatus ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Applied to All {project.panels.length} Panels!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Apply Style to All Panels</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Interactive Canvas Preview Card */}
            <div className="bg-[#09090f] rounded-2xl border border-zinc-800 p-3.5 space-y-2 relative overflow-hidden shadow-inner">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                <span className="flex items-center gap-1 font-bold text-amber-400/90 tracking-wider">
                  <Eye className="w-3 h-3" />
                  LIVE PREVIEW
                </span>
                <span>Y: {currentSubtitleStyle.positionY}% • {currentSubtitleStyle.fontSize}px</span>
              </div>

              {/* Styled Subtitle Simulation Box */}
              <div
                className="py-6 px-3 min-h-[96px] rounded-xl flex items-center justify-center text-center transition-all relative overflow-hidden"
                style={{
                  backgroundImage: 'radial-gradient(ellipse at center, rgba(30, 27, 75, 0.4) 0%, rgba(9, 9, 15, 0.95) 70%)',
                }}
              >
                {/* Backdrop pill */}
                <div
                  className="px-4 py-2 rounded-2xl inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 transition-all"
                  style={{
                    backgroundColor: currentSubtitleStyle.showBackdrop !== false 
                      ? (currentSubtitleStyle.backdropColor || 'rgba(10, 10, 15, 0.82)')
                      : 'transparent',
                    border: currentSubtitleStyle.showBackdrop !== false 
                      ? `2px solid ${currentSubtitleStyle.highlightColor || '#f59e0b'}` 
                      : 'none',
                  }}
                >
                  {/* Normal words */}
                  <span
                    style={{
                      fontFamily: `'${currentSubtitleStyle.fontFamily || 'Cabinet Grotesk'}', sans-serif`,
                      fontSize: `${Math.max(16, Math.min(26, Math.round((currentSubtitleStyle.fontSize || 54) * 0.38)))}px`,
                      fontWeight: currentSubtitleStyle.fontWeight || '900',
                      fontStyle: currentSubtitleStyle.fontStyle || 'normal',
                      textTransform: currentSubtitleStyle.textTransform || 'uppercase',
                      color: currentSubtitleStyle.textColor || '#FFFFFF',
                      WebkitTextStroke: `${Math.max(1, Math.round((currentSubtitleStyle.strokeWidth || 4) * 0.45))}px ${currentSubtitleStyle.strokeColor || '#000000'}`,
                      paintOrder: 'stroke fill',
                      textShadow: currentSubtitleStyle.shadowPreset === 'none'
                        ? 'none'
                        : `${(currentSubtitleStyle.shadowOffsetX ?? 3) * 0.5}px ${(currentSubtitleStyle.shadowOffsetY ?? 3) * 0.5}px ${(currentSubtitleStyle.shadowBlur ?? 4) * 0.5}px ${currentSubtitleStyle.shadowColor || 'rgba(0,0,0,0.9)'}`,
                      lineHeight: 1.15,
                    }}
                  >
                    WAIT BRO... HE
                  </span>

                  {/* Active Karaoke Highlight Word with Pop */}
                  <span
                    className="inline-block transform scale-110 animate-pulse"
                    style={{
                      fontFamily: `'${currentSubtitleStyle.fontFamily || 'Cabinet Grotesk'}', sans-serif`,
                      fontSize: `${Math.max(18, Math.min(28, Math.round((currentSubtitleStyle.fontSize || 54) * 0.42)))}px`,
                      fontWeight: currentSubtitleStyle.fontWeight || '900',
                      fontStyle: currentSubtitleStyle.fontStyle || 'normal',
                      textTransform: currentSubtitleStyle.textTransform || 'uppercase',
                      color: currentSubtitleStyle.highlightColor || '#FACC15',
                      WebkitTextStroke: `${Math.max(1, Math.round((currentSubtitleStyle.strokeWidth || 4) * 0.45))}px ${currentSubtitleStyle.strokeColor || '#000000'}`,
                      paintOrder: 'stroke fill',
                      textShadow: currentSubtitleStyle.shadowPreset === 'none'
                        ? 'none'
                        : `0px 0px ${(currentSubtitleStyle.shadowBlur || 8) * 0.7}px ${currentSubtitleStyle.highlightColor || '#FACC15'}`,
                      lineHeight: 1.15,
                    }}
                  >
                    REALLY
                  </span>

                  {/* Following words */}
                  <span
                    style={{
                      fontFamily: `'${currentSubtitleStyle.fontFamily || 'Cabinet Grotesk'}', sans-serif`,
                      fontSize: `${Math.max(16, Math.min(26, Math.round((currentSubtitleStyle.fontSize || 54) * 0.38)))}px`,
                      fontWeight: currentSubtitleStyle.fontWeight || '900',
                      fontStyle: currentSubtitleStyle.fontStyle || 'normal',
                      textTransform: currentSubtitleStyle.textTransform || 'uppercase',
                      color: currentSubtitleStyle.textColor || '#FFFFFF',
                      WebkitTextStroke: `${Math.max(1, Math.round((currentSubtitleStyle.strokeWidth || 4) * 0.45))}px ${currentSubtitleStyle.strokeColor || '#000000'}`,
                      paintOrder: 'stroke fill',
                      textShadow: currentSubtitleStyle.shadowPreset === 'none'
                        ? 'none'
                        : `${(currentSubtitleStyle.shadowOffsetX ?? 3) * 0.5}px ${(currentSubtitleStyle.shadowOffsetY ?? 3) * 0.5}px ${(currentSubtitleStyle.shadowBlur ?? 4) * 0.5}px ${currentSubtitleStyle.shadowColor || 'rgba(0,0,0,0.9)'}`,
                      lineHeight: 1.15,
                    }}
                  >
                    DID THAT?!
                  </span>
                </div>
              </div>
            </div>

            {/* 1-Click Comic Preset Packs */}
            <div>
              <span className="font-bold text-zinc-300 block mb-2 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                1-Click Comic Recap Presets
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  {
                    id: 'mamoru-gold',
                    name: '⚡ Mamoru Gold',
                    style: {
                      fontFamily: 'Bangers',
                      fontWeight: '800' as const,
                      textTransform: 'uppercase' as const,
                      textColor: '#FFFFFF',
                      highlightColor: '#FACC15',
                      strokeColor: '#000000',
                      strokeWidth: 8,
                      shadowPreset: 'comic-punch' as SubtitleShadowPreset,
                      shadowColor: '#000000',
                      shadowOffsetX: 4,
                      shadowOffsetY: 4,
                      shadowBlur: 0,
                    },
                  },
                  {
                    id: 'crimson-shonen',
                    name: '🔥 Crimson Shonen',
                    style: {
                      fontFamily: 'Anton',
                      fontWeight: '900' as const,
                      textTransform: 'uppercase' as const,
                      textColor: '#FFFFFF',
                      highlightColor: '#EF4444',
                      strokeColor: '#450A0A',
                      strokeWidth: 8,
                      shadowPreset: 'fire-aura' as SubtitleShadowPreset,
                      shadowColor: '#EF4444',
                      shadowOffsetX: 0,
                      shadowOffsetY: 4,
                      shadowBlur: 14,
                    },
                  },
                  {
                    id: 'system-blue',
                    name: '💎 System Blue',
                    style: {
                      fontFamily: 'Cabinet Grotesk',
                      fontWeight: '900' as const,
                      textTransform: 'uppercase' as const,
                      textColor: '#F8FAFC',
                      highlightColor: '#38BDF8',
                      strokeColor: '#0F172A',
                      strokeWidth: 6,
                      shadowPreset: 'neon-glow' as SubtitleShadowPreset,
                      shadowColor: '#38BDF8',
                      shadowOffsetX: 0,
                      shadowOffsetY: 0,
                      shadowBlur: 16,
                    },
                  },
                  {
                    id: 'acid-lime',
                    name: '🧪 Acid Lime',
                    style: {
                      fontFamily: 'Bangers',
                      fontWeight: '800' as const,
                      textTransform: 'uppercase' as const,
                      textColor: '#FFFFFF',
                      highlightColor: '#A3E635',
                      strokeColor: '#14532D',
                      strokeWidth: 8,
                      shadowPreset: 'comic-punch' as SubtitleShadowPreset,
                      shadowColor: '#000000',
                      shadowOffsetX: 4,
                      shadowOffsetY: 4,
                      shadowBlur: 0,
                    },
                  },
                  {
                    id: 'shadow-monarch',
                    name: '👑 Shadow Monarch',
                    style: {
                      fontFamily: 'Cabinet Grotesk',
                      fontWeight: '900' as const,
                      textTransform: 'uppercase' as const,
                      textColor: '#F1F5F9',
                      highlightColor: '#C084FC',
                      strokeColor: '#3B0764',
                      strokeWidth: 8,
                      shadowPreset: 'neon-glow' as SubtitleShadowPreset,
                      shadowColor: '#A855F7',
                      shadowOffsetX: 0,
                      shadowOffsetY: 0,
                      shadowBlur: 18,
                    },
                  },
                  {
                    id: 'clean-sub',
                    name: '🤍 Clean Sub',
                    style: {
                      fontFamily: 'Montserrat',
                      fontWeight: '700' as const,
                      textTransform: 'none' as const,
                      textColor: '#FFFFFF',
                      highlightColor: '#FDE047',
                      strokeColor: '#000000',
                      strokeWidth: 4,
                      shadowPreset: 'subtle-halo' as SubtitleShadowPreset,
                      shadowColor: 'rgba(0, 0, 0, 0.85)',
                      shadowOffsetX: 0,
                      shadowOffsetY: 2,
                      shadowBlur: 8,
                    },
                  },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => updateSubtitleStyle(preset.style)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-zinc-200 group-hover:text-amber-400 truncate">
                      {preset.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 1. FONT STYLE SECTION */}
            <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3.5">
              <span className="font-bold text-zinc-200 block text-xs flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-amber-400" />
                Font Style & Typography
              </span>

              {/* Font Family Selection */}
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1.5 font-medium">Font Family</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'Bangers', name: 'Bangers', desc: 'Comic Loud' },
                    { id: 'Cabinet Grotesk', name: 'Cabinet', desc: 'Modern Bold' },
                    { id: 'Anton', name: 'Anton', desc: 'Shonen Impact' },
                    { id: 'Montserrat', name: 'Montserrat', desc: 'Cinematic' },
                    { id: 'Plus Jakarta Sans', name: 'Jakarta', desc: 'Tech Crisp' },
                    { id: 'Impact', name: 'Impact', desc: 'Classic Meme' },
                  ].map((font) => (
                    <button
                      key={font.id}
                      onClick={() => updateSubtitleStyle({ fontFamily: font.id })}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        currentSubtitleStyle.fontFamily === font.id
                          ? 'bg-amber-500/10 border-amber-400/80 text-amber-300'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div
                        className="text-xs font-bold truncate"
                        style={{ fontFamily: `'${font.id}', sans-serif` }}
                      >
                        {font.name}
                      </div>
                      <div className="text-[9px] text-zinc-500 truncate">{font.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Weight & Styling */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Weight</label>
                  <select
                    value={currentSubtitleStyle.fontWeight || '900'}
                    onChange={(e) => updateSubtitleStyle({ fontWeight: e.target.value as any })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                  >
                    <option value="700">700 (Bold)</option>
                    <option value="800">800 (Extra Bold)</option>
                    <option value="900">900 (Black)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Slant / Style</label>
                  <button
                    onClick={() => updateSubtitleStyle({
                      fontStyle: currentSubtitleStyle.fontStyle === 'italic' ? 'normal' : 'italic',
                    })}
                    className={`w-full py-1.5 px-2 rounded-lg border text-xs font-bold transition-all ${
                      currentSubtitleStyle.fontStyle === 'italic'
                        ? 'bg-amber-400 text-black border-amber-300'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    {currentSubtitleStyle.fontStyle === 'italic' ? 'Italic <i>' : 'Normal'}
                  </button>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Casing</label>
                  <button
                    onClick={() => updateSubtitleStyle({
                      textTransform: currentSubtitleStyle.textTransform === 'uppercase' ? 'none' : 'uppercase',
                    })}
                    className={`w-full py-1.5 px-2 rounded-lg border text-xs font-bold transition-all ${
                      currentSubtitleStyle.textTransform === 'uppercase'
                        ? 'bg-amber-400 text-black border-amber-300'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    {currentSubtitleStyle.textTransform === 'uppercase' ? 'ALL CAPS' : 'Normal'}
                  </button>
                </div>
              </div>

              {/* Font Size & Position Y */}
              <div className="space-y-2.5 pt-1">
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-zinc-400">Font Size (1080p canvas)</span>
                    <span className="font-mono text-amber-400 font-bold">{currentSubtitleStyle.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={32}
                    max={80}
                    step={2}
                    value={currentSubtitleStyle.fontSize}
                    onChange={(e) => updateSubtitleStyle({ fontSize: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-zinc-400">Vertical Placement (Position Y)</span>
                    <span className="font-mono text-amber-400 font-bold">{currentSubtitleStyle.positionY}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={95}
                    step={1}
                    value={currentSubtitleStyle.positionY}
                    onChange={(e) => updateSubtitleStyle({ positionY: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500 mt-0.5">
                    <span>Center (50%)</span>
                    <span>Lower Third (75-85%)</span>
                    <span>Bottom (95%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. TEXT & HIGHLIGHT COLOR SECTION */}
            <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3.5">
              <span className="font-bold text-zinc-200 block text-xs flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Text Color & Karaoke Highlight
              </span>

              {/* Base Subtitle Text Color */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-zinc-400 font-medium">Base Text Color</label>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full border border-zinc-600 shadow-sm"
                      style={{ backgroundColor: currentSubtitleStyle.textColor || '#FFFFFF' }}
                    />
                    <span className="font-mono text-[10px] text-zinc-300">
                      {currentSubtitleStyle.textColor || '#FFFFFF'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {['#FFFFFF', '#F8FAFC', '#FEF08A', '#FDE047', '#FED7AA', '#FCA5A5', '#A7F3D0'].map((hex) => (
                    <button
                      key={hex}
                      onClick={() => updateSubtitleStyle({ textColor: hex })}
                      className={`w-6 h-6 rounded-lg border transition-all ${
                        currentSubtitleStyle.textColor === hex
                          ? 'border-amber-400 scale-110 shadow-md ring-1 ring-amber-400'
                          : 'border-zinc-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                  <div className="relative ml-auto">
                    <input
                      type="color"
                      value={currentSubtitleStyle.textColor?.startsWith('#') ? currentSubtitleStyle.textColor : '#FFFFFF'}
                      onChange={(e) => updateSubtitleStyle({ textColor: e.target.value })}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 opacity-0 absolute inset-0 z-10"
                    />
                    <div className="w-7 h-7 rounded-lg border border-zinc-700 bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
                      🎨
                    </div>
                  </div>
                </div>
              </div>

              {/* Karaoke Active Highlight Color */}
              <div className="pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-zinc-400 font-medium">
                    Active Karaoke Word (Punch Highlight)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full border border-zinc-600 shadow-sm"
                      style={{ backgroundColor: currentSubtitleStyle.highlightColor || '#FACC15' }}
                    />
                    <span className="font-mono text-[10px] text-zinc-300">
                      {currentSubtitleStyle.highlightColor || '#FACC15'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {['#FACC15', '#38BDF8', '#EF4444', '#4ADE80', '#C084FC', '#FB923C', '#F43F5E'].map((hex) => (
                    <button
                      key={hex}
                      onClick={() => updateSubtitleStyle({ highlightColor: hex })}
                      className={`w-6 h-6 rounded-lg border transition-all ${
                        currentSubtitleStyle.highlightColor === hex
                          ? 'border-amber-400 scale-110 shadow-md ring-1 ring-amber-400'
                          : 'border-zinc-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                  <div className="relative ml-auto">
                    <input
                      type="color"
                      value={currentSubtitleStyle.highlightColor?.startsWith('#') ? currentSubtitleStyle.highlightColor : '#FACC15'}
                      onChange={(e) => updateSubtitleStyle({ highlightColor: e.target.value })}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 opacity-0 absolute inset-0 z-10"
                    />
                    <div className="w-7 h-7 rounded-lg border border-zinc-700 bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
                      🎨
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. STROKE & OUTLINE SECTION */}
            <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3.5">
              <span className="font-bold text-zinc-200 block text-xs flex items-center gap-1.5">
                <Contrast className="w-3.5 h-3.5 text-amber-400" />
                Stroke & Comic Outline
              </span>

              {/* Stroke Width Slider */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-zinc-400">Outline Width</span>
                  <span className="font-mono text-amber-400 font-bold">{currentSubtitleStyle.strokeWidth || 0}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={14}
                  step={1}
                  value={currentSubtitleStyle.strokeWidth ?? 6}
                  onChange={(e) => updateSubtitleStyle({ strokeWidth: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[9px] text-zinc-500 mt-0.5">
                  <span>0px (No Outline)</span>
                  <span>6px (Balanced)</span>
                  <span>14px (Heavy Comic Ink)</span>
                </div>
              </div>

              {/* Stroke Color */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-zinc-400 font-medium">Outline / Stroke Color</label>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full border border-zinc-600 shadow-sm"
                      style={{ backgroundColor: currentSubtitleStyle.strokeColor || '#000000' }}
                    />
                    <span className="font-mono text-[10px] text-zinc-300">
                      {currentSubtitleStyle.strokeColor || '#000000'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {['#000000', '#18181B', '#450A0A', '#1E1B4B', '#14532D', '#FFFFFF'].map((hex) => (
                    <button
                      key={hex}
                      onClick={() => updateSubtitleStyle({ strokeColor: hex })}
                      className={`w-6 h-6 rounded-lg border transition-all ${
                        currentSubtitleStyle.strokeColor === hex
                          ? 'border-amber-400 scale-110 shadow-md ring-1 ring-amber-400'
                          : 'border-zinc-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                  <div className="relative ml-auto">
                    <input
                      type="color"
                      value={currentSubtitleStyle.strokeColor?.startsWith('#') ? currentSubtitleStyle.strokeColor : '#000000'}
                      onChange={(e) => updateSubtitleStyle({ strokeColor: e.target.value })}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 opacity-0 absolute inset-0 z-10"
                    />
                    <div className="w-7 h-7 rounded-lg border border-zinc-700 bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
                      🎨
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. SHADOW & GLOW EFFECTS SECTION */}
            <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3.5">
              <span className="font-bold text-zinc-200 block text-xs flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                Shadow & Glow Effects
              </span>

              {/* Shadow Preset Buttons */}
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1.5 font-medium">Shadow Presets</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'comic-punch', label: 'Comic Punch', color: '#000000', blur: 0, ox: 4, oy: 4 },
                    { id: 'neon-glow', label: 'Neon Glow', color: currentSubtitleStyle.highlightColor || '#38BDF8', blur: 18, ox: 0, oy: 0 },
                    { id: 'deep-drop', label: 'Deep Drop', color: 'rgba(0, 0, 0, 0.9)', blur: 14, ox: 0, oy: 6 },
                    { id: 'fire-aura', label: 'Fire Aura', color: '#EF4444', blur: 14, ox: 0, oy: 4 },
                    { id: 'subtle-halo', label: 'Subtle Halo', color: 'rgba(0, 0, 0, 0.8)', blur: 8, ox: 0, oy: 2 },
                    { id: 'none', label: 'None (Flat)', color: 'transparent', blur: 0, ox: 0, oy: 0 },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => updateSubtitleStyle({
                        shadowPreset: p.id as SubtitleShadowPreset,
                        shadowColor: p.color,
                        shadowBlur: p.blur,
                        shadowOffsetX: p.ox,
                        shadowOffsetY: p.oy,
                      })}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        currentSubtitleStyle.shadowPreset === p.id
                          ? 'bg-amber-500/10 border-amber-400/80 text-amber-300 font-bold'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 text-[11px]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow Fine-tuning sliders */}
              {currentSubtitleStyle.shadowPreset !== 'none' && (
                <div className="space-y-2.5 pt-1">
                  {/* Shadow Color */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] text-zinc-400 font-medium">Shadow / Aura Color</label>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-4 h-4 rounded-full border border-zinc-600 shadow-sm"
                          style={{ backgroundColor: currentSubtitleStyle.shadowColor || '#000000' }}
                        />
                        <span className="font-mono text-[10px] text-zinc-300">
                          {currentSubtitleStyle.shadowColor || '#000000'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {['#000000', 'rgba(0,0,0,0.85)', '#EF4444', '#FACC15', '#38BDF8', '#C084FC'].map((c, i) => (
                        <button
                          key={i}
                          onClick={() => updateSubtitleStyle({ shadowColor: c })}
                          className={`w-6 h-6 rounded-lg border transition-all ${
                            currentSubtitleStyle.shadowColor === c
                              ? 'border-amber-400 scale-110 shadow-md ring-1 ring-amber-400'
                              : 'border-zinc-700 hover:scale-105'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <div className="relative ml-auto">
                        <input
                          type="color"
                          value={currentSubtitleStyle.shadowColor?.startsWith('#') ? currentSubtitleStyle.shadowColor : '#000000'}
                          onChange={(e) => updateSubtitleStyle({ shadowColor: e.target.value })}
                          className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 opacity-0 absolute inset-0 z-10"
                        />
                        <div className="w-7 h-7 rounded-lg border border-zinc-700 bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
                          🎨
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Blur Radius */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-zinc-400">Blur Radius</span>
                      <span className="font-mono text-amber-400 font-bold">{currentSubtitleStyle.shadowBlur ?? 0}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={currentSubtitleStyle.shadowBlur ?? 4}
                      onChange={(e) => updateSubtitleStyle({ shadowBlur: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Offset X & Y */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-zinc-400">Offset X</span>
                        <span className="font-mono text-amber-400 font-bold">{currentSubtitleStyle.shadowOffsetX ?? 0}px</span>
                      </div>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={currentSubtitleStyle.shadowOffsetX ?? 3}
                        onChange={(e) => updateSubtitleStyle({ shadowOffsetX: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-zinc-400">Offset Y</span>
                        <span className="font-mono text-amber-400 font-bold">{currentSubtitleStyle.shadowOffsetY ?? 0}px</span>
                      </div>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={currentSubtitleStyle.shadowOffsetY ?? 3}
                        onChange={(e) => updateSubtitleStyle({ shadowOffsetY: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. BACKDROP PILL BOX SECTION */}
            <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-zinc-200 block text-xs">Comic Backdrop Pill</span>
                  <p className="text-[10px] text-zinc-500">
                    Semi-transparent container behind text for maximum readability
                  </p>
                </div>
                <button
                  onClick={() => updateSubtitleStyle({
                    showBackdrop: currentSubtitleStyle.showBackdrop === false ? true : false,
                  })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    currentSubtitleStyle.showBackdrop !== false
                      ? 'bg-amber-400 text-black'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {currentSubtitleStyle.showBackdrop !== false ? 'Enabled' : 'Hidden'}
                </button>
              </div>

              {currentSubtitleStyle.showBackdrop !== false && (
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Backdrop Tint</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'Dark', val: 'rgba(10, 10, 15, 0.85)' },
                      { label: 'Black', val: 'rgba(0, 0, 0, 0.95)' },
                      { label: 'Purple', val: 'rgba(24, 12, 40, 0.9)' },
                    ].map((b, i) => (
                      <button
                        key={i}
                        onClick={() => updateSubtitleStyle({ backdropColor: b.val })}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                          currentSubtitleStyle.backdropColor === b.val
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
