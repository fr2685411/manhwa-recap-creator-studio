import React from 'react';
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
  HelpCircle
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
  onOpenHelpModal: () => void;
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
  onOpenHelpModal,
}) => {
  const handleSelectSample = (sampleKey: string) => {
    const sample = SAMPLE_PROJECTS[sampleKey];
    if (sample) {
      onUpdateProject(() => JSON.parse(JSON.stringify(sample)));
    }
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
        </div>
      </div>

      {/* Center Controls: Aspect Ratio */}
      <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
        <button
          onClick={() => onUpdateProject(p => ({ ...p, aspectRatio: '9:16' }))}
          title="9:16 Vertical (YouTube Shorts / TikTok / Reels - Mamoru Standard)"
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
          onClick={() => onUpdateProject(p => ({ ...p, aspectRatio: '16:9' }))}
          title="16:9 Landscape (YouTube Video Essay)"
          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
            project.aspectRatio === '16:9'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>16:9</span>
        </button>
        <button
          onClick={() => onUpdateProject(p => ({ ...p, aspectRatio: '1:1' }))}
          title="1:1 Square"
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
