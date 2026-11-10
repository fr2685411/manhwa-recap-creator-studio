import { 
  Sparkles, 
  Download, 
  Smartphone, 
  Monitor, 
  Square, 
  Plus, 
  Flame, 
  Cpu, 
  Cloud, 
  Server, 
  BookOpen, 
  HelpCircle, 
  Layers, 
  FileText, 
  Zap,
  Columns,
  Activity
} from 'lucide-react';
import { ProjectSettings } from '../types/manhwa';
import { SAMPLE_PROJECTS } from '../data/sampleChapters';
import { AiEngineType } from '../services/localAiEngine';

interface HeaderProps {
  project: ProjectSettings;
  activeEngine: AiEngineType;
  onUpdateProject: (updater: (prev: ProjectSettings) => ProjectSettings) => void;
  onOpenAutoRecapModal: () => void;
  onOpenLocalModelModal: () => void;
  onOpenScriptModal: () => void;
  onOpenExportModal: () => void;
  onOpenUploadModal: () => void;
  onOpenBatchModal?: () => void;
  onOpenHelpModal: () => void;
  onOpenFullScript?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  activeEngine,
  onUpdateProject,
  onOpenAutoRecapModal,
  onOpenLocalModelModal,
  onOpenScriptModal,
  onOpenExportModal,
  onOpenUploadModal,
  onOpenBatchModal,
  onOpenHelpModal,
  onOpenFullScript,
}) => {
  const handleSelectSample = (sampleKey: string) => {
    const sample = SAMPLE_PROJECTS[sampleKey];
    if (sample) {
      onUpdateProject(() => JSON.parse(JSON.stringify(sample)));
    }
  };

  const handleQuickExportVoiceLinesTxt = () => {
    let content = `========================================================\n`;
    content += `MANHWA RECAP STORY SCRIPT: ${project.title || 'Chapter Recap'}\n`;
    content += `Recap Mode: ${project.recapMode || 'standard'} | Panels: ${project.panels.length}\n`;
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
    content += `CLEAN TTS LINES (FOR ELEVENLABS / EDGE-TTS / KOKORO):\n`;
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

  return (
    <header className="h-16 bg-[#0f0f15] border-b border-zinc-800/80 px-4 md:px-6 flex items-center justify-between z-20 select-none">
      {/* Brand & Mamoru Tag */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-red-500 to-amber-300 p-0.5 shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-[#12121a] rounded-[10px] flex items-center justify-center font-black text-amber-400 text-lg">
              M
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-base font-['Cabinet_Grotesk']">
                MANHWA<span className="text-amber-400">RECAP</span>
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" />
                MAMORU 4TH-WALL
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium truncate max-w-[200px] md:max-w-xs">
              {project.title}
            </p>
          </div>
        </div>

        {/* Sample Chapters Dropdown */}
        <div className="hidden lg:flex items-center gap-1 ml-4 border-l border-zinc-800 pl-4">
          <span className="text-xs text-zinc-500 font-medium flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" /> Story:
          </span>
          <button
            onClick={() => handleSelectSample('janitor-hunter')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all font-semibold ${
              project.id === 'janitor-hunter'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            F-Rank Cleaner
          </button>
          <button
            onClick={() => handleSelectSample('necromancer-bed')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all font-semibold ${
              project.id === 'necromancer-bed'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            Bed Necromancer
          </button>

          {onOpenFullScript && (
            <button
              onClick={onOpenFullScript}
              className="ml-2 px-2.5 py-1 text-xs rounded-lg transition-all font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-1.5 border border-zinc-700/60 bg-zinc-900/60"
              title="Open Full Voiceover Story Script (All Panels)"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Full Script</span>
            </button>
          )}

          <button
            onClick={handleQuickExportVoiceLinesTxt}
            className="px-2.5 py-1 text-xs rounded-lg transition-all font-semibold text-blue-300 hover:text-blue-100 hover:bg-blue-600/20 flex items-center gap-1.5 border border-blue-500/30 bg-blue-950/40"
            title="Export all voice lines and dialogue to a single .txt file"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export Lines (.txt)</span>
          </button>
        </div>
      </div>

        {/* Mode Selector: Simple Recap vs Mamoru Dynamic */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => {
              onUpdateProject((p) => ({
                ...p,
                recapMode: 'simple',
                aspectRatio: '16:9',
                panels: p.panels.map((panel) => ({
                  ...panel,
                  soundEffect: 'none',
                  transition: 'fade',
                  camera: {
                    ...panel.camera,
                    type: panel.camera.type === 'crash-zoom' || panel.camera.type === 'shake-impact' ? 'slow-drift' : panel.camera.type,
                    shakeIntensity: 0,
                    easing: 'ease-in-out',
                  },
                })),
              }));
            }}
            title="Simple Recap Mode: No sound effects, clean fade transitions, 16:9 widescreen, clean TTS text"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              project.recapMode === 'simple' || !project.recapMode
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simple Recap</span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-mono font-bold">
              Clean
            </span>
          </button>

          <button
            onClick={() => {
              onUpdateProject((p) => ({
                ...p,
                recapMode: 'meme-dynamic',
              }));
            }}
            title="Meme / Dynamic Recap Mode: Comedic punchline SFX, speed lines, crash zooms, and impact shakes"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              project.recapMode === 'meme-dynamic'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Meme / Dynamic</span>
          </button>
        </div>

        {/* Center Controls: Aspect Ratio (16:9 Widescreen Default) */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => onUpdateProject((p) => ({ ...p, aspectRatio: '16:9' }))}
            title="16:9 Widescreen (Default YouTube / Landscape Video)"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              project.aspectRatio === '16:9'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>16:9 (Default)</span>
          </button>
          <button
            onClick={() => onUpdateProject((p) => ({ ...p, aspectRatio: '9:16' }))}
            title="9:16 Vertical (YouTube Shorts / TikTok / Reels)"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              project.aspectRatio === '9:16'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>9:16 Shorts</span>
          </button>
          <button
            onClick={() => onUpdateProject((p) => ({ ...p, aspectRatio: '1:1' }))}
            title="1:1 Square (Instagram / Community)"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              project.aspectRatio === '1:1'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>1:1</span>
          </button>
        </div>

        {/* 16:9 Double Slide Slideshow Toggle (Dual Panels like YouTube Manhwa Recaps) */}
        {project.aspectRatio === '16:9' && (
          <div className="hidden sm:flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => onUpdateProject((p) => ({ ...p, widescreenLayout: 'double-slide' }))}
              title="Double Slide Mode: 2 panels side-by-side with blurred ambient background (like popular YouTube Manhwa recaps)"
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                project.widescreenLayout === 'double-slide' || (!project.widescreenLayout && project.recapMode === 'simple')
                  ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5 text-blue-400" />
              <span>Double Slide (16:9)</span>
            </button>
            <button
              onClick={() => onUpdateProject((p) => ({ ...p, widescreenLayout: 'single' }))}
              title="Single Focus Mode: 1 panel centered in widescreen"
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                project.widescreenLayout === 'single'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Single Focus</span>
            </button>
          </div>
        )}

        {/* Global Camera Shake Toggle Button */}
        <button
          onClick={() => onUpdateProject((p) => ({ ...p, disableShakeEffect: !p.disableShakeEffect }))}
          title={
            project.disableShakeEffect
              ? 'Camera shake is currently DISABLED (Clean smooth panning). Click to enable.'
              : 'Camera shake is currently ENABLED. Click to remove all camera shaking across the video.'
          }
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
            project.disableShakeEffect
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
              : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <Activity className={`w-3.5 h-3.5 ${project.disableShakeEffect ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>{project.disableShakeEffect ? 'Shake: OFF (Smooth)' : 'Shake: ON'}</span>
        </button>

      {/* Right Actions: Local Model, Auto-Recap, AI Script, Add Panel, 1080p Export */}
      <div className="flex items-center gap-2">
        {/* Local AI Engine Selector Button */}
        <button
          onClick={onOpenLocalModelModal}
          title="Configure Local Models (WebGPU In-Browser or Ollama Localhost)"
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeEngine === 'in-browser-model'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
              : activeEngine === 'local-ollama'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:text-white'
          }`}
        >
          {activeEngine === 'in-browser-model' ? (
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          ) : activeEngine === 'local-ollama' ? (
            <Server className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
          )}
          <span className="hidden md:inline">
            {activeEngine === 'in-browser-model'
              ? 'Local Model (WebGPU)'
              : activeEngine === 'local-ollama'
              ? 'Local Ollama'
              : 'Cloud Gemini'}
          </span>
        </button>

        <button
          onClick={onOpenAutoRecapModal}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:from-amber-400 hover:to-orange-300 text-black text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/25 transition-all transform active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 fill-black stroke-black animate-spin" />
          <span>Auto-Recap (PDF / Images)</span>
        </button>

        <button
          onClick={onOpenScriptModal}
          className="px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">AI Script</span>
        </button>

        {onOpenBatchModal && (
          <button
            onClick={onOpenBatchModal}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Batch Adjust Pan-and-Zoom & Subtitle Styles"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Batch Adjust</span>
          </button>
        )}

        <button
          onClick={onOpenUploadModal}
          className="px-2.5 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Add Panels</span>
        </button>

        <button
          onClick={onOpenExportModal}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Export 1080p</span>
        </button>

        <button
          onClick={onOpenHelpModal}
          title="Mamoru Manhwa Tips & Shortcuts"
          className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all ml-1"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
