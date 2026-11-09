import React, { useState, useMemo } from 'react';
import { 
  X, 
  Layers, 
  Camera, 
  Palette, 
  Check, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Eye, 
  SlidersHorizontal, 
  Zap, 
  Clock, 
  Filter, 
  RotateCcw,
  Sun,
  Contrast,
  Flame,
  ArrowRight,
  Maximize2,
  Film
} from 'lucide-react';
import { 
  ProjectSettings, 
  Panel, 
  CameraMotionType, 
  CameraSettings, 
  SubtitleStyle, 
  SubtitleShadowPreset, 
  TRANSITION_LIBRARY, 
  TransitionType, 
  SoundEffectType 
} from '../types/manhwa';

interface BatchAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectSettings;
  initialSelectedIndices?: number[];
  onApplyBatch: (updatedPanels: Panel[], summaryText: string) => void;
}

export const BatchAdjustmentModal: React.FC<BatchAdjustmentModalProps> = ({
  isOpen,
  onClose,
  project,
  initialSelectedIndices = [],
  onApplyBatch,
}) => {
  if (!isOpen) return null;

  // Selected panel indices state
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => {
    if (initialSelectedIndices.length > 0) {
      return initialSelectedIndices;
    }
    // Default to all panels if none provided
    return project.panels.map((_, i) => i);
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<'camera' | 'subtitles' | 'transitions'>('camera');
  const [justApplied, setJustApplied] = useState(false);

  // Application toggles (which settings to apply upon confirm)
  const [applyCamera, setApplyCamera] = useState(true);
  const [applySubtitles, setApplySubtitles] = useState(false);
  const [applyTransitions, setApplyTransitions] = useState(false);
  const [applyDuration, setApplyDuration] = useState(false);

  // --- CAMERA SETTINGS STATE ---
  const [cameraPreset, setCameraPreset] = useState<CameraMotionType>('crash-zoom');
  const [cameraStartZoom, setCameraStartZoom] = useState(1.0);
  const [cameraEndZoom, setCameraEndZoom] = useState(1.8);
  const [cameraShake, setCameraShake] = useState(0.5);
  const [cameraEasing, setCameraEasing] = useState<'ease-in-out' | 'ease-out' | 'linear' | 'punch'>('punch');
  const [targetDuration, setTargetDuration] = useState(4.5);

  // --- SUBTITLE SETTINGS STATE ---
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(() => ({
    ...project.subtitleStyle,
    fontFamily: 'Cabinet Grotesk',
    fontSize: 54,
    textColor: '#FFFFFF',
    highlightColor: '#FACC15',
    strokeColor: '#000000',
    strokeWidth: 6,
    positionY: 82,
    fontWeight: '900',
    fontStyle: 'normal',
    textTransform: 'uppercase',
    shadowPreset: 'comic-punch',
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 4,
    shadowOffsetY: 4,
    showBackdrop: true,
    backdropColor: 'rgba(10, 10, 15, 0.85)',
    isCustom: true,
  }));

  // --- TRANSITIONS & SFX STATE ---
  const [batchTransition, setBatchTransition] = useState<TransitionType>('page-turn');
  const [batchSfx, setBatchSfx] = useState<SoundEffectType>('none');

  // Handle Preset Selection for Camera
  const handleSelectCameraPreset = (preset: CameraMotionType) => {
    setCameraPreset(preset);
    if (preset === 'crash-zoom') {
      setCameraStartZoom(1.0);
      setCameraEndZoom(2.1);
      setCameraShake(0.7);
      setCameraEasing('punch');
    } else if (preset === 'pan-down') {
      setCameraStartZoom(1.15);
      setCameraEndZoom(1.3);
      setCameraShake(0);
      setCameraEasing('ease-in-out');
    } else if (preset === 'pan-right') {
      setCameraStartZoom(1.2);
      setCameraEndZoom(1.4);
      setCameraShake(0);
      setCameraEasing('ease-in-out');
    } else if (preset === 'shake-impact') {
      setCameraStartZoom(1.25);
      setCameraEndZoom(1.55);
      setCameraShake(1.0);
      setCameraEasing('punch');
    } else if (preset === 'slow-drift') {
      setCameraStartZoom(1.05);
      setCameraEndZoom(1.25);
      setCameraShake(0);
      setCameraEasing('linear');
    } else if (preset === 'zoom-in') {
      setCameraStartZoom(1.0);
      setCameraEndZoom(1.6);
      setCameraShake(0);
      setCameraEasing('ease-out');
    } else if (preset === 'zoom-out') {
      setCameraStartZoom(1.6);
      setCameraEndZoom(1.05);
      setCameraShake(0);
      setCameraEasing('ease-out');
    } else if ((preset as string) === 'static' || preset === 'custom') {
      setCameraStartZoom(1.0);
      setCameraEndZoom(1.0);
      setCameraShake(0);
      setCameraEasing('linear');
    }
  };

  // Helper to build camera settings object
  const buildCameraSettings = (): CameraSettings => {
    let start = { x: 0.5, y: 0.5, zoom: cameraStartZoom };
    let end = { x: 0.5, y: 0.5, zoom: cameraEndZoom };

    if (cameraPreset === 'pan-down') {
      start = { x: 0.5, y: 0.2, zoom: cameraStartZoom };
      end = { x: 0.5, y: 0.75, zoom: cameraEndZoom };
    } else if (cameraPreset === 'pan-right') {
      start = { x: 0.25, y: 0.5, zoom: cameraStartZoom };
      end = { x: 0.75, y: 0.5, zoom: cameraEndZoom };
    } else if (cameraPreset === 'crash-zoom') {
      start = { x: 0.5, y: 0.45, zoom: cameraStartZoom };
      end = { x: 0.52, y: 0.42, zoom: cameraEndZoom };
    }

    return {
      type: cameraPreset,
      start,
      end,
      shakeIntensity: cameraShake,
      easing: cameraEasing,
    };
  };

  // 1-Click Subtitle Presets
  const applySubtitlePreset = (preset: {
    fontFamily: string;
    fontWeight: '700' | '800' | '900';
    textTransform: 'uppercase' | 'none';
    textColor: string;
    highlightColor: string;
    strokeColor: string;
    strokeWidth: number;
    shadowPreset: SubtitleShadowPreset;
    shadowColor: string;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
  }) => {
    setSubtitleStyle(prev => ({
      ...prev,
      ...preset,
      isCustom: true,
    }));
  };

  // Panel selection helpers
  const togglePanelSelection = (index: number) => {
    setSelectedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const selectAll = () => {
    setSelectedIndices(project.panels.map((_, i) => i));
  };

  const deselectAll = () => {
    setSelectedIndices([]);
  };

  const invertSelection = () => {
    const all = project.panels.map((_, i) => i);
    setSelectedIndices(all.filter(i => !selectedIndices.includes(i)));
  };

  const selectOdd = () => {
    setSelectedIndices(project.panels.map((_, i) => i).filter(i => i % 2 === 0)); // 1st, 3rd, 5th...
  };

  const selectEven = () => {
    setSelectedIndices(project.panels.map((_, i) => i).filter(i => i % 2 !== 0)); // 2nd, 4th, 6th...
  };

  // Filter panels by title/commentary search query
  const filteredPanels = useMemo(() => {
    if (!searchFilter.trim()) return project.panels.map((p, i) => ({ panel: p, originalIndex: i }));
    const q = searchFilter.toLowerCase();
    return project.panels
      .map((p, i) => ({ panel: p, originalIndex: i }))
      .filter(({ panel }) => 
        panel.title.toLowerCase().includes(q) || panel.commentary.toLowerCase().includes(q)
      );
  }, [project.panels, searchFilter]);

  // Execute Batch Application
  const handleApply = () => {
    if (selectedIndices.length === 0) return;

    const cameraSettingsToApply = buildCameraSettings();
    const updatedPanels = project.panels.map((panel, idx) => {
      if (!selectedIndices.includes(idx)) {
        return panel;
      }

      let updated = { ...panel };

      if (applyCamera) {
        updated.camera = { ...cameraSettingsToApply };
      }

      if (applySubtitles) {
        updated.subtitleStyle = { ...subtitleStyle, isCustom: true };
      }

      if (applyTransitions) {
        updated.transition = batchTransition;
        if (batchSfx !== 'none') {
          updated.soundEffect = batchSfx;
        }
      }

      if (applyDuration) {
        updated.duration = targetDuration;
      }

      return updated;
    });

    const summaryParts: string[] = [];
    if (applyCamera) summaryParts.push(`Camera (${cameraPreset.toUpperCase()})`);
    if (applySubtitles) summaryParts.push(`Subtitle Style (${subtitleStyle.fontFamily})`);
    if (applyTransitions) summaryParts.push(`Transition (${batchTransition})`);
    if (applyDuration) summaryParts.push(`Duration (${targetDuration}s)`);

    const summary = `Applied ${summaryParts.join(' & ')} to ${selectedIndices.length} panels`;

    onApplyBatch(updatedPanels, summary);
    setJustApplied(true);
    setTimeout(() => {
      setJustApplied(false);
      onClose();
    }, 700);
  };

  // Sample panel for live preview
  const previewPanelIndex = selectedIndices.length > 0 ? selectedIndices[0] : 0;
  const previewPanel = project.panels[previewPanelIndex] || project.panels[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md">
      <div className="bg-[#0f0f17] border border-zinc-800 rounded-2xl w-full max-w-5xl h-[90vh] max-h-[820px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="p-4 bg-[#12121e] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">Batch Panel Adjustment Tool</h2>
                <span className="text-[10px] font-mono bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-300">
                  {selectedIndices.length} / {project.panels.length} panels target
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Apply pan-and-zoom motion curves, camera choreography, and custom subtitle styles across multiple panels simultaneously.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Body: 2-Column Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT COLUMN: Panel Target Selector */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-zinc-800 bg-[#0d0d14] flex flex-col overflow-hidden">
            
            {/* Panel Selector Toolbar */}
            <div className="p-3 border-b border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                  Target Panels
                </span>
                <span className="text-[11px] font-mono text-amber-400 font-bold">
                  {selectedIndices.length} selected
                </span>
              </div>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="Search panels by title or dialogue..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
              />

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-1 text-[10px]">
                <button
                  onClick={selectAll}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  All ({project.panels.length})
                </button>
                <button
                  onClick={deselectAll}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  None
                </button>
                <button
                  onClick={invertSelection}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Invert
                </button>
                <button
                  onClick={selectOdd}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Odd (1,3,5)
                </button>
                <button
                  onClick={selectEven}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Even (2,4,6)
                </button>
              </div>
            </div>

            {/* Scrollable Panel Grid / List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {filteredPanels.map(({ panel, originalIndex }) => {
                const isSelected = selectedIndices.includes(originalIndex);
                return (
                  <div
                    key={panel.id}
                    onClick={() => togglePanelSelection(originalIndex)}
                    className={`p-2 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-400/80 text-white shadow-sm ring-1 ring-amber-400/40'
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                    }`}
                  >
                    {/* Checkbox Icon */}
                    <div className="flex-shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-600" />
                      )}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-9 h-11 rounded-lg bg-black overflow-hidden flex-shrink-0 border border-zinc-800">
                      <img
                        src={panel.imageUrl}
                        alt={panel.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Panel Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-200 truncate">
                          #{originalIndex + 1} {panel.title}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 shrink-0 ml-1">
                          {panel.duration.toFixed(1)}s
                        </span>
                      </div>

                      <div className="flex items-center gap-1 mt-1 text-[9px] flex-wrap">
                        <span className="px-1 py-0.2 rounded bg-zinc-800 text-amber-400 font-mono">
                          {panel.camera.type.toUpperCase()}
                        </span>
                        {panel.subtitleStyle?.isCustom && (
                          <span className="px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800/50">
                            Custom Sub
                          </span>
                        )}
                        <span className="text-zinc-500 truncate max-w-[120px]">
                          "{panel.commentary.slice(0, 30)}..."
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredPanels.length === 0 && (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  No panels match "{searchFilter}"
                </div>
              )}
            </div>

            {/* Selection Status footer */}
            <div className="p-2.5 bg-zinc-950/80 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>{selectedIndices.length} panel(s) will be modified</span>
              {selectedIndices.length === 0 && (
                <span className="text-amber-400 text-[10px] font-bold">Pick at least 1</span>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Batch Settings Studio */}
          <div className="flex-1 flex flex-col bg-[#0f0f17] overflow-hidden">
            
            {/* Category Navigation Tabs */}
            <div className="flex border-b border-zinc-800 bg-[#0c0c14] text-xs font-bold">
              <button
                onClick={() => {
                  setActiveCategory('camera');
                  setApplyCamera(true);
                }}
                className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-all ${
                  activeCategory === 'camera'
                    ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Camera className="w-4 h-4 text-amber-400" />
                <span>1. Pan & Zoom (Camera)</span>
                {applyCamera && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>

              <button
                onClick={() => {
                  setActiveCategory('subtitles');
                  setApplySubtitles(true);
                }}
                className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-all ${
                  activeCategory === 'subtitles'
                    ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Palette className="w-4 h-4 text-amber-400" />
                <span>2. Subtitle Styling</span>
                {applySubtitles && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>

              <button
                onClick={() => {
                  setActiveCategory('transitions');
                  setApplyTransitions(true);
                }}
                className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-all ${
                  activeCategory === 'transitions'
                    ? 'border-red-400 text-red-400 bg-red-400/5'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Zap className="w-4 h-4 text-red-400" />
                <span>3. Transitions & SFX</span>
                {applyTransitions && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                )}
              </button>
            </div>

            {/* Scrollable Category Options Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 text-xs">
              
              {/* TAB 1: PAN AND ZOOM (CAMERA CHOREOGRAPHY) */}
              {activeCategory === 'camera' && (
                <div className="space-y-4">
                  
                  {/* Category Activation Toggle Banner */}
                  <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-zinc-200 text-xs">Apply Pan & Zoom Settings</span>
                      <p className="text-[11px] text-zinc-500">
                        When checked, selected panels will receive these motion parameters
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyCamera}
                        onChange={(e) => setApplyCamera(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>

                  {/* 8 Camera Motion Presets */}
                  <div>
                    <label className="font-bold text-zinc-200 block mb-2 text-xs">
                      Camera Motion Presets
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        {
                          id: 'crash-zoom' as CameraMotionType,
                          title: 'Crash Zoom',
                          desc: 'Rapid dramatic punch-in (2.1x)',
                          icon: '⚡',
                        },
                        {
                          id: 'pan-down' as CameraMotionType,
                          title: 'Pan Down',
                          desc: 'Webtoon vertical scroll scan',
                          icon: '⬇️',
                        },
                        {
                          id: 'pan-right' as CameraMotionType,
                          title: 'Pan Right',
                          desc: 'Horizontal wide spread sweep',
                          icon: '➡️',
                        },
                        {
                          id: 'shake-impact' as CameraMotionType,
                          title: 'Shake Impact',
                          desc: 'Violent rumble shockwave',
                          icon: '💥',
                        },
                        {
                          id: 'slow-drift' as CameraMotionType,
                          title: 'Slow Drift',
                          desc: 'Gentle ambient cinematic glide',
                          icon: '🌊',
                        },
                        {
                          id: 'zoom-in' as CameraMotionType,
                          title: 'Zoom In',
                          desc: 'Smooth suspense push (1.6x)',
                          icon: '🔍',
                        },
                        {
                          id: 'zoom-out' as CameraMotionType,
                          title: 'Zoom Out',
                          desc: 'Pull back reveal (1.05x)',
                          icon: '🌌',
                        },
                        {
                          id: 'static' as CameraMotionType,
                          title: 'Static Fit',
                          desc: 'Locked framing without motion',
                          icon: '⏸️',
                        },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleSelectCameraPreset(preset.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            cameraPreset === preset.id
                              ? 'bg-amber-500/15 border-amber-400 text-white shadow-md'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <div className="text-base mb-1">{preset.icon}</div>
                          <div>
                            <div className="font-bold text-xs text-zinc-100">{preset.title}</div>
                            <div className="text-[10px] text-zinc-500 line-clamp-1">{preset.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fine-Tuning Sliders Card */}
                  <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3.5">
                    <span className="font-bold text-zinc-200 block text-xs flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                      Fine-Tune Pan & Zoom Parameters
                    </span>

                    {/* Start Zoom & End Zoom */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-zinc-400">Start Zoom Scale</span>
                          <span className="font-mono text-amber-400 font-bold">{cameraStartZoom.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min={0.8}
                          max={2.5}
                          step={0.05}
                          value={cameraStartZoom}
                          onChange={(e) => setCameraStartZoom(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-zinc-400">End Zoom Scale</span>
                          <span className="font-mono text-amber-400 font-bold">{cameraEndZoom.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min={0.8}
                          max={2.5}
                          step={0.05}
                          value={cameraEndZoom}
                          onChange={(e) => setCameraEndZoom(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                    </div>

                    {/* Shake Intensity & Easing */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-zinc-400">Screen Shake Rumble</span>
                          <span className="font-mono text-amber-400 font-bold">
                            {cameraShake > 0 ? `${(cameraShake * 100).toFixed(0)}%` : 'None'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1.0}
                          step={0.05}
                          value={cameraShake}
                          onChange={(e) => setCameraShake(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Animation Easing Curve</label>
                        <select
                          value={cameraEasing}
                          onChange={(e) => setCameraEasing(e.target.value as any)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                        >
                          <option value="punch">Punch (Instant snap-in)</option>
                          <option value="ease-in-out">Ease In-Out (Smooth cinematic)</option>
                          <option value="ease-out">Ease Out (Deceleration)</option>
                          <option value="linear">Linear (Constant speed)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Batch Duration Option */}
                  <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="batch-duration-check"
                          checked={applyDuration}
                          onChange={(e) => setApplyDuration(e.target.checked)}
                          className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                        />
                        <label htmlFor="batch-duration-check" className="font-bold text-zinc-200 text-xs cursor-pointer">
                          Batch Set Panel Durations
                        </label>
                      </div>
                      <p className="text-[10px] text-zinc-500 ml-5 mt-0.5">
                        Harmonize pacing by setting all {selectedIndices.length} target panels to a uniform duration.
                      </p>
                    </div>

                    {applyDuration && (
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={2.0}
                          max={12.0}
                          step={0.5}
                          value={targetDuration}
                          onChange={(e) => setTargetDuration(parseFloat(e.target.value))}
                          className="w-24 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                        <span className="font-mono text-amber-400 font-bold text-xs w-10 text-right">
                          {targetDuration.toFixed(1)}s
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: SUBTITLE STYLES (FONTS, COLORS, STROKES, SHADOWS) */}
              {activeCategory === 'subtitles' && (
                <div className="space-y-4">
                  
                  {/* Category Activation Toggle Banner */}
                  <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-zinc-200 text-xs">Apply Subtitle Styles</span>
                      <p className="text-[11px] text-zinc-500">
                        When checked, selected panels will receive this typography, outline, and shadow configuration
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applySubtitles}
                        onChange={(e) => setApplySubtitles(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>

                  {/* 1-Click Subtitle Presets */}
                  <div>
                    <label className="font-bold text-zinc-200 block mb-2 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      1-Click Anime Recap Subtitle Styles
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        {
                          name: '⚡ Mamoru Gold',
                          preset: {
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
                          name: '🔥 Crimson Shonen',
                          preset: {
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
                          name: '💎 System Blue',
                          preset: {
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
                          name: '🧪 Acid Lime',
                          preset: {
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
                          name: '👑 Shadow Monarch',
                          preset: {
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
                          name: '🤍 Clean Sub',
                          preset: {
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
                      ].map((item, i) => (
                        <button
                          key={i}
                          onClick={() => applySubtitlePreset(item.preset)}
                          className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition-all"
                        >
                          <div className="font-bold text-xs text-zinc-200">{item.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Simulation Card */}
                  <div className="bg-[#09090f] rounded-2xl border border-zinc-800 p-4 space-y-2 relative overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span className="flex items-center gap-1 font-bold text-amber-400">
                        <Eye className="w-3 h-3" />
                        BATCH SUBTITLE PREVIEW
                      </span>
                      <span>Font: {subtitleStyle.fontFamily} • Size: {subtitleStyle.fontSize}px</span>
                    </div>

                    <div
                      className="py-6 px-3 rounded-xl flex items-center justify-center text-center transition-all relative overflow-hidden"
                      style={{
                        backgroundImage: 'radial-gradient(ellipse at center, rgba(30, 27, 75, 0.5) 0%, rgba(9, 9, 15, 0.95) 75%)',
                      }}
                    >
                      <div
                        className="px-4 py-2 rounded-2xl inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 transition-all"
                        style={{
                          backgroundColor: subtitleStyle.showBackdrop !== false 
                            ? (subtitleStyle.backdropColor || 'rgba(10, 10, 15, 0.82)')
                            : 'transparent',
                          border: subtitleStyle.showBackdrop !== false 
                            ? `2px solid ${subtitleStyle.highlightColor || '#f59e0b'}` 
                            : 'none',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: `'${subtitleStyle.fontFamily || 'Cabinet Grotesk'}', sans-serif`,
                            fontSize: `${Math.max(16, Math.min(26, Math.round((subtitleStyle.fontSize || 54) * 0.38)))}px`,
                            fontWeight: subtitleStyle.fontWeight || '900',
                            fontStyle: subtitleStyle.fontStyle || 'normal',
                            textTransform: subtitleStyle.textTransform || 'uppercase',
                            color: subtitleStyle.textColor || '#FFFFFF',
                            WebkitTextStroke: `${Math.max(1, Math.round((subtitleStyle.strokeWidth || 4) * 0.45))}px ${subtitleStyle.strokeColor || '#000000'}`,
                            paintOrder: 'stroke fill',
                            textShadow: subtitleStyle.shadowPreset === 'none'
                              ? 'none'
                              : `${(subtitleStyle.shadowOffsetX ?? 3) * 0.5}px ${(subtitleStyle.shadowOffsetY ?? 3) * 0.5}px ${(subtitleStyle.shadowBlur ?? 4) * 0.5}px ${subtitleStyle.shadowColor || 'rgba(0,0,0,0.9)'}`,
                            lineHeight: 1.15,
                          }}
                        >
                          HE REALLY THOUGHT HE
                        </span>

                        <span
                          className="inline-block transform scale-110 animate-pulse"
                          style={{
                            fontFamily: `'${subtitleStyle.fontFamily || 'Cabinet Grotesk'}', sans-serif`,
                            fontSize: `${Math.max(18, Math.min(28, Math.round((subtitleStyle.fontSize || 54) * 0.42)))}px`,
                            fontWeight: subtitleStyle.fontWeight || '900',
                            fontStyle: subtitleStyle.fontStyle || 'normal',
                            textTransform: subtitleStyle.textTransform || 'uppercase',
                            color: subtitleStyle.highlightColor || '#FACC15',
                            WebkitTextStroke: `${Math.max(1, Math.round((subtitleStyle.strokeWidth || 4) * 0.45))}px ${subtitleStyle.strokeColor || '#000000'}`,
                            paintOrder: 'stroke fill',
                            textShadow: subtitleStyle.shadowPreset === 'none'
                              ? 'none'
                              : `0px 0px ${(subtitleStyle.shadowBlur || 8) * 0.7}px ${subtitleStyle.highlightColor || '#FACC15'}`,
                            lineHeight: 1.15,
                          }}
                        >
                          WAS HIM?!
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Font Family & Typography Controls */}
                  <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3.5">
                    <span className="font-bold text-zinc-200 block text-xs flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-amber-400" />
                      Typography & Fonts
                    </span>

                    {/* Font choices */}
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
                          onClick={() => setSubtitleStyle(prev => ({ ...prev, fontFamily: font.id }))}
                          className={`p-2 rounded-xl border text-left transition-all ${
                            subtitleStyle.fontFamily === font.id
                              ? 'bg-amber-500/10 border-amber-400/80 text-amber-300'
                              : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <div className="text-xs font-bold truncate" style={{ fontFamily: `'${font.id}', sans-serif` }}>
                            {font.name}
                          </div>
                          <div className="text-[9px] text-zinc-500 truncate">{font.desc}</div>
                        </button>
                      ))}
                    </div>

                    {/* Sliders: Size & Position */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-zinc-400">Font Size</span>
                          <span className="font-mono text-amber-400 font-bold">{subtitleStyle.fontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min={32}
                          max={80}
                          step={2}
                          value={subtitleStyle.fontSize}
                          onChange={(e) => setSubtitleStyle(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-zinc-400">Position Y (Vertical)</span>
                          <span className="font-mono text-amber-400 font-bold">{subtitleStyle.positionY}%</span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={95}
                          step={1}
                          value={subtitleStyle.positionY}
                          onChange={(e) => setSubtitleStyle(prev => ({ ...prev, positionY: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Colors, Stroke & Shadow Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Colors & Stroke Card */}
                    <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3">
                      <span className="font-bold text-zinc-200 block text-xs flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        Colors & Outlines
                      </span>

                      {/* Text & Highlight Color */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">Base Text Color</span>
                        <div className="flex items-center gap-1.5">
                          {['#FFFFFF', '#F8FAFC', '#FEF08A', '#FED7AA'].map(hex => (
                            <button
                              key={hex}
                              onClick={() => setSubtitleStyle(prev => ({ ...prev, textColor: hex }))}
                              className={`w-5 h-5 rounded-full border ${
                                subtitleStyle.textColor === hex ? 'border-amber-400 ring-1 ring-amber-400' : 'border-zinc-700'
                              }`}
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                          <input
                            type="color"
                            value={subtitleStyle.textColor?.startsWith('#') ? subtitleStyle.textColor : '#FFFFFF'}
                            onChange={(e) => setSubtitleStyle(prev => ({ ...prev, textColor: e.target.value }))}
                            className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">Karaoke Active Color</span>
                        <div className="flex items-center gap-1.5">
                          {['#FACC15', '#38BDF8', '#EF4444', '#4ADE80', '#C084FC'].map(hex => (
                            <button
                              key={hex}
                              onClick={() => setSubtitleStyle(prev => ({ ...prev, highlightColor: hex }))}
                              className={`w-5 h-5 rounded-full border ${
                                subtitleStyle.highlightColor === hex ? 'border-amber-400 ring-1 ring-amber-400' : 'border-zinc-700'
                              }`}
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                          <input
                            type="color"
                            value={subtitleStyle.highlightColor?.startsWith('#') ? subtitleStyle.highlightColor : '#FACC15'}
                            onChange={(e) => setSubtitleStyle(prev => ({ ...prev, highlightColor: e.target.value }))}
                            className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
                          />
                        </div>
                      </div>

                      {/* Stroke Width Slider */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-zinc-400">Outline Width</span>
                          <span className="font-mono text-amber-400 font-bold">{subtitleStyle.strokeWidth || 0}px</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={14}
                          step={1}
                          value={subtitleStyle.strokeWidth ?? 6}
                          onChange={(e) => setSubtitleStyle(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                    </div>

                    {/* Shadow & Glow Card */}
                    <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3">
                      <span className="font-bold text-zinc-200 block text-xs flex items-center gap-1.5">
                        <Contrast className="w-3.5 h-3.5 text-amber-400" />
                        Shadow & Glow Effects
                      </span>

                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { id: 'comic-punch', label: 'Comic Punch' },
                          { id: 'neon-glow', label: 'Neon Glow' },
                          { id: 'deep-drop', label: 'Deep Drop' },
                          { id: 'fire-aura', label: 'Fire Aura' },
                          { id: 'subtle-halo', label: 'Subtle Halo' },
                          { id: 'none', label: 'None' },
                        ].map(p => (
                          <button
                            key={p.id}
                            onClick={() => setSubtitleStyle(prev => ({ ...prev, shadowPreset: p.id as any }))}
                            className={`py-1.5 px-1 rounded-lg border text-center text-[10px] transition-all ${
                              subtitleStyle.shadowPreset === p.id
                                ? 'bg-amber-500/10 border-amber-400 text-amber-300 font-bold'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {/* Backdrop Pill Toggle */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                        <span className="text-[11px] text-zinc-400">Comic Backdrop Pill</span>
                        <button
                          onClick={() => setSubtitleStyle(prev => ({ ...prev, showBackdrop: !prev.showBackdrop }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            subtitleStyle.showBackdrop !== false ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {subtitleStyle.showBackdrop !== false ? 'Enabled' : 'Hidden'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TRANSITIONS & SFX */}
              {activeCategory === 'transitions' && (
                <div className="space-y-4">
                  {/* Category Activation Toggle Banner */}
                  <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-zinc-200 text-xs">Apply Transitions & SFX</span>
                      <p className="text-[11px] text-zinc-500">
                        When checked, selected panels will receive this transition cut and sound cue
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyTransitions}
                        onChange={(e) => setApplyTransitions(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500" />
                    </label>
                  </div>

                  <div>
                    <label className="font-bold text-zinc-200 block mb-2 text-xs">
                      Transition Cut
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TRANSITION_LIBRARY.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setBatchTransition(t.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            batchTransition === t.id
                              ? 'bg-red-500/15 border-red-400 text-white shadow-md'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-100">
                            <span>{t.icon}</span>
                            <span>{t.name}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">
                            {t.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-2">
                    <label className="font-bold text-zinc-200 block text-xs">
                      Sound Effect Cue (Optional)
                    </label>
                    <select
                      value={batchSfx}
                      onChange={(e) => setBatchSfx(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-red-400"
                    >
                      <option value="none">No Sound Effect</option>
                      <option value="anime-punch">Anime Punch (Impact)</option>
                      <option value="vine-boom">Vine Boom (Meme Shock)</option>
                      <option value="record-scratch">Record Scratch (Awkward Pause)</option>
                      <option value="discord-ping">Discord Ping</option>
                      <option value="choir-epic">Choir Epic (Ascension)</option>
                      <option value="level-up">Level Up</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action / Confirmation Bar */}
            <div className="p-4 bg-[#101018] border-t border-zinc-800 flex items-center justify-between">
              
              {/* Scope Summary */}
              <div className="text-xs text-zinc-400">
                <span className="font-bold text-zinc-200">
                  Ready to update {selectedIndices.length} panel(s):
                </span>
                <span className="text-zinc-500 ml-1.5">
                  {[
                    applyCamera ? 'Pan & Zoom' : null,
                    applySubtitles ? 'Subtitle Styling' : null,
                    applyTransitions ? 'Transitions' : null,
                    applyDuration ? 'Duration' : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'No actions enabled'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>

                <button
                  onClick={handleApply}
                  disabled={selectedIndices.length === 0 || (!applyCamera && !applySubtitles && !applyTransitions && !applyDuration)}
                  className={`px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-lg ${
                    justApplied
                      ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                      : selectedIndices.length === 0 || (!applyCamera && !applySubtitles && !applyTransitions && !applyDuration)
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/20 active:scale-95'
                  }`}
                >
                  {justApplied ? (
                    <>
                      <Check className="w-4 h-4 text-white animate-bounce" />
                      <span>Applied to {selectedIndices.length} Panels!</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Apply to {selectedIndices.length} Selected Panels</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
