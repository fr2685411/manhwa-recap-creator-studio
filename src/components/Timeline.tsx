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
  Mic,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Gauge,
  X
} from 'lucide-react';
import { ProjectSettings, Panel, TransitionType, TRANSITION_LIBRARY, TransitionMeta, SoundEffectType } from '../types/manhwa';
import { audioEngine } from '../services/audioEngine';

interface TimelineProps {
  project: ProjectSettings;
  currentTime: number;
  onSeek: (time: number) => void;
  selectedPanelIndex: number;
  onSelectPanel: (index: number) => void;
  selectedPanelIndices?: number[];
  onSelectPanelIndices?: (indices: number[]) => void;
  onUpdateProject: (updater: (prev: ProjectSettings) => ProjectSettings) => void;
  onOpenUploadModal: () => void;
  onOpenBatchModal?: (initialSelectedIndices?: number[]) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  onSeek,
  selectedPanelIndex,
  onSelectPanel,
  selectedPanelIndices,
  onSelectPanelIndices,
  onUpdateProject,
  onOpenUploadModal,
  onOpenBatchModal,
}) => {
  const totalDuration = project.panels.reduce((sum, p) => sum + p.duration, 0);

  // Multi-selection state (uses prop if controlled, otherwise internal state)
  const [localMultiIndices, setLocalMultiIndices] = useState<number[]>([selectedPanelIndex]);
  const activeSelectedIndices = selectedPanelIndices ?? localMultiIndices;

  const setMultiIndices = (indices: number[]) => {
    if (onSelectPanelIndices) {
      onSelectPanelIndices(indices);
    } else {
      setLocalMultiIndices(indices);
    }
  };

  const togglePanelInMulti = (index: number) => {
    if (activeSelectedIndices.includes(index)) {
      const next = activeSelectedIndices.filter(i => i !== index);
      setMultiIndices(next.length > 0 ? next : [index]);
    } else {
      setMultiIndices([...activeSelectedIndices, index]);
    }
  };

  const selectAllPanels = () => {
    setMultiIndices(project.panels.map((_, i) => i));
  };

  const clearMultiSelection = () => {
    setMultiIndices([selectedPanelIndex]);
  };

  const handleCardClick = (e: React.MouseEvent, index: number, startTime: number) => {
    if (e.shiftKey) {
      const start = Math.min(selectedPanelIndex, index);
      const end = Math.max(selectedPanelIndex, index);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setMultiIndices(Array.from(new Set([...activeSelectedIndices, ...range])));
    } else if (e.ctrlKey || e.metaKey) {
      togglePanelInMulti(index);
    } else {
      onSelectPanel(index);
      setMultiIndices([index]);
      onSeek(startTime);
    }
  };

  // Active transition and SFX popover states
  const [activeTransitionPopoverIndex, setActiveTransitionPopoverIndex] = useState<number | null>(null);
  const [activeSfxPopoverIndex, setActiveSfxPopoverIndex] = useState<number | null>(null);
  const [transitionCategoryFilter, setTransitionCategoryFilter] = useState<'all' | 'comic' | 'action' | 'cinematic'>('all');
  const [isPacingToolsOpen, setIsPacingToolsOpen] = useState(false);

  // Sound Effect Library Options
  const SFX_OPTIONS: { id: SoundEffectType; name: string; icon: string; desc: string }[] = [
    { id: 'vine-boom', name: 'Vine Boom', icon: '💥', desc: 'Dramatic bass drop for comedy reveals' },
    { id: 'anime-punch', name: 'Anime Punch', icon: '🥊', desc: 'Heavy impact blow for combat moments' },
    { id: 'discord-ping', name: 'Discord Ping', icon: '🔔', desc: 'System window pop notification' },
    { id: 'record-scratch', name: 'Record Scratch', icon: '💿', desc: 'Freeze frame comedic record stop' },
    { id: 'level-up', name: 'Level Up', icon: '🌟', desc: 'Satisfying stat increase chime' },
    { id: 'choir-epic', name: 'Epic Choir', icon: '🏛️', desc: 'Angelic choir for godly moments' },
    { id: 'crickets', name: 'Crickets Chirp', icon: '🦗', desc: 'Awkward silence / failed roast gag' },
    { id: 'none', name: 'None (Remove SFX)', icon: '🚫', desc: 'Remove sound effect from this panel' },
  ];

  // Insert a new panel at specific position (Add element)
  const insertBlankPanel = (afterIndex: number) => {
    onUpdateProject((prev) => {
      const copy = [...prev.panels];
      const prevPanel = copy[afterIndex] || copy[0];
      const newPanel: Panel = {
        id: 'panel_' + Date.now(),
        title: `Scene #${afterIndex + 2}`,
        imageUrl: prevPanel?.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
        duration: 4.5,
        commentary: 'The chapter continues with escalating tension.',
        camera: {
          type: 'slow-drift',
          start: { x: 0.5, y: 0.35, zoom: 1.1 },
          end: { x: 0.5, y: 0.65, zoom: 1.25 },
          shakeIntensity: 0,
          easing: 'ease-in-out',
        },
        transition: 'fade',
        soundEffect: 'none',
        soundEffectTime: 0.5,
        subtitles: [],
      };
      copy.splice(afterIndex + 1, 0, newPanel);
      return { ...prev, panels: copy };
    });
    onSelectPanel(afterIndex + 1);
  };

  // Scale all panel durations proportionally (Video Pacing & Duration Control)
  const scaleAllDurations = (speedMultiplier: number) => {
    onUpdateProject((prev) => {
      const updatedPanels = prev.panels.map((p) => {
        const newDur = Math.max(1.2, Math.min(25, Math.round((p.duration / speedMultiplier) * 10) / 10));
        return {
          ...p,
          duration: newDur,
          soundEffectTime: Math.min(newDur * 0.9, p.soundEffectTime ? Math.round((p.soundEffectTime / speedMultiplier) * 10) / 10 : 0.5),
        };
      });
      return {
        ...prev,
        pacingMultiplier: 1.0, // Durations are baked directly into panel durations!
        panels: updatedPanels,
      };
    });
  };

  // Set project pacing multiplier (for dynamic playback & export pacing)
  const setPacingMultiplier = (speed: number) => {
    onUpdateProject((prev) => ({
      ...prev,
      pacingMultiplier: speed,
    }));
  };

  // Add / Change / Remove Sound Effect on panel
  const handleUpdatePanelSoundEffect = (panelIndex: number, sfx: SoundEffectType) => {
    if (sfx !== 'none') {
      audioEngine.playSoundEffect(sfx as any);
    }
    onUpdateProject((prev) => {
      const copy = [...prev.panels];
      copy[panelIndex] = { ...copy[panelIndex], soundEffect: sfx };
      return { ...prev, panels: copy };
    });
    setActiveSfxPopoverIndex(null);
  };

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

  const currentPacing = project.pacingMultiplier || 1.0;
  const effectivePacedDuration = totalDuration / currentPacing;

  return (
    <div className="h-64 bg-[#0c0c12] border-t border-zinc-800 flex flex-col select-none overflow-hidden relative">
      {/* Timeline Header bar */}
      <div className="h-10 px-4 bg-[#101018] border-b border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400 gap-3">
        <div className="flex items-center gap-3">
          <span className="font-bold text-zinc-300 flex items-center gap-1.5 shrink-0">
            <Video className="w-3.5 h-3.5 text-amber-400" />
            TIMELINE
          </span>
          <span className="text-[11px] text-zinc-500 hidden sm:inline shrink-0">
            {project.panels.length} Panels &bull; Total: <strong className="text-zinc-300 font-mono">{effectivePacedDuration.toFixed(1)}s</strong> {currentPacing !== 1.0 && <span className="text-amber-400 font-mono">({currentPacing.toFixed(2)}x)</span>}
          </span>

          {/* Multi-Selection Batch Bar */}
          {activeSelectedIndices.length > 1 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg animate-in fade-in shrink-0">
              <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                <CheckSquare className="w-3 h-3 text-amber-400" />
                {activeSelectedIndices.length} Selected
              </span>
              <button
                onClick={() => onOpenBatchModal?.(activeSelectedIndices)}
                className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-black font-black text-[10px] flex items-center gap-1 shadow-sm transition-all"
              >
                <Layers className="w-2.5 h-2.5" />
                <span>Batch Adjust</span>
              </button>
              <button
                onClick={selectAllPanels}
                className="text-[10px] text-zinc-400 hover:text-white underline decoration-zinc-600"
              >
                All
              </button>
              <button
                onClick={clearMultiSelection}
                className="text-[10px] text-zinc-400 hover:text-white"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Video Pacing & Duration Speed Controller */}
        <div className="flex items-center gap-1.5 bg-black/60 border border-zinc-800 rounded-xl px-2 py-0.5">
          <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1 shrink-0">
            <Gauge className="w-3 h-3 text-amber-400" />
            <span className="hidden md:inline">PACING:</span>
          </span>

          {/* Preset speed toggles */}
          <div className="flex items-center gap-0.5">
            {[
              { spd: 0.8, icon: '🐢', label: 'Slow & Detailed' },
              { spd: 1.0, icon: '⚖️', label: 'Standard' },
              { spd: 1.25, icon: '⚡', label: 'Fast-Paced' },
              { spd: 1.5, icon: '🚀', label: 'Rush' },
            ].map((p) => {
              const isActive = Math.abs(currentPacing - p.spd) < 0.05;
              return (
                <button
                  key={p.spd}
                  onClick={() => setPacingMultiplier(p.spd)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                    isActive
                      ? 'bg-amber-400 text-black shadow-sm font-black'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                  title={`${p.label} (${p.spd}x pacing)`}
                >
                  <span>{p.icon}</span>
                  <span>{p.spd}x</span>
                </button>
              );
            })}
          </div>

          {/* Quick Action: Scale All Durations by chosen multiplier */}
          <button
            onClick={() => {
              if (window.confirm(`Scale all panel durations by ${currentPacing}x? This directly alters panel seconds on the timeline.`)) {
                scaleAllDurations(currentPacing);
              }
            }}
            className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 border border-zinc-700/60 transition-all flex items-center gap-1"
            title="Permanently bake current pacing multiplier into all panel durations"
          >
            <span>⚡ Apply to Seconds</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Batch Adjustment Tool Button */}
          {onOpenBatchModal && (
            <button
              onClick={() => onOpenBatchModal(activeSelectedIndices.length > 0 ? activeSelectedIndices : [selectedPanelIndex])}
              className="px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700/90 text-amber-300 border border-amber-500/30 hover:border-amber-400/50 text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
              title="Open Batch Adjustment Tool to configure Pan & Zoom, Subtitle Styles, and Transitions across multiple panels"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Batch Adjust {activeSelectedIndices.length > 1 ? `(${activeSelectedIndices.length})` : ''}</span>
            </button>
          )}

          <button
            onClick={onOpenUploadModal}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold flex items-center gap-1 transition-all shrink-0"
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
            const isPrimarySelected = index === selectedPanelIndex;
            const isMultiSelected = activeSelectedIndices.includes(index);
            const startTime = panelStartTimes[index];
            const currentTransition = getTransitionMeta(p.transition);
            const isLastPanel = index === project.panels.length - 1;

            return (
              <React.Fragment key={p.id}>
                {/* Panel Card */}
                <div
                  onClick={(e) => handleCardClick(e, index, startTime)}
                  className={`group relative rounded-xl border transition-all cursor-pointer flex flex-col overflow-hidden ${
                    isPrimarySelected
                      ? 'border-amber-400 bg-amber-950/20 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/50'
                      : isMultiSelected
                      ? 'border-amber-500/70 bg-amber-950/15 ring-1 ring-amber-500/30'
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
                    <div className="flex items-center gap-1 min-w-0">
                      {/* Checkbox for batch multi-selection */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePanelInMulti(index);
                        }}
                        className="text-zinc-400 hover:text-amber-400 transition-colors"
                        title="Toggle selection for batch adjustment"
                      >
                        {isMultiSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400" />
                        )}
                      </button>

                      <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[80px]">
                        #{index + 1} {p.title}
                      </span>
                    </div>

                    {/* Card Actions: Move, Duplicate, Remove (always visible and prominent) */}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePanel(index, 'left');
                        }}
                        disabled={index === 0}
                        title={index === 0 ? "First panel" : "Move Panel Left (⬅️)"}
                        className="p-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-20 disabled:hover:bg-zinc-800/80 transition-all"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePanel(index, 'right');
                        }}
                        disabled={index === project.panels.length - 1}
                        title={index === project.panels.length - 1 ? "Last panel" : "Move Panel Right (➡️)"}
                        className="p-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-20 disabled:hover:bg-zinc-800/80 transition-all"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePanel(index);
                        }}
                        title="Duplicate Panel"
                        className="p-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-amber-400 transition-all"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {project.panels.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePanel(index);
                          }}
                          title="Remove Panel (🗑️)"
                          className="p-1 rounded bg-zinc-800/80 hover:bg-red-950/80 text-zinc-400 hover:text-red-400 border border-transparent hover:border-red-800/50 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Panel Thumbnail Preview & Camera Type & Sound Effect */}
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

                        {/* Add / Move / Remove Sound Effect Tag */}
                        {p.soundEffect !== 'none' ? (
                          <div className="flex items-center gap-1 bg-red-950/80 text-[9px] font-black text-red-300 border border-red-800/60 rounded px-1.5 py-0.5 shadow-sm">
                            <Zap className="w-2.5 h-2.5 text-red-400 shrink-0" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSfxPopoverIndex(index);
                              }}
                              className="hover:underline truncate max-w-[65px]"
                              title="Click to change sound effect"
                            >
                              {p.soundEffect.replace('-', ' ')}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdatePanelSoundEffect(index, 'none');
                              }}
                              className="hover:text-white text-red-400 font-bold px-0.5 ml-0.5"
                              title="Remove Sound Effect"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSfxPopoverIndex(index);
                            }}
                            className="px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-[9px] font-bold text-zinc-400 hover:text-amber-300 border border-zinc-700/60 flex items-center gap-0.5 transition-all"
                            title="Add Sound Effect to this panel"
                          >
                            <Plus className="w-2.5 h-2.5 text-amber-400" />
                            <span>SFX</span>
                          </button>
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

                {/* INTERACTIVE TRANSITION CONNECTOR NODE & INSERT PANEL BUTTON */}
                <div className="relative flex flex-col items-center justify-center px-1 gap-1">
                  {/* Quick Insert Panel Here Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      insertBlankPanel(index);
                    }}
                    title={`+ Insert new panel after #${index + 1}`}
                    className="w-5 h-5 rounded-full bg-zinc-800/90 hover:bg-amber-400 text-zinc-400 hover:text-black border border-zinc-700 hover:border-amber-300 flex items-center justify-center transition-all shadow text-xs font-bold"
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  {!isLastPanel && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTransitionPopoverIndex(activeTransitionPopoverIndex === index ? null : index);
                      }}
                      title={`Transition to Panel #${index + 2}: ${currentTransition.name} (Click to change)`}
                      className={`h-8 px-2 rounded-lg border flex items-center gap-1 text-[10px] font-extrabold transition-all shadow-md transform hover:scale-105 ${
                        activeTransitionPopoverIndex === index
                          ? 'bg-amber-400 text-black border-amber-300 ring-2 ring-amber-400/50 scale-105'
                          : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border-zinc-700/80 hover:border-amber-400/60'
                      }`}
                    >
                      <span className="text-xs">{currentTransition.icon}</span>
                      <span className="hidden sm:inline">{currentTransition.name.split(' ')[0]}</span>
                      <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                    </button>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          {/* Quick Append Panel Card at end of timeline */}
          <div
            onClick={() => insertBlankPanel(project.panels.length - 1)}
            className="rounded-xl border-2 border-dashed border-zinc-700/80 hover:border-amber-400 bg-zinc-900/30 hover:bg-amber-950/20 text-zinc-400 hover:text-amber-300 cursor-pointer flex flex-col items-center justify-center gap-1 transition-all p-3 flex-shrink-0"
            style={{ width: '130px', height: '115px' }}
            title="Click to add another panel to end of recap"
          >
            <div className="w-8 h-8 rounded-full bg-zinc-800 group-hover:bg-amber-400/20 flex items-center justify-center text-amber-400 border border-zinc-700">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold mt-1 text-zinc-300">Add Panel</span>
            <span className="text-[9px] text-zinc-500">#{project.panels.length + 1}</span>
          </div>
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

      {/* SFX QUICK-PICKER POPOVER MODAL */}
      {activeSfxPopoverIndex !== null && (
        <div 
          className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveSfxPopoverIndex(null)}
        >
          <div 
            className="bg-[#12121e] border border-zinc-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Header */}
            <div className="p-3.5 px-5 bg-[#161626] border-b border-zinc-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-sm font-['Cabinet_Grotesk'] flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    SOUND EFFECT SELECTOR
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-black border border-amber-500/30">
                    PANEL #{activeSfxPopoverIndex + 1}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Pick a sound effect or remove it from this panel
                </p>
              </div>

              <button
                onClick={() => setActiveSfxPopoverIndex(null)}
                className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>

            {/* SFX Grid */}
            <div className="p-4 grid grid-cols-2 gap-2 overflow-y-auto max-h-72">
              {SFX_OPTIONS.map((sfx) => {
                const isCurrent = project.panels[activeSfxPopoverIndex]?.soundEffect === sfx.id;

                return (
                  <button
                    key={sfx.id}
                    onClick={() => handleUpdatePanelSoundEffect(activeSfxPopoverIndex, sfx.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 group ${
                      isCurrent
                        ? 'border-amber-400 bg-amber-500/15 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/40'
                        : sfx.id === 'none'
                        ? 'border-zinc-800/80 bg-red-950/20 hover:border-red-700/60'
                        : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-black/60 border border-zinc-700/60 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                      {sfx.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-white text-xs">{sfx.name}</span>
                        {isCurrent && (
                          <span className="text-amber-400 text-[9px] font-bold">Active</span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                        {sfx.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Popover Footer */}
            <div className="p-3 px-5 bg-[#141422] border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500 text-[11px]">
                Clicking an SFX plays audio preview immediately
              </span>
              <button
                onClick={() => handleUpdatePanelSoundEffect(activeSfxPopoverIndex, 'none')}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
              >
                Clear SFX
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
