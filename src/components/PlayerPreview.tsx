import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Music, 
  Mic, 
  Layers, 
  Zap,
  FastForward,
  Rewind
} from 'lucide-react';
import { ProjectSettings } from '../types/manhwa';
import { videoRenderer } from '../services/videoRenderer';
import { audioEngine } from '../services/audioEngine';
import { speakBrowserVoice, requestTtsAudio } from '../services/geminiClient';

interface PlayerPreviewProps {
  project: ProjectSettings;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  selectedPanelIndex: number;
  onSelectPanel: (index: number) => void;
  onUpdateProject?: React.Dispatch<React.SetStateAction<ProjectSettings>>;
}

export const PlayerPreview: React.FC<PlayerPreviewProps> = ({
  project,
  currentTime,
  onTimeUpdate,
  selectedPanelIndex,
  onSelectPanel,
  onUpdateProject,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sfxFlash, setSfxFlash] = useState<string | null>(null);
  const [showCameraGuide, setShowCameraGuide] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  const lastPanelIndexRef = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const currentTimeRef = useRef<number>(currentTime);
  const inFlightTtsRef = useRef<Set<string>>(new Set());
  const [isLooping, setIsLooping] = useState(false);

  // Keep ref synchronized with external currentTime updates (e.g. seeking)
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const totalDuration = videoRenderer.getTotalDuration(project);

  // Preload images whenever panels change
  useEffect(() => {
    let isMounted = true;
    videoRenderer.preloadImages(project.panels).then((map) => {
      if (isMounted) setLoadedImages(map);
    });
    return () => {
      isMounted = false;
    };
  }, [project.panels]);

  // Keep audio volumes synced
  useEffect(() => {
    if (isMuted) {
      audioEngine.setVolumes(0, 0);
    } else {
      audioEngine.setVolumes(project.bgmVolume, project.voiceVolume);
    }
  }, [project.bgmVolume, project.voiceVolume, isMuted]);

  // Trigger audio playback for active panel with real video editor voice clip settings
  const triggerPanelAudio = useCallback((panelIdx: number) => {
    if (panelIdx < 0 || panelIdx >= project.panels.length || isMuted) return;
    const panel = project.panels[panelIdx];

    // Sound effect
    if (panel.soundEffect && panel.soundEffect !== 'none') {
      audioEngine.playSoundEffect(panel.soundEffect);
      setSfxFlash(panel.soundEffect.toUpperCase().replace('-', ' '));
      setTimeout(() => setSfxFlash(null), 1200);
    }

    // Voiceover: apply per-clip speed, pitch, gain, and EQ filter
    if (panel.audioBase64) {
      audioEngine.duckBgm(true);
      audioEngine.playVoiceBase64(panel.audioBase64, panel.voiceSettings).catch(err => {
        console.warn('Audio playback error, falling back to Web Speech:', err);
        speakBrowserVoice(panel.commentary, () => audioEngine.duckBgm(false));
      });
    } else if (panel.commentary) {
      // 1. Immediately provide audible speech feedback so user hears voiceover right away
      audioEngine.duckBgm(true);
      speakBrowserVoice(panel.commentary, () => {
        audioEngine.duckBgm(false);
      });

      // 2. Concurrently fetch Gemini AI Voice (Puck/Fenrir) and attach it to the panel
      const panelKey = `${panel.id}_${panel.commentary}`;
      if (!inFlightTtsRef.current.has(panelKey) && onUpdateProject) {
        inFlightTtsRef.current.add(panelKey);
        const persona = panel.voiceSettings?.voicePersona || project.voicePersona || 'Puck';
        const style = panel.voiceSettings?.stylePrompt || 'Energetic comedic YouTube manhwa recap narrator breaking the fourth wall';
        requestTtsAudio(panel.commentary, persona, style)
          .then((audioBase64) => {
            onUpdateProject((prev) => {
              const updated = [...prev.panels];
              if (updated[panelIdx] && updated[panelIdx].id === panel.id) {
                updated[panelIdx] = { ...updated[panelIdx], audioBase64 };
              }
              return { ...prev, panels: updated };
            });
          })
          .catch((err) => {
            console.warn('Background voice synthesis error for panel:', panelIdx, err);
          })
          .finally(() => {
            inFlightTtsRef.current.delete(panelKey);
          });
      }
    }
  }, [project.panels, project.voicePersona, isMuted, onUpdateProject]);

  // Render loop
  const renderCurrent = useCallback((timeToRender: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    videoRenderer.renderFrame({
      canvas,
      ctx,
      width: canvas.width,
      height: canvas.height,
      time: timeToRender,
      project,
      loadedImages,
    });

    // Optional camera guide overlays
    if (showCameraGuide) {
      const { panel } = videoRenderer.getPanelAtTime(project, timeToRender);
      if (panel) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
        ctx.font = '700 24px monospace';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`CAM: ${panel.camera.type} | ZOOM: ${panel.camera.start.zoom.toFixed(2)}x -> ${panel.camera.end.zoom.toFixed(2)}x`, 65, 90);
        ctx.restore();
      }
    }
  }, [project, loadedImages, showCameraGuide]);

  // Render whenever time or project changes
  useEffect(() => {
    renderCurrent(currentTime);
  }, [currentTime, renderCurrent]);

  // Main playback loop with monotonic clock
  useEffect(() => {
    if (!isPlaying) {
      audioEngine.stopBgm();
      audioEngine.stopVoice();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    // Start background music
    if (project.bgmTrack !== 'none' && !isMuted) {
      audioEngine.startBgm(project.bgmTrack);
    }

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const deltaSec = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      let nextTime = currentTimeRef.current + deltaSec;
      
      if (nextTime >= totalDuration) {
        if (isLooping) {
          nextTime = 0;
          lastPanelIndexRef.current = -1;
        } else {
          nextTime = totalDuration;
          currentTimeRef.current = totalDuration;
          onTimeUpdate(totalDuration);
          setIsPlaying(false);
          return;
        }
      }

      currentTimeRef.current = nextTime;
      onTimeUpdate(nextTime);

      // Check if panel changed
      const { panelIndex } = videoRenderer.getPanelAtTime(project, nextTime);
      if (panelIndex !== lastPanelIndexRef.current) {
        lastPanelIndexRef.current = panelIndex;
        onSelectPanel(panelIndex);
        triggerPanelAudio(panelIndex);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, totalDuration, onTimeUpdate, project, isMuted, isLooping, onSelectPanel, triggerPanelAudio]);

  // Play / Pause toggle
  const togglePlay = () => {
    if (!isPlaying) {
      audioEngine.init();
      // If at or near end, restart from 0
      if (currentTimeRef.current >= totalDuration - 0.1) {
        currentTimeRef.current = 0;
        onTimeUpdate(0);
        lastPanelIndexRef.current = 0;
        onSelectPanel(0);
        triggerPanelAudio(0);
      } else {
        const { panelIndex } = videoRenderer.getPanelAtTime(project, currentTimeRef.current);
        lastPanelIndexRef.current = panelIndex;
        triggerPanelAudio(panelIndex);
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    onTimeUpdate(0);
    lastPanelIndexRef.current = -1;
    if (isPlaying) {
      triggerPanelAudio(0);
    }
  };

  const handleSkip = (delta: number) => {
    const nextTime = Math.max(0, Math.min(totalDuration, currentTime + delta));
    onTimeUpdate(nextTime);
    const { panelIndex } = videoRenderer.getPanelAtTime(project, nextTime);
    onSelectPanel(panelIndex);
    if (isPlaying) {
      lastPanelIndexRef.current = panelIndex;
      triggerPanelAudio(panelIndex);
    }
  };

  // Keyboard shortcut: Space to play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        handleSkip(1);
      } else if (e.code === 'ArrowLeft') {
        handleSkip(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const { panel, localTime } = videoRenderer.getPanelAtTime(project, currentTime);

  // Aspect ratio calculation for responsive frame
  const isVertical = project.aspectRatio === '9:16';
  const isSquare = project.aspectRatio === '1:1';
  const canvasWidth = isVertical ? 720 : (isSquare ? 720 : 1280);
  const canvasHeight = isVertical ? 1280 : (isSquare ? 720 : 720);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#08080c] relative overflow-hidden select-none">
      {/* Video Stage Area */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-3 md:p-6 relative overflow-hidden"
      >
        {/* Subtle glowing backlight */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

        {/* Video Canvas Container */}
        <div 
          className="relative max-h-full rounded-2xl overflow-hidden shadow-2xl shadow-black/90 border border-zinc-800/80 bg-black flex items-center justify-center"
          style={{
            aspectRatio: isVertical ? '9/16' : (isSquare ? '1/1' : '16/9'),
            height: isVertical ? '82vh' : 'auto',
            maxHeight: '100%',
            maxWidth: '100%',
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlay}
          />

          {/* Sound Effect Visual Pop Banner (Mamoru Style Meme flash) */}
          {sfxFlash && (
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none animate-bounce">
              <div className="px-5 py-2.5 rounded-2xl bg-red-600/90 text-white font-['Bangers'] tracking-wider text-2xl md:text-3xl border-2 border-yellow-300 shadow-2xl shadow-red-600/80 rotate-[-4deg] flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-300 fill-yellow-300" />
                <span>[{sfxFlash}!]</span>
              </div>
            </div>
          )}

          {/* Floating HUD Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
            {panel && (
              <div className="px-3 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-zinc-700/60 text-xs font-bold text-zinc-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Panel {selectedPanelIndex + 1}/{project.panels.length}:</span>
                <span className="text-amber-400 truncate max-w-[140px] md:max-w-xs">{panel.title}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {project.bgmTrack !== 'none' && (
                <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                  <Music className="w-3 h-3 text-amber-400" />
                  <span className="uppercase">{project.bgmTrack.replace('-', ' ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Playback Control Bar */}
      <div className="h-14 bg-[#0d0d14] border-t border-zinc-800/80 px-4 flex items-center justify-between gap-4 z-20">
        {/* Left: Playback & Scrubbing */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center transition-all shadow-md shadow-amber-500/20"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-black stroke-black" />
            ) : (
              <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
            )}
          </button>

          <button
            onClick={handleRestart}
            className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-all"
            title="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleSkip(-2)}
            className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-all"
            title="Rewind 2s (Left Arrow)"
          >
            <Rewind className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleSkip(2)}
            className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-all"
            title="Forward 2s (Right Arrow)"
          >
            <FastForward className="w-4 h-4" />
          </button>

          {/* Time indicator */}
          <div className="font-mono text-xs font-semibold text-zinc-300 ml-2">
            <span className="text-amber-400">{formatTime(currentTime)}</span>
            <span className="text-zinc-600"> / </span>
            <span className="text-zinc-400">{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Center: Interactive Scrubber Slider */}
        <div className="flex-1 max-w-xl mx-2 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={Math.max(0.1, totalDuration)}
            step={0.05}
            value={currentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onTimeUpdate(val);
              const { panelIndex } = videoRenderer.getPanelAtTime(project, val);
              onSelectPanel(panelIndex);
            }}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:h-2 transition-all"
          />
        </div>

        {/* Right: Audio Volumes & Camera Path toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCameraGuide(!showCameraGuide)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all ${
              showCameraGuide 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                : 'text-zinc-400 border-zinc-800 hover:text-white'
            }`}
            title="Toggle Camera Pan/Zoom Info Overlay"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cam Info</span>
          </button>

          {/* BGM Volume Quick Slider */}
          <div className="hidden sm:flex items-center gap-1.5 text-zinc-400 text-xs">
            <Music className="w-3.5 h-3.5 text-amber-400" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={project.bgmVolume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                audioEngine.setVolumes(val, project.voiceVolume);
              }}
              className="w-16 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
              title="BGM Volume"
            />
          </div>

          {/* Voice Volume Quick Slider */}
          <div className="hidden sm:flex items-center gap-1.5 text-zinc-400 text-xs">
            <Mic className="w-3.5 h-3.5 text-blue-400" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={project.voiceVolume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                audioEngine.setVolumes(project.bgmVolume, val);
              }}
              className="w-16 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-blue-500"
              title="Voice Volume"
            />
          </div>

          {/* Master Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-all"
            title={isMuted ? 'Unmute' : 'Mute Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-zinc-300" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
