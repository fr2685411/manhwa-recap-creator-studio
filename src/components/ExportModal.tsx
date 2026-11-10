import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Film, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Play,
  Settings,
  Cpu,
  Monitor,
  Smartphone,
  Square,
  Mic,
  Volume2,
  FileText,
  Gauge,
  Columns,
  Activity
} from 'lucide-react';
import { ProjectSettings, Panel } from '../types/manhwa';
import { videoRenderer } from '../services/videoRenderer';
import { requestTtsAudio } from '../services/geminiClient';
import { audioEngine } from '../services/audioEngine';

interface ExportModalProps {
  project: ProjectSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateProject?: React.Dispatch<React.SetStateAction<ProjectSettings>>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  project,
  isOpen,
  onClose,
  onUpdateProject,
}) => {
  const [resolution, setResolution] = useState<'1080x1920' | '1920x1080' | '1080x1080'>(
    project.aspectRatio === '9:16' ? '1080x1920' : (project.aspectRatio === '1:1' ? '1080x1080' : '1920x1080')
  );
  const [bitrate, setBitrate] = useState<number>(14_000_000); // 14 Mbps
  const [fps, setFps] = useState<number>(30);
  const [pacingSpeed, setPacingSpeed] = useState<number>(project.pacingMultiplier || 1.0);
  
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isMergingAudio, setIsMergingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setError(null);
    setProgress(0);
    setRenderedBlob(null);
    setVideoUrl(null);

    try {
      // 1. Ensure all panels with commentary have AI voiceover synthesized
      const panelsNeedingVoice = project.panels.filter(p => p.commentary && !p.audioBase64);
      let projectToExport = project;

      if (panelsNeedingVoice.length > 0) {
        setStatusMessage(`Synthesizing AI voiceovers for ${panelsNeedingVoice.length} panel(s)...`);
        const updatedPanels = [...project.panels];
        let synthesizedCount = 0;

        for (let i = 0; i < updatedPanels.length; i++) {
          const p = updatedPanels[i];
          if (p.commentary && !p.audioBase64) {
            synthesizedCount++;
            setStatusMessage(`🎙️ Synthesizing AI voice for panel ${i + 1}/${updatedPanels.length} (${synthesizedCount}/${panelsNeedingVoice.length})...`);
            try {
              const persona = p.voiceSettings?.voicePersona || project.voicePersona || 'Puck';
              const style = p.voiceSettings?.stylePrompt || 'Energetic comedic YouTube manhwa recap narrator breaking the fourth wall';
              const audioBase64 = await requestTtsAudio(p.commentary, persona, style);
              updatedPanels[i] = { ...p, audioBase64 };
            } catch (err) {
              console.warn(`Voice synthesis failed for panel ${i + 1} during export:`, err);
            }
          }
        }

        projectToExport = { ...project, panels: updatedPanels };
        if (onUpdateProject) {
          onUpdateProject(projectToExport);
        }
      }

      const targetAspectRatio: '16:9' | '9:16' | '1:1' = 
        resolution === '1920x1080' ? '16:9' : (resolution === '1080x1920' ? '9:16' : '1:1');

      const blob = await videoRenderer.exportVideo1080p(projectToExport, {
        fps,
        bitrate,
        resolution,
        aspectRatio: targetAspectRatio,
        pacingMultiplier: pacingSpeed,
        onProgress: (p, cur, tot) => {
          setProgress(p);
        },
        onStatus: (msg) => {
          setStatusMessage(msg);
        },
      });

      const url = URL.createObjectURL(blob);
      setRenderedBlob(blob);
      setVideoUrl(url);
      setStatusMessage('Export Complete!');
    } catch (err: any) {
      console.error('Export failed:', err);
      setError(err.message || 'Export failed. Please check canvas or media recorder support.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    const cleanTitle = (project.title || 'Manhwa_Recap').replace(/[^a-zA-Z0-9_-]/g, '_');
    const aspectTag = resolution === '1920x1080' ? '16x9_Landscape' : (resolution === '1080x1920' ? '9x16_Shorts' : '1x1_Square');
    a.download = `${cleanTitle}_1080p_${aspectTag}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export all voiceover script lines into a single clean text file (.txt)
  const handleExportTtsScript = () => {
    let content = `========================================================\n`;
    content += `MANHWA RECAP STORY SCRIPT: ${project.title || 'Chapter Recap'}\n`;
    content += `Recap Mode: ${project.recapMode || 'standard'} | Total Panels: ${project.panels.length}\n`;
    const totalDurationSec = project.panels.reduce((sum, p) => sum + p.duration, 0) / (project.pacingMultiplier || 1.0);
    content += `Estimated Video Duration: ~${totalDurationSec.toFixed(1)}s (at ${(project.pacingMultiplier || 1.0).toFixed(2)}x speed)\n`;
    content += `========================================================\n\n`;

    content += `--- TIMED SCENE-BY-SCENE BREAKDOWN ---\n\n`;
    let accumulated = 0;
    project.panels.forEach((p, idx) => {
      const dur = p.duration / (project.pacingMultiplier || 1.0);
      const startMin = Math.floor(accumulated / 60);
      const startSec = Math.floor(accumulated % 60).toString().padStart(2, '0');
      accumulated += dur;
      const endMin = Math.floor(accumulated / 60);
      const endSec = Math.floor(accumulated % 60).toString().padStart(2, '0');

      content += `[PANEL ${idx + 1}] (${startMin}:${startSec} - ${endMin}:${endSec} | ${dur.toFixed(1)}s) - "${p.title}"\n`;
      if (p.detectedDialogue) {
        content += `DIALOGUE IN IMAGE: ${p.detectedDialogue}\n`;
      }
      content += `VOICEOVER NARRATION:\n"${p.commentary || ''}"\n\n`;
    });

    content += `\n========================================================\n`;
    content += `CLEAN TTS LINES ONLY (FOR ELEVENLABS / EDGE-TTS / KOKORO):\n`;
    content += `========================================================\n`;
    project.panels.forEach((p) => {
      if (p.commentary && p.commentary.trim()) {
        content += `${p.commentary.trim()}\n`;
      }
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project.title || 'manhwa_recap').replace(/[^a-zA-Z0-9_-]/g, '_')}_all_voice_lines.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export merged audio (.wav) combining all synthesized panel voiceovers into one file
  const handleExportMergedAudio = async () => {
    const panelsWithVoice = project.panels.filter(p => p.audioBase64);
    if (panelsWithVoice.length === 0) {
      alert('No synthesized voice clips found. You can synthesize voices in the Voice tab or during video export.');
      return;
    }

    setIsMergingAudio(true);
    try {
      const blob = await audioEngine.exportMergedVoiceoverWav(project.panels);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(project.title || 'manhwa_recap').replace(/[^a-zA-Z0-9_-]/g, '_')}_merged_voiceover.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.warn('Audio export failed:', err);
      alert('Could not merge audio: ' + err.message);
    } finally {
      setIsMergingAudio(false);
    }
  };

  const totalDuration = videoRenderer.getTotalDuration(project);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#10101a] border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#141422] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white font-['Cabinet_Grotesk'] tracking-wide">
                EXPORT 1080P VIDEO
              </h2>
              <p className="text-xs text-zinc-400">
                High-bitrate studio rendering with animated camera & mixed audio
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExporting}
            className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {!videoUrl && !isExporting && (
            <div className="space-y-5 text-xs">
              {/* Resolution and Aspect Ratio selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-zinc-300">Video Aspect Ratio & Resolution</label>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">
                    {resolution === '1920x1080' ? '16:9 Widescreen (1920x1080)' : (resolution === '1080x1920' ? '9:16 Vertical (1080x1920)' : '1:1 Square (1080x1080)')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => setResolution('1920x1080')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      resolution === '1920x1080'
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300 shadow-sm ring-1 ring-amber-400/40'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Monitor className="w-4 h-4 text-amber-400" />
                      <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                        16:9
                      </span>
                    </div>
                    <div className="font-extrabold text-xs text-white">1920x1080</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 font-medium">YouTube Landscape</div>
                  </button>

                  <button
                    onClick={() => setResolution('1080x1920')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      resolution === '1080x1920'
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300 shadow-sm ring-1 ring-amber-400/40'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Smartphone className="w-4 h-4 text-blue-400" />
                      <span className="text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                        9:16
                      </span>
                    </div>
                    <div className="font-extrabold text-xs text-white">1080x1920</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 font-medium">Shorts / TikTok</div>
                  </button>

                  <button
                    onClick={() => setResolution('1080x1080')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      resolution === '1080x1080'
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300 shadow-sm ring-1 ring-amber-400/40'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Square className="w-4 h-4 text-purple-400" />
                      <span className="text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                        1:1
                      </span>
                    </div>
                    <div className="font-extrabold text-xs text-white">1080x1080</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 font-medium">Square Feed</div>
                  </button>
                </div>

                {/* Aspect ratio feedback note */}
                <div className="mt-2 p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-[11px]">
                  <div className="text-zinc-300 flex items-center gap-1.5">
                    {resolution === '1920x1080' ? (
                      <>
                        <Monitor className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Exporting in <strong>16:9 Landscape</strong> (1920×1080 Full HD) for YouTube videos.</span>
                      </>
                    ) : resolution === '1080x1920' ? (
                      <>
                        <Smartphone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>Exporting in <strong>9:16 Vertical</strong> (1080×1920 Full HD) for YouTube Shorts & TikTok.</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>Exporting in <strong>1:1 Square</strong> (1080×1080) for Instagram & Community posts.</span>
                      </>
                    )}
                  </div>

                  {resolution === '1920x1080' && project.aspectRatio !== '16:9' && onUpdateProject && (
                    <button
                      onClick={() => onUpdateProject(p => ({ ...p, aspectRatio: '16:9' }))}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] transition-all ml-2 shrink-0 border border-amber-500/40"
                    >
                      Sync Editor to 16:9
                    </button>
                  )}
                </div>

                {/* 16:9 Slideshow Layout: Double Slide vs Single Focus */}
                {resolution === '1920x1080' && onUpdateProject && (
                  <div className="mt-3 p-3 rounded-xl bg-blue-950/25 border border-blue-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Columns className="w-3.5 h-3.5 text-blue-400" />
                        16:9 Slideshow Layout
                      </span>
                      <span className="text-[10px] text-blue-300 font-mono font-bold">
                        {project.widescreenLayout === 'double-slide' || (!project.widescreenLayout && project.recapMode === 'simple')
                          ? 'Double Slide (Active)'
                          : 'Single Focus'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateProject(p => ({ ...p, widescreenLayout: 'double-slide' }))}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                          project.widescreenLayout === 'double-slide' || (!project.widescreenLayout && project.recapMode === 'simple')
                            ? 'border-blue-400 bg-blue-500/20 text-white shadow-sm ring-1 ring-blue-400/40'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          <span>🎞️ Double Slide</span>
                          <span className="text-[9px] bg-blue-500/30 text-blue-200 px-1 py-0.2 rounded font-mono">Popular</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">2 side-by-side cards with blurred ambient backdrop</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateProject(p => ({ ...p, widescreenLayout: 'single' }))}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                          project.widescreenLayout === 'single'
                            ? 'border-amber-400 bg-amber-500/20 text-white shadow-sm ring-1 ring-amber-400/40'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="font-bold">🔲 Single Focus</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">1 centered panel in widescreen frame</div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Pacing & Duration Speed Control (Slow-Paced & Detailed vs. Fast-Paced) */}
              <div className="p-4 bg-zinc-900/90 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="font-bold text-zinc-200">Video Pacing & Duration Speed</span>
                      <p className="text-[10px] text-zinc-400">Control export duration and speech pacing</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500 line-through">
                      Raw: {totalDuration.toFixed(1)}s
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/40 font-mono shadow-sm">
                      Export: {(totalDuration / pacingSpeed).toFixed(1)}s ({pacingSpeed.toFixed(2)}x)
                    </span>
                  </div>
                </div>

                {/* Preset Speed Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { speed: 0.8, icon: '🐢', name: 'Slow & Detailed', desc: 'Extended pauses & deep story' },
                    { speed: 1.0, icon: '⚖️', name: 'Standard (1.0x)', desc: 'Natural timeline duration' },
                    { speed: 1.25, icon: '⚡', name: 'Fast-Paced', desc: 'Snappy high-retention recap' },
                    { speed: 1.5, icon: '🚀', name: 'Viral Rush', desc: 'Rapid-fire shorts pace' },
                  ].map((preset) => (
                    <button
                      key={preset.speed}
                      type="button"
                      onClick={() => setPacingSpeed(preset.speed)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        Math.abs(pacingSpeed - preset.speed) < 0.02
                          ? 'border-amber-400 bg-amber-500/20 text-white ring-1 ring-amber-400/50 shadow-md'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-0.5">
                        <span>{preset.icon}</span>
                        <span className="truncate">{preset.name}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 leading-tight">
                        {preset.desc}
                      </div>
                      <div className="mt-1.5 text-[10px] font-mono text-amber-400 font-bold">
                        ~{(totalDuration / preset.speed).toFixed(1)}s
                      </div>
                    </button>
                  ))}
                </div>

                {/* Fine-tuning slider */}
                <div className="pt-1 flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-zinc-800/80">
                  <span className="text-[11px] text-zinc-400 font-semibold shrink-0">Custom Multiplier:</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={pacingSpeed}
                    onChange={(e) => setPacingSpeed(parseFloat(e.target.value))}
                    className="flex-1 accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-amber-300 w-14 text-right">
                    {pacingSpeed.toFixed(2)}x
                  </span>
                </div>
              </div>

              {/* Bitrate selection */}
              <div>
                <label className="font-bold text-zinc-300 block mb-2">Encoding Bitrate (High-Bitrate Support)</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { val: 14_000_000, label: '14 Mbps (High)', desc: 'Recommended 1080p' },
                    { val: 20_000_000, label: '20 Mbps (Ultra)', desc: 'Crisp comic lines' },
                    { val: 8_000_000, label: '8 Mbps (Standard)', desc: 'Fast smaller file' },
                  ].map((br) => (
                    <button
                      key={br.val}
                      onClick={() => setBitrate(br.val)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        bitrate === br.val
                          ? 'border-amber-400 bg-amber-500/15 text-amber-300 shadow-sm'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-bold text-xs">{br.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{br.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* FPS & Audio stats */}
              <div className="p-3.5 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-300">Framerate & Audio Sync</div>
                  <div className="text-[11px] text-zinc-500">
                    Duration: {totalDuration.toFixed(1)}s &bull; BGM: {project.bgmTrack.toUpperCase()} &bull; Subtitles Embedded
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setFps(30)}
                    className={`px-2.5 py-1 rounded text-xs font-bold ${
                      fps === 30 ? 'bg-amber-500 text-black' : 'text-zinc-400'
                    }`}
                  >
                    30 FPS
                  </button>
                  <button
                    onClick={() => setFps(60)}
                    className={`px-2.5 py-1 rounded text-xs font-bold ${
                      fps === 60 ? 'bg-amber-500 text-black' : 'text-zinc-400'
                    }`}
                  >
                    60 FPS
                  </button>
                </div>
              </div>

              {/* Voiceover Track Status */}
              <div className="p-3.5 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-zinc-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-blue-400" />
                    <span>AI Voiceover Track ({project.voicePersona || 'Puck'})</span>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    project.panels.filter(p => p.commentary && p.audioBase64).length === project.panels.filter(p => p.commentary).length
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {project.panels.filter(p => p.commentary && p.audioBase64).length}/{project.panels.filter(p => p.commentary).length} clips ready
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  {project.panels.filter(p => p.commentary && p.audioBase64).length === project.panels.filter(p => p.commentary).length ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      All voiceover clips synthesized and ready for 1080p audio mix
                    </span>
                  ) : (
                    <span className="text-amber-400/90 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Missing clips will be auto-synthesized in Gemini AI voice upon clicking Export
                    </span>
                  )}
                </div>
              </div>

              {/* Voiceover Script & Audio Export Box (All in One File) */}
              <div className="p-3 bg-gradient-to-r from-blue-950/30 via-indigo-950/20 to-purple-950/20 border border-blue-900/50 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>Consolidated Voice Lines & Audio (All-in-One)</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {project.panels.length} panels
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Export all panel narrator lines into a single text file (with timestamps and clean TTS lines), or download the combined voiceover audio as one WAV file.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportTtsScript}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-bold border border-blue-500/40 flex items-center justify-center gap-1.5 transition-all text-[11px]"
                    title="Download all voiceover lines consolidated into one .txt file for ElevenLabs, Edge-TTS, or Kokoro"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>Export All Voice Lines (.txt)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportMergedAudio}
                    disabled={isMergingAudio || project.panels.filter(p => p.audioBase64).length === 0}
                    className="py-1.5 px-3 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 disabled:opacity-40 text-purple-300 font-bold border border-purple-500/40 flex items-center justify-center gap-1.5 transition-all text-[11px]"
                    title="Download all synthesized voice clips merged into a single WAV audio file"
                  >
                    {isMergingAudio ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    <span>{isMergingAudio ? 'Merging...' : 'Export Merged Audio (.wav)'}</span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Active Rendering Progress State */}
          {isExporting && (
            <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-zinc-800 border-t-amber-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center font-black text-xs text-amber-400">
                  {progress}%
                </div>
              </div>

              <div>
                <h3 className="font-bold text-white text-sm">Rendering 1080p Manhwa Video</h3>
                <p className="text-xs text-zinc-400 mt-1 font-mono">{statusMessage}</p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-md h-2 bg-zinc-800 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Completed State with Video Preview */}
          {videoUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>1080p Video Successfully Rendered!</span>
              </div>

              <div className="rounded-xl overflow-hidden bg-black border border-zinc-800 flex items-center justify-center max-h-72">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  className="max-h-72 w-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
                <span>Resolution: {resolution}</span>
                <span>Bitrate: {(bitrate / 1_000_000).toFixed(0)} Mbps</span>
                <span>Size: {renderedBlob ? (renderedBlob.size / (1024 * 1024)).toFixed(1) + ' MB' : ''}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#141422] border-t border-zinc-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
          >
            {videoUrl ? 'Close' : 'Cancel'}
          </button>

          {!videoUrl ? (
            <button
              onClick={handleStartExport}
              disabled={isExporting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Encoding Video...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  <span>Start 1080p Render</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleDownload}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download 1080p File</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
