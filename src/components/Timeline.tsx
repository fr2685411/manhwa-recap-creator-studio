import React, { useState } from 'react';
import { 
  Play, 
  Plus, 
  Trash2, 
  Copy, 
  ArrowLeft, 
  ArrowRight, 
  Clock, 
  Volume2, 
  VolumeX,
  Zap, 
  Sparkles,
  Music,
  Video,
  ChevronDown,
  Layers,
  Wand2,
  Check,
  Mic
} from 'lucide-react';
import { ProjectSettings, Panel, TransitionType, TRANSITION_LIBRARY, TransitionMeta } from '../types/manhwa';
import { audioEngine } from '../services/audioEngine';

interface TimelineProps {
  project: ProjectSettings;
  currentTime: number;
  onSeek: (time: number) => void;
  selectedPanelIndex: number;
  onSelectPanel: (index: number) => void;
  onUpdateProject: (updater: (prev: ProjectSettings) => ProjectSettings) => void;
  onOpenUploadModal: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  onSeek,
  selectedPanelIndex,
  onSelectPanel,
  onUpdateProject,
  onOpenUploadModal,
}) => {
  const totalDuration = project.panels.reduce((sum, p) => sum + p.duration, 0);

  // Active transition popover state (which panel transition is being edited)
  const [activeTransitionPopoverIndex, setActiveTransitionPopoverIndex] = useState<number | null>(null);
  const [transitionCategoryFilter, setTransitionCategoryFilter] = useState<'all' | 'comic' | 'action' | 'cinematic'>('all');

  // Reorder panels
  const movePanel = (index: number, direction: 'left' | 'right') => {
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= project.panels.length) return;

    onUpdateProject((prev) => {
      const copy = [...prev.panels];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return { ...prev, panels: copy };
    });
    onSelectPanel(target);
  };

  // Adjust duration (+/- 0.5s) to tweak natural pacing
  const adjustDuration = (index: number, delta: number) => {
    onUpdateProject((prev) => {
      const copy = [...prev.panels];
      const p = copy[index];
      const newDur = Math.max(1.5, Math.min(20, Math.round((p.duration + delta) * 10) / 10));
      copy[index] = { ...p, duration: newDur };
      return { ...prev, panels: copy };
    });
  };

  // Apply selected transition to specific panel
  const handleSelectTransition = (panelIndex: number, transitionType: TransitionType) => {
    const meta = TRANSITION_LIBRARY.find(t => t.id === transitionType);
    if (meta?.soundCue) {
      audioEngine.playSoundEffect(meta.soundCue as any);
    }

    onUpdateProject((prev) => {
      const copy = [...prev.panels];
      copy[panelIndex] = { ...copy[panelIndex], transition: transitionType };
      return { ...prev, panels: copy };
    });
    setActiveTransitionPopoverIndex(null);
  };

  // Apply selected transition to ALL panels
  const handleApplyTransitionToAll = (transitionType: TransitionType) => {
    onUpdateProject((prev) => {
      const copy = prev.panels.map(p => ({ ...p, transition: transitionType }));
      return { ...prev, panels: copy };
    });
    setActiveTransitionPopoverIndex(null);
  };

  // Delete panel
  const deletePanel = (index: number) => {
    if (project.panels.length <= 1) return;
    onUpdateProject((prev) => {
      const copy = prev.panels.filter((_, i) => i !== index);
      return { ...prev, panels: copy };
    });
    onSelectPanel(Math.max(0, index - 1));
  };

  // Duplicate panel
  const duplicatePanel = (index: number) => {
    onUpdateProject((prev) => {
      const copy = [...prev.panels];
      const original = copy[index];
      const cloned: Panel = {
        ...JSON.parse(JSON.stringify(original)),
        id: 'panel_' + Date.now(),
        title: original.title + ' (Copy)',
      };
      copy.splice(index + 1, 0, cloned);
      return { ...prev, panels: copy };
    });
    onSelectPanel(index + 1);
  };

  // Transition label & icon helper
  const getTransitionMeta = (type: TransitionType) => {
    return TRANSITION_LIBRARY.find(t => t.id === type) || TRANSITION_LIBRARY[0];
  };

  // Compute start time for each panel
  let accumulatedTime = 0;
  const panelStartTimes = project.panels.map((p) => {
    const start = accumulatedTime;
    accumulatedTime += p.duration;
    return start;
  });

  const filteredTransitions = transitionCategoryFilter === 'all'
    ? TRANSITION_LIBRARY
    : TRANSITION_LIBRARY.filter(t => t.category === transitionCategoryFilter);

  return (
    <div className="h-60 bg-[#0c0c12] border-t border-zinc-800 flex flex-col select-none overflow-hidden relative">
      {/* Timeline Header bar */}
      <div className="h-9 px-4 bg-[#101018] border-b border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-4">
          <span className="font-bold text-zinc-300 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-amber-400" />
            RECAP TIMELINE
          </span>
          <span className="text-[11px] text-zinc-500">
            {project.panels.length} Panels &bull; Total: {totalDuration.toFixed(1)}s &bull; Auto-Paced
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenUploadModal}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold flex items-center gap-1 transition-all"
          >
            <Plus className="w-3 h-3 text-amber-400" />
            <span>Add Panel</span>
          </button>
        </div>
      </div>

      {/* Timeline Scroll Area */}
      <div className="flex-1 overflow-x-auto p-3 flex flex-col gap-2 relative">
        {/* Playhead indicator bar (tracks current time) */}
        <div 
          className="absolute top-0 bottom-0 z-30 pointer-events-none transition-all duration-75 flex flex-col items-center"
          style={{
            left: `${totalDuration > 0 ? (currentTime / totalDuration) * 92 + 4 : 4}%`,
          }}
        >
          <div className="w-3 h-3 bg-amber-400 rotate-45 -mt-1 shadow-md shadow-amber-500" />
          <div className="w-0.5 flex-1 bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
        </div>

        {/* Track 1: Panels Cards Strip with Interstitial Transition Nodes */}
        <div className="flex items-center gap-1.5 min-w-max pb-1">
          {project.panels.map((p, index) => {
            const isSelected = index === selectedPanelIndex;
            const startTime = panelStartTimes[index];
            const currentTransition = getTransitionMeta(p.transition);
            const isLastPanel = index === project.panels.length - 1;

            return (
              <React.Fragment key={p.id}>
                {/* Panel Card */}
                <div
                  onClick={() => {
                    onSelectPanel(index);
                    onSeek(startTime);
                  }}
                  className={`group relative rounded-xl border transition-all cursor-pointer flex flex-col overflow-hidden ${
                    isSelected
                      ? 'border-amber-400 bg-amber-950/20 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/50'
                      : 'border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                  }`}
                  style={{
                    width: `${Math.max(160, p.duration * 38)}px`,
                    minWidth: '150px',
                    height: '115px',
                  }}
                >
                  {/* Panel Card Header */}
                  <div className="p-1.5 px-2 flex items-center justify-between bg-black/40 border-b border-zinc-800/60">
                    <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[95px]">
                      #{index + 1} {p.title}
                    </span>

                    {/* Actions on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePanel(index, 'left');
                        }}
                        disabled={index === 0}
                        title="Move Left"
                        className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-20"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePanel(index, 'right');
                        }}
                        disabled={index === project.panels.length - 1}
                        title="Move Right"
                        className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-20"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePanel(index);
                        }}
                        title="Duplicate"
                        className="p-0.5 text-zinc-400 hover:text-amber-400"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {project.panels.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePanel(index);
                          }}
                          title="Delete Panel"
                          className="p-0.5 text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Panel Thumbnail Preview & Camera Type */}
                  <div className="flex-1 p-1.5 flex items-center gap-2 overflow-hidden">
                    <div className="w-11 h-14 rounded-lg overflow-hidden bg-black/80 border border-zinc-800 flex-shrink-0 relative">
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-[9px] font-bold text-amber-400 border border-zinc-700">
                          {p.camera.type.toUpperCase()}
                        </span>
                        {p.soundEffect !== 'none' && (
                          <span className="px-1 py-0.2 rounded bg-red-950/80 text-[9px] font-black text-red-300 border border-red-800/60 flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5 text-red-400" />
                            {p.soundEffect.replace('-', ' ')}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-zinc-400 italic line-clamp-1 mt-0.5">
                        "{p.commentary}"
                      </p>
                    </div>
                  </div>

                  {/* Card Footer: Duration adjuster */}
                  <div className="px-2 py-1 bg-black/60 border-t border-zinc-800/60 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1 font-mono text-zinc-400">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      <span>{p.duration.toFixed(1)}s</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustDuration(index, -0.5);
                        }}
                        className="w-3.5 h-3.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-[9px]"
                      >
                        -
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustDuration(index, 0.5);
                        }}
                        className="w-3.5 h-3.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-[9px]"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTransitionPopoverIndex(activeTransitionPopoverIndex === index ? null : index);
                      }}
                      className="text-[10px] text-amber-400/90 font-bold hover:text-amber-300 flex items-center gap-0.5 bg-zinc-800/60 px-1.5 py-0.5 rounded border border-zinc-700/60"
                      title="Click to change visual transition effect"
                    >
                      <span>{currentTransition.icon}</span>
                      <span>{currentTransition.name.split(' ')[0]}</span>
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>

                {/* INTERACTIVE TRANSITION CONNECTOR NODE IN TIMELINE */}
                {!isLastPanel && (
                  <div className="relative flex items-center justify-center px-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTransitionPopoverIndex(activeTransitionPopoverIndex === index ? null : index);
                      }}
                      title={`Transition to Panel #${index + 2}: ${currentTransition.name} (Click to change)`}
                      className={`h-9 px-2 rounded-lg border flex items-center gap-1 text-[10px] font-extrabold transition-all shadow-md transform hover:scale-105 ${
                        activeTransitionPopoverIndex === index
                          ? 'bg-amber-400 text-black border-amber-300 ring-2 ring-amber-400/50 scale-105'
                          : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border-zinc-700/80 hover:border-amber-400/60'
                      }`}
                    >
                      <span className="text-sm">{currentTransition.icon}</span>
                      <span className="hidden sm:inline">{currentTransition.name}</span>
                      <ChevronDown className="w-3 h-3 opacity-70" />
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Track 2: Professional Audio & Voiceover Timeline Track */}
        <div className="flex items-center gap-1.5 min-w-max h-10 bg-zinc-950/90 rounded-xl px-2 border border-zinc-800/80">
          <div className="w-24 text-[10px] font-bold text-zinc-400 flex items-center gap-1.5 flex-shrink-0">
            <Mic className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-['Cabinet_Grotesk'] tracking-wide">A1 VO/SFX</span>
          </div>

          <div className="flex items-center gap-1.5 flex-1">
            {project.panels.map((p, index) => {
              const isSelected = index === selectedPanelIndex;
              const hasVoice = Boolean(p.audioBase64);
              const vs = p.voiceSettings;
              const isMuted = vs?.isMuted;
              const cardWidth = Math.max(160, p.duration * 38);
              const startOffset = vs?.startOffset || 0;
              const offsetPx = Math.min(cardWidth * 0.4, (startOffset / p.duration) * cardWidth);

              return (
                <div
                  key={'audio_' + p.id}
                  onClick={() => {
                    onSelectPanel(index);
                    onSeek(panelStartTimes[index]);
                  }}
                  style={{ width: `${cardWidth}px` }}
                  className={`h-8 rounded-lg border transition-all cursor-pointer flex items-center px-2 relative overflow-hidden group ${
                    isSelected
                      ? 'border-blue-400 bg-blue-950/40 shadow-sm ring-1 ring-blue-400/40'
                      : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700 hover:bg-zinc-850'
                  }`}
                  title={`Panel #${index + 1} Audio: ${p.commentary}`}
                >
                  {/* Start delay offset indicator strip */}
                  {offsetPx > 0 && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-zinc-900/90 border-r border-dashed border-zinc-700/80 z-10 flex items-center justify-center pointer-events-none"
                      style={{ width: `${offsetPx}px` }}
                    >
                      <span className="text-[8px] font-mono text-zinc-500 truncate px-0.5">+{startOffset.toFixed(1)}s</span>
                    </div>
                  )}

                  {/* Waveform graphic or placeholder */}
                  {hasVoice ? (
                    <div 
                      className="flex-1 flex items-center gap-0.5 h-full py-1 overflow-hidden"
                      style={{ paddingLeft: `${offsetPx}px` }}
                    >
                      {/* Stylized waveform bars */}
                      {Array.from({ length: 18 }).map((_, barIdx) => {
                        const h = 20 + Math.sin(barIdx * 1.3 + index) * 50 + (barIdx % 3) * 15;
                        return (
                          <div
                            key={barIdx}
                            className={`w-1 rounded-full transition-all ${
                              isMuted 
                                ? 'bg-zinc-700' 
                                : isSelected 
                                ? 'bg-gradient-to-t from-blue-500 to-amber-300' 
                                : 'bg-blue-400/80'
                            }`}
                            style={{ height: `${Math.max(15, Math.min(100, h))}%` }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-1 text-[10px] text-zinc-500 truncate">
                      <Volume2 className="w-3 h-3 text-zinc-600" />
                      <span className="truncate italic">{p.commentary ? p.commentary.slice(0, 24) + '...' : 'No audio'}</span>
                    </div>
                  )}

                  {/* Audio Badges (Speed, Pitch, EQ, Mute) */}
                  <div className="flex items-center gap-1 z-20 flex-shrink-0 ml-1">
                    {hasVoice && (
                      <>
                        {vs && vs.speed !== 1.0 && (
                          <span className="px-1 py-0.2 rounded bg-blue-900/80 text-[8px] font-mono text-blue-200 border border-blue-700/60">
                            {vs.speed.toFixed(1)}x
                          </span>
                        )}
                        {vs && vs.pitch !== 0 && (
                          <span className="px-1 py-0.2 rounded bg-amber-900/80 text-[8px] font-mono text-amber-200 border border-amber-700/60">
                            {vs.pitch > 0 ? `+${vs.pitch}` : vs.pitch}st
                          </span>
                        )}
                        {vs && vs.eqFilter && vs.eqFilter !== 'clean' && (
                          <span className="px-1 py-0.2 rounded bg-purple-900/80 text-[8px] font-mono text-purple-200 border border-purple-700/60 uppercase">
                            {vs.eqFilter === 'bass-boost' ? '808' : vs.eqFilter === 'phone-radio' ? 'TEL' : 'WARM'}
                          </span>
                        )}
                        {isMuted ? (
                          <VolumeX className="w-3 h-3 text-red-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TRANSITION LIBRARY QUICK-PICKER POPOVER MODAL */}
      {activeTransitionPopoverIndex !== null && (
        <div 
          className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveTransitionPopoverIndex(null)}
        >
          <div 
            className="bg-[#12121e] border border-zinc-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Header */}
            <div className="p-3.5 px-5 bg-[#161626] border-b border-zinc-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-sm font-['Cabinet_Grotesk']">
                    VISUAL TRANSITION LIBRARY
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-black border border-amber-500/30">
                    PANEL #{activeTransitionPopoverIndex + 1} &rarr; #{activeTransitionPopoverIndex + 2}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Select a manga visual effect to transition between these two panels
                </p>
              </div>

              <button
                onClick={() => setActiveTransitionPopoverIndex(null)}
                className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex border-b border-zinc-800 bg-[#0e0e18] text-xs font-semibold px-4 pt-2 gap-2">
              {[
                { id: 'all', label: 'All Effects (10)' },
                { id: 'comic', label: '📖 Comic & Manga' },
                { id: 'action', label: '⚡ Combat & Anime' },
                { id: 'cinematic', label: '🎬 Cinematic' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTransitionCategoryFilter(tab.id as any)}
                  className={`pb-2 px-2.5 border-b-2 font-bold transition-all ${
                    transitionCategoryFilter === tab.id
                      ? 'border-amber-400 text-amber-300'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Transitions Grid */}
            <div className="p-4 grid grid-cols-2 gap-2.5 overflow-y-auto max-h-72">
              {filteredTransitions.map((tr) => {
                const isCurrent = project.panels[activeTransitionPopoverIndex]?.transition === tr.id;

                return (
                  <button
                    key={tr.id}
                    onClick={() => handleSelectTransition(activeTransitionPopoverIndex, tr.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 group ${
                      isCurrent
                        ? 'border-amber-400 bg-amber-500/15 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/40'
                        : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-black/60 border border-zinc-700/60 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
                      {tr.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-white text-xs">{tr.name}</span>
                        {isCurrent && (
                          <span className="text-amber-400 text-[10px] font-bold">Active</span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {tr.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Popover Footer: Apply to All */}
            <div className="p-3 px-5 bg-[#141422] border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500 text-[11px]">
                Tip: Comic Page Turn & Speed Lines match MamoruManhwa recaps best
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const currentType = project.panels[activeTransitionPopoverIndex]?.transition || 'page-turn';
                    handleApplyTransitionToAll(currentType);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Apply Effect to All Panels</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
