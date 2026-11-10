import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Flame, 
  Loader2, 
  BookOpen, 
  Zap, 
  MessageSquare, 
  Wand2, 
  Gauge, 
  Activity, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Clock, 
  Sliders, 
  ScanText, 
  AlertCircle,
  Eye,
  Mic,
  Search,
  Check
} from 'lucide-react';
import { ProjectSettings, Panel } from '../types/manhwa';
import { localAiEngine } from '../services/localAiEngine';
import { 
  requestVisualComplexityAnalysis, 
  PanelVisualComplexityAnalysis, 
  convertImageUrlToBase64,
  requestDetectPremiseFromImages,
  requestSegmentedChapterGeneration,
  requestTtsAudio,
  DetectedPremiseData
} from '../services/geminiClient';

interface ScriptGeneratorModalProps {
  project: ProjectSettings;
  isOpen: boolean;
  onClose: () => void;
  onApplyGeneratedScript: (panels: Panel[], title: string) => void;
}

export const ScriptGeneratorModal: React.FC<ScriptGeneratorModalProps> = ({
  project,
  isOpen,
  onClose,
  onApplyGeneratedScript,
}) => {
  // Check if title is carrying over stale sample project placeholder
  const isSampleTitle = /cleaner|dustpan|janitor|necromancer|bed/i.test(project.title);
  const initialTitle = isSampleTitle ? 'Uploaded Manhwa Chapter' : (project.title || 'Manhwa Chapter');

  const [chapterTitle, setChapterTitle] = useState(initialTitle);
  const [genre, setGenre] = useState('Action Fantasy Dungeon Manhwa');
  const [tone, setTone] = useState(
    project.recapMode === 'simple'
      ? 'Simple Recap (Clean, Focused Storytelling, No SFX, Smooth Fades)'
      : 'Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy, roasts tropes)'
  );
  const [panelCount, setPanelCount] = useState(Math.max(1, project.panels.length || 5));
  const [userNotes, setUserNotes] = useState(
    'Study what is actually happening in the images: read all speech bubbles, character names, and system screens. Avoid generic tropes.'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto-voice synthesis toggle
  const [autoSynthesizeVoice, setAutoSynthesizeVoice] = useState(true);

  // Premise detection state
  const [isDetectingPremise, setIsDetectingPremise] = useState(false);
  const [detectedPremise, setDetectedPremise] = useState<DetectedPremiseData | null>(null);

  // Visual Complexity & Frame Intensity AI Analysis States
  const [isAnalyzingComplexity, setIsAnalyzingComplexity] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [visualAnalysisData, setVisualAnalysisData] = useState<PanelVisualComplexityAnalysis[] | null>(null);
  const [syncPacingToVisuals, setSyncPacingToVisuals] = useState<boolean>(true);
  const [showAnalysisBreakdown, setShowAnalysisBreakdown] = useState<boolean>(true);

  // Keep panelCount in sync if project panels changed
  useEffect(() => {
    if (project.panels.length > 0) {
      setPanelCount(project.panels.length);
    }
  }, [project.panels.length]);

  if (!isOpen) return null;

  // 1-Click Vision Premise & Dialogue Detection
  const handleDetectPremiseFromImages = async () => {
    if (project.panels.length === 0) {
      setError('Please add at least 1 manhwa panel to detect premise.');
      return;
    }

    setIsDetectingPremise(true);
    setError(null);
    try {
      const samplePanels = project.panels.slice(0, 4);
      const converted: Array<{ base64: string; mimeType: string }> = [];

      for (const p of samplePanels) {
        if (p.imageUrl) {
          const b64 = await convertImageUrlToBase64(p.imageUrl);
          converted.push({ base64: b64, mimeType: 'image/jpeg' });
        }
      }

      if (converted.length === 0) {
        throw new Error('No valid images found in project panels.');
      }

      const premiseData = await requestDetectPremiseFromImages(converted);
      setDetectedPremise(premiseData);

      if (premiseData.detectedTitle) {
        setChapterTitle(premiseData.detectedTitle);
      }
      if (premiseData.genre) {
        setGenre(premiseData.genre);
      }
      if (premiseData.suggestedDirectorTweaks) {
        setUserNotes(premiseData.suggestedDirectorTweaks);
      }
    } catch (err: any) {
      console.warn('Premise detection warning:', err);
      setError(err.message || 'Could not detect premise from images.');
    } finally {
      setIsDetectingPremise(false);
    }
  };

  // Run AI Vision analysis on each manhwa panel to calculate visual complexity & ideal dialogue duration
  const handleAnalyzeVisualComplexity = async () => {
    if (project.panels.length === 0) {
      setError('Please add or load at least 1 manhwa panel first to analyze visual complexity.');
      return;
    }

    setIsAnalyzingComplexity(true);
    setAnalysisStatus('Preparing panel images for AI Vision analysis...');
    setError(null);

    try {
      const panelsToScan = project.panels.slice(0, panelCount);
      const convertedPanels: Array<{ id: string; imageBase64: string; title?: string }> = [];

      for (let i = 0; i < panelsToScan.length; i++) {
        setAnalysisStatus(`Converting panel image ${i + 1} of ${panelsToScan.length}...`);
        const p = panelsToScan[i];
        const base64 = await convertImageUrlToBase64(p.imageUrl);
        convertedPanels.push({
          id: p.id,
          imageBase64: base64,
          title: p.title,
        });
      }

      setAnalysisStatus('AI analyzing visual complexity, action density & dialogue pacing with Gemini 3.8 Flash Vision...');
      const analyses = await requestVisualComplexityAnalysis({
        panels: convertedPanels,
        chapterTitle,
        tone,
      });

      setVisualAnalysisData(analyses);
      setShowAnalysisBreakdown(true);

      const pacingSummary = analyses
        .map((a) => `• Panel ${a.panelIndex + 1}: ${a.complexityLevel.toUpperCase()} Complexity (${a.visualComplexityScore}/10) -> Suggested: ${a.suggestedDurationSeconds}s | ${a.pacingRecommendation}`)
        .join('\n');
      
      setUserNotes((prev) => {
        const cleanPrev = prev.replace(/\n\nVisual Complexity Pacing Guidelines:[\s\S]*$/, '').trim();
        return `${cleanPrev}\n\nVisual Complexity Pacing Guidelines:\n${pacingSummary}`;
      });
    } catch (err: any) {
      console.warn('Visual complexity analysis warning:', err);
      setError(err.message || 'Could not complete visual complexity analysis.');
    } finally {
      setIsAnalyzingComplexity(false);
      setAnalysisStatus('');
    }
  };

  // Generate unique script by feeding actual images and speech bubbles to Gemini Flash Vision
  const handleGenerate = async () => {
    setIsLoading(true);
    setLoadingStatus('Preparing images for AI vision & OCR analysis...');
    setError(null);

    try {
      const targetPanels = project.panels.slice(0, panelCount);
      if (targetPanels.length === 0) {
        throw new Error('No panels found to generate script for.');
      }

      // 1. Convert all panel images to base64
      const imagePayload: Array<{ base64: string; mimeType: string }> = [];
      for (let i = 0; i < targetPanels.length; i++) {
        setLoadingStatus(`Reading panel image ${i + 1} of ${targetPanels.length}...`);
        const p = targetPanels[i];
        const b64 = await convertImageUrlToBase64(p.imageUrl);
        imagePayload.push({
          base64: b64,
          mimeType: 'image/jpeg',
        });
      }

      // 2. Run visual complexity analysis if active
      let activeAnalyses = visualAnalysisData;
      if (!activeAnalyses && syncPacingToVisuals) {
        try {
          setLoadingStatus('Analyzing frame visual intensity & target durations...');
          const convertedForComp = targetPanels.map((p, idx) => ({
            id: p.id,
            imageBase64: imagePayload[idx].base64,
            title: p.title,
          }));
          activeAnalyses = await requestVisualComplexityAnalysis({
            panels: convertedForComp,
            chapterTitle,
            tone,
          });
          setVisualAnalysisData(activeAnalyses);
        } catch (e) {
          console.warn('Background complexity analysis skipped:', e);
        }
      }

      // 3. Multi-segment chained vision script generation directly from images & text bubbles
      setLoadingStatus('Studying image details, character actions & reading speech bubbles with Gemini Vision...');
      
      const generatedScripts = await requestSegmentedChapterGeneration({
        images: imagePayload,
        chapterTitle,
        tone,
        userNotes: userNotes + ' (Study what is actually happening in the images. Read speech bubbles with OCR. Zero generic clichés.)',
        segmentSize: 4,
        onProgress: (msg) => setLoadingStatus(msg),
      });

      if (!generatedScripts || generatedScripts.length === 0) {
        throw new Error('AI could not generate scripts from the panel images.');
      }

      // 4. Assemble updated panels
      const isSimple = tone.toLowerCase().includes('simple');
      const updatedPanels: Panel[] = [];

      for (let idx = 0; idx < targetPanels.length; idx++) {
        const existing = targetPanels[idx];
        const gen = generatedScripts[idx] || generatedScripts[0];
        const analysis = activeAnalyses?.find(a => a.panelIndex === idx || a.panelId === existing?.id);

        const rawWords = (gen.commentary || '').split(/\s+/).filter(Boolean);

        // Strict duration match to visual complexity
        const duration = (syncPacingToVisuals && analysis?.suggestedDurationSeconds)
          ? analysis.suggestedDurationSeconds
          : (gen.durationSeconds || Math.max(3.8, Math.min(8.5, rawWords.length * 0.42)));

        const wordDur = duration / Math.max(1, rawWords.length);

        const subtitles = gen.subtitles || rawWords.map((w, wIdx) => ({
          text: w,
          startTime: Math.round(wIdx * wordDur * 100) / 100,
          endTime: Math.round((wIdx + 1) * wordDur * 100) / 100,
          isPunch: !isSimple && (/^[A-Z0-9!]{3,}|bro|wait|dead|what|he|him|fr/i.test(w) || w.includes('!') || w.includes('?')),
        }));

        let camera = isSimple ? {
          type: 'slow-drift' as any,
          start: { x: 0.5, y: 0.45, zoom: 1.05 },
          end: { x: 0.5, y: 0.55, zoom: 1.15 },
          shakeIntensity: 0,
          easing: 'ease-in-out' as any,
        } : (existing?.camera || {
          type: (analysis?.complexityLevel === 'extreme' || analysis?.complexityLevel === 'high') ? 'crash-zoom' : 'slow-drift',
          start: { x: 0.5, y: 0.45, zoom: 1.05 },
          end: { x: 0.5, y: 0.55, zoom: (analysis?.complexityLevel === 'extreme' ? 1.55 : 1.25) },
          shakeIntensity: analysis?.complexityLevel === 'extreme' ? 0.7 : (analysis?.complexityLevel === 'high' ? 0.4 : 0),
          easing: 'punch',
        });

        if (!isSimple && gen.suggestedCamera) {
          camera = {
            ...camera,
            type: gen.suggestedCamera as any,
          };
        }

        // 5. Optional automatic TTS voiceover synthesis for clean audio
        let audioBase64: string | undefined = undefined;
        if (autoSynthesizeVoice && gen.commentary) {
          setLoadingStatus(`🎙️ Synthesizing clean AI voiceover for panel ${idx + 1}/${targetPanels.length}...`);
          try {
            const persona = existing.voiceSettings?.voicePersona || project.voicePersona || 'Puck';
            const style = isSimple 
              ? 'Clear immersive audiobook storytelling' 
              : 'Energetic comedic YouTube manhwa recap narrator breaking the fourth wall';
            audioBase64 = await requestTtsAudio(gen.commentary, persona, style);
          } catch (ttsErr) {
            console.warn(`Voice synthesis skipped for panel ${idx + 1}:`, ttsErr);
          }
        }

        updatedPanels.push({
          id: existing?.id || 'gen_' + Date.now() + '_' + idx,
          title: gen.title || existing?.title || `Panel ${idx + 1}`,
          imageUrl: existing?.imageUrl,
          duration,
          detectedDialogue: gen.detectedDialogue || analysis?.detectedDialogue || existing?.detectedDialogue || '',
          commentary: gen.commentary,
          camera,
          transition: isSimple ? 'fade' : (existing?.transition || (idx % 2 === 0 ? 'white-flash' : 'glitch')),
          soundEffect: isSimple ? 'none' : ((gen.soundEffect as any) || (analysis?.complexityLevel === 'extreme' ? 'anime-punch' : 'vine-boom')),
          soundEffectTime: 1.0,
          audioBase64: audioBase64 || (autoSynthesizeVoice ? undefined : existing.audioBase64),
          subtitles,
        });
      }

      onApplyGeneratedScript(updatedPanels, chapterTitle);
      onClose();
    } catch (err: any) {
      console.error('Script generation failed:', err);
      setError(err.message || 'Failed to generate recap script');
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const totalCalculatedDuration = visualAnalysisData
    ? visualAnalysisData.reduce((sum, a) => sum + a.suggestedDurationSeconds, 0)
    : 0;

  const avgComplexity = visualAnalysisData && visualAnalysisData.length > 0
    ? (visualAnalysisData.reduce((sum, a) => sum + a.visualComplexityScore, 0) / visualAnalysisData.length).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#10101a] border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#141422] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white font-['Cabinet_Grotesk'] tracking-wide">
                IMAGE-GROUNDED RECAP SCRIPT & PACING GENERATOR
              </h2>
              <p className="text-xs text-zinc-400">
                Studies panel art, OCR reads speech bubbles, and generates bespoke commentary
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
        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          {/* Quick Auto-Detect Premise from Images Banner */}
          <div className="p-3 bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-zinc-900 rounded-xl border border-blue-500/30 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                <Search className="w-3.5 h-3.5 text-blue-400" />
                <span>Auto-Detect Story & Dialogue from Current Images</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                AI analyzes your uploaded pictures, transcribes the bubbles, and detects the true plot and protagonist.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDetectPremiseFromImages}
              disabled={isDetectingPremise || project.panels.length === 0}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 disabled:opacity-50"
            >
              {isDetectingPremise ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Detect from Images</span>
                </>
              )}
            </button>
          </div>

          {/* Premise detection info card if available */}
          {detectedPremise && (
            <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-800/40 text-[11px] space-y-1 text-zinc-300">
              <div className="font-bold text-blue-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Detected: {detectedPremise.detectedTitle || 'Manhwa Chapter'} ({detectedPremise.genre})</span>
              </div>
              {detectedPremise.premise && (
                <p className="text-zinc-400 text-[10px] leading-relaxed">
                  <strong>Premise:</strong> {detectedPremise.premise}
                </p>
              )}
              {detectedPremise.currentSituation && (
                <p className="text-zinc-400 text-[10px] leading-relaxed">
                  <strong>Scene:</strong> {detectedPremise.currentSituation}
                </p>
              )}
            </div>
          )}

          {/* Title input */}
          <div>
            <label className="font-bold text-zinc-300 block mb-1">Manhwa / Webtoon Title</label>
            <input
              type="text"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder="e.g. Slay Nether Ghouls (Solo Dungeon Raid)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-400 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-zinc-300 block mb-1">Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. Action Fantasy Hunter, Murim, Dungeon"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-zinc-300 block mb-1">Panels Count to Recap</label>
              <select
                value={panelCount}
                onChange={(e) => setPanelCount(parseInt(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-400 text-xs"
              >
                <option value={project.panels.length}>All {project.panels.length} Project Panels (Recommended)</option>
                <option value={Math.min(3, project.panels.length)}>First 3 Panels</option>
                <option value={Math.min(5, project.panels.length)}>First 5 Panels</option>
                <option value={Math.min(8, project.panels.length)}>First 8 Panels</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-zinc-300 block mb-1 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Commentary Flavor & Humor Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-400 text-xs font-medium"
            >
              <option value="Simple Recap (Clean, Focused Storytelling, No SFX, Smooth Fades)">
                ⚡ Simple Recap (Immersive Narrative, No SFX, Clean Voiceover)
              </option>
              <option value="Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy, roasts tropes)">
                🔥 Unhinged Mamoru (4th wall roasts, "Chat look at bro", Meme heavy)
              </option>
              <option value="Sarcastic Anime Critic (Deadpan roasts, power scaling jokes)">
                💀 Sarcastic Critic (Deadpan delivery, questions power scaling)
              </option>
              <option value="Hype Shonen Bro (Screaming hype into sudden comedy cuts)">
                ⚡ Hype Shonen Bro (Extreme hype with sudden comedic reactions)
              </option>
            </select>
          </div>

          {/* Visual Complexity & Frame Intensity AI Analysis */}
          <div className="p-4 bg-gradient-to-r from-blue-950/30 via-indigo-950/20 to-purple-950/25 rounded-2xl border border-blue-500/35 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    Visual Complexity & Dynamic Pacing
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    Calculates combat intensity and suggests exact dialogue duration per frame
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAnalyzeVisualComplexity}
                disabled={isAnalyzingComplexity || project.panels.length === 0}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/25"
              >
                {isAnalyzingComplexity ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Frames...</span>
                  </>
                ) : (
                  <>
                    <ScanText className="w-3.5 h-3.5 text-blue-200" />
                    <span>{visualAnalysisData ? 'Re-Analyze Frames' : 'Analyze Frame Intensity'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Analysis Progress Banner */}
            {isAnalyzingComplexity && (
              <div className="p-2.5 rounded-xl bg-blue-950/50 border border-blue-500/40 flex items-center gap-2.5 text-blue-200 text-xs animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                <span className="font-mono text-[11px]">{analysisStatus}</span>
              </div>
            )}

            {/* Visual Analysis Results Breakdown */}
            {visualAnalysisData && visualAnalysisData.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-blue-900/40">
                <div className="flex items-center justify-between bg-black/60 p-2.5 rounded-xl border border-blue-900/40 text-[11px]">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-300">
                      <strong>{visualAnalysisData.length}</strong> Frames Scanned
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-amber-400">
                      Avg Complexity: <strong>{avgComplexity}/10</strong>
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-blue-300">
                      Total Pacing: <strong>{totalCalculatedDuration.toFixed(1)}s</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAnalysisBreakdown(!showAnalysisBreakdown)}
                    className="text-zinc-400 hover:text-white flex items-center gap-1 text-[10px] font-bold"
                  >
                    <span>{showAnalysisBreakdown ? 'Hide Breakdown' : 'Show Breakdown'}</span>
                    {showAnalysisBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {showAnalysisBreakdown && (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {visualAnalysisData.map((item, idx) => {
                      const panelObj = project.panels[item.panelIndex] || project.panels[idx];
                      const isHigh = item.visualComplexityScore >= 7;
                      const isLow = item.visualComplexityScore <= 3;

                      return (
                        <div 
                          key={idx}
                          className="p-2.5 rounded-xl bg-black/50 border border-zinc-800 flex items-start gap-3 hover:border-blue-500/30 transition-all text-[11px]"
                        >
                          {panelObj?.imageUrl ? (
                            <div className="w-10 h-12 rounded-lg overflow-hidden border border-zinc-700 shrink-0 bg-zinc-900">
                              <img src={panelObj.imageUrl} alt={`Panel ${idx + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-12 rounded-lg border border-zinc-700 shrink-0 bg-zinc-900 flex items-center justify-center font-mono font-bold text-zinc-500">
                              #{idx + 1}
                            </div>
                          )}

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">Panel #{idx + 1}</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase font-mono ${
                                  isHigh 
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                                    : isLow 
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}>
                                  Score: {item.visualComplexityScore}/10 ({item.complexityLevel})
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold font-mono">
                                  ⏱️ {item.suggestedDurationSeconds.toFixed(1)}s
                                </span>
                                <span className="text-[10px] text-zinc-400">
                                  (~{item.suggestedWordCount} words)
                                </span>
                              </div>
                            </div>

                            <p className="text-zinc-300 text-[10px] leading-tight">
                              <strong>Visual:</strong> {item.visualDescription}
                            </p>

                            <p className="text-zinc-400 text-[10px] leading-tight font-mono">
                              <strong>Pacing Rationale:</strong> {item.pacingRationale}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Synchronization Toggle Checkbox */}
            <div className="flex flex-col gap-2 pt-1 border-t border-zinc-800/80">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncPacingToVisuals}
                  onChange={(e) => setSyncPacingToVisuals(e.target.checked)}
                  className="accent-blue-500 rounded"
                />
                <span className="text-zinc-200 font-semibold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  Synchronize voiceover duration & word count to frame visual intensity
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSynthesizeVoice}
                  onChange={(e) => setAutoSynthesizeVoice(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span className="text-zinc-200 font-semibold text-xs flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-amber-400" />
                  Automatically synthesize AI voiceover audio immediately for new commentary
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="font-bold text-zinc-300 block mb-1">Director Notes & Tweaks</label>
            <textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Focus on the Nether Ghoul battle in the corridor, call out the blue dagger aura, roast the crazy 300,000 EXP bonus..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-zinc-200 focus:outline-none focus:border-amber-400 text-xs resize-none leading-relaxed"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#141422] border-t border-zinc-800 flex items-center justify-between">
          <div className="text-[11px] text-zinc-400">
            {isLoading ? (
              <span className="text-amber-400 font-bold flex items-center gap-1.5 animate-pulse font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{loadingStatus || 'Processing with Gemini Flash Vision...'}</span>
              </span>
            ) : visualAnalysisData ? (
              <span className="text-blue-300 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Visual complexity synced ({totalCalculatedDuration.toFixed(1)}s total)
              </span>
            ) : (
              <span>AI studies actual image pixels & speech bubbles</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isLoading || isAnalyzingComplexity}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleGenerate}
              disabled={isLoading || isAnalyzingComplexity}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Script...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5 text-black" />
                  <span>Generate Recap from Images</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
