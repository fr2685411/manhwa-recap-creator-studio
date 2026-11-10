import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Sparkles, 
  Flame, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Trash2,
  Wand2,
  Layers,
  Zap,
  Volume2,
  Download,
  Search,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';
import { Panel, ProjectSettings } from '../types/manhwa';
import { extractPagesFromPdf, ExtractedPage } from '../services/pdfReader';
import { 
  requestChapterGenerationFromImages, 
  requestSegmentedChapterGeneration,
  requestDetectPremiseFromImages,
  DetectedPremiseData,
  requestTtsAudio 
} from '../services/geminiClient';
import { localAiEngine } from '../services/localAiEngine';
import { SAMPLE_PROJECTS } from '../data/sampleChapters';
import { audioEngine } from '../services/audioEngine';

interface AutoRecapWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyProject: (newPanels: Panel[], title: string, bgmTrack?: any) => void;
  voicePersona: 'Puck' | 'Fenrir' | 'Zephyr' | 'Kore' | 'Charon';
}

export const AutoRecapWizardModal: React.FC<AutoRecapWizardModalProps> = ({
  isOpen,
  onClose,
  onApplyProject,
  voicePersona,
}) => {
  const [selectedFileSource, setSelectedFileSource] = useState<'pdf' | 'images'>('pdf');
  const [extractedPanels, setExtractedPanels] = useState<Array<{ id: string; dataUrl: string; selected: boolean }>>([]);
  const [chapterTitle, setChapterTitle] = useState('Reincarnated as SSS-Rank Hunter');
  const [humorTone, setHumorTone] = useState('Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy, roasts tropes)');
  const [autoGenerateVoice, setAutoGenerateVoice] = useState(true);
  const [disableShake, setDisableShake] = useState(false);
  const [userNotes, setUserNotes] = useState('Roast the tropes, call out the overpowered main character, and question the artist\'s anatomy.');
  
  // AI Premise Detection & Tweaks state
  const [isDetectingPremise, setIsDetectingPremise] = useState(false);
  const [detectedPremiseData, setDetectedPremiseData] = useState<DetectedPremiseData | null>(null);
  const [generatedPanelsPreview, setGeneratedPanelsPreview] = useState<Panel[] | null>(null);

  // Progress states
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusStep, setStatusStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle PDF upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);
    setStatusStep(`Extracting pages from PDF (${file.name})...`);

    try {
      setChapterTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
      const pages = await extractPagesFromPdf(file, {
        maxPages: 10,
        scale: 1.3,
        onProgress: (cur, tot) => {
          setStatusStep(`Extracting PDF page ${cur} of ${tot}...`);
        },
      });

      setExtractedPanels(
        pages.map((p, i) => ({
          id: `page_${i + 1}`,
          dataUrl: p.dataUrl,
          selected: true,
        }))
      );
    } catch (err: any) {
      console.error('PDF extraction failed:', err);
      setError(err.message || 'Failed to extract pages from PDF.');
    } finally {
      setIsProcessing(false);
      setStatusStep('');
    }
  };

  // Handle multi-image upload
  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsProcessing(true);
    setStatusStep('Loading images...');

    const newItems: Array<{ id: string; dataUrl: string; selected: boolean }> = [];
    let count = 0;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          newItems.push({
            id: `img_${Date.now()}_${index}`,
            dataUrl: event.target.result as string,
            selected: true,
          });
        }
        count++;
        if (count === files.length) {
          setExtractedPanels((prev) => [...prev, ...newItems]);
          setIsProcessing(false);
          setStatusStep('');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Load sample demo pages immediately for testing
  const handleLoadDemoPages = () => {
    const demoSample = SAMPLE_PROJECTS['janitor-hunter'];
    if (demoSample) {
      setChapterTitle('The Legend of the SSS-Rank Floor Cleaner');
      setExtractedPanels(
        demoSample.panels.map((p, i) => ({
          id: `demo_${i}`,
          dataUrl: p.imageUrl,
          selected: true,
        }))
      );
    }
  };

  // Toggle selection of individual panel
  const toggleSelectPanel = (index: number) => {
    setExtractedPanels((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selected: !copy[index].selected };
      return copy;
    });
  };

  // Delete a panel
  const deletePanel = (index: number) => {
    setExtractedPanels((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-detect manhwa premise, characters, and chapter context from sample images
  const handleAutoDetectPremise = async () => {
    const activePanels = extractedPanels.filter((p) => p.selected);
    if (activePanels.length === 0) {
      setError('Please upload or select at least 1 image first to detect the story premise.');
      return;
    }

    setIsDetectingPremise(true);
    setError(null);

    try {
      const sample = activePanels.slice(0, 4).map((p) => ({
        base64: p.dataUrl,
        mimeType: p.dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
      }));

      const detected = await requestDetectPremiseFromImages(sample);
      setDetectedPremiseData(detected);

      if (detected.detectedTitle && detected.detectedTitle.trim()) {
        setChapterTitle(detected.detectedTitle.trim());
      }

      const noteParts: string[] = [];
      if (detected.premise) {
        noteParts.push(`Premise: ${detected.premise}`);
      }
      if (detected.characters && detected.characters.length > 0) {
        noteParts.push(`Characters: ${detected.characters.join(', ')}`);
      }
      if (detected.currentSituation) {
        noteParts.push(`Current Scene: ${detected.currentSituation}`);
      }
      if (detected.suggestedDirectorTweaks) {
        noteParts.push(`Director Tweaks: ${detected.suggestedDirectorTweaks}`);
      }

      setUserNotes(noteParts.join('\n\n'));
    } catch (err: any) {
      console.warn('Premise detection warning:', err);
      setError(err.message || 'Could not auto-detect premise. You can manually enter notes below.');
    } finally {
      setIsDetectingPremise(false);
    }
  };

  // Export all voiceover script lines into a single clean text file (.txt)
  const handleExportVoiceLinesTxt = (panelsToExport: Panel[]) => {
    if (!panelsToExport || panelsToExport.length === 0) return;

    let content = `========================================================\n`;
    content += `MANHWA RECAP STORY SCRIPT: ${chapterTitle || 'Chapter Recap'}\n`;
    content += `Voice Persona: ${voicePersona} | Total Panels: ${panelsToExport.length}\n`;
    const totalSec = panelsToExport.reduce((s, p) => s + p.duration, 0);
    content += `Estimated Duration: ~${totalSec.toFixed(1)}s\n`;
    content += `========================================================\n\n`;

    content += `--- SCENE-BY-SCENE TIMED VOICEOVER SCRIPT ---\n\n`;
    let accumulated = 0;
    panelsToExport.forEach((p, idx) => {
      const startMin = Math.floor(accumulated / 60);
      const startSec = Math.floor(accumulated % 60).toString().padStart(2, '0');
      accumulated += p.duration;
      const endMin = Math.floor(accumulated / 60);
      const endSec = Math.floor(accumulated % 60).toString().padStart(2, '0');

      content += `[PANEL ${idx + 1}] (${startMin}:${startSec} - ${endMin}:${endSec} | ${p.duration.toFixed(1)}s) - "${p.title}"\n`;
      if (p.detectedDialogue) {
        content += `DIALOGUE IN IMAGE: ${p.detectedDialogue}\n`;
      }
      content += `VOICEOVER NARRATION:\n"${p.commentary || ''}"\n\n`;
    });

    content += `\n========================================================\n`;
    content += `CLEAN TTS-ONLY LINES (FOR ELEVENLABS / EDGE-TTS / KOKORO):\n`;
    content += `========================================================\n`;
    panelsToExport.forEach((p) => {
      if (p.commentary && p.commentary.trim()) {
        content += `${p.commentary.trim()}\n`;
      }
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(chapterTitle || 'manhwa_recap').replace(/[^a-zA-Z0-9_-]/g, '_')}_all_voice_lines.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export merged audio (.wav) combining all synthesized voiceover clips into one single file
  const handleExportMergedAudio = async (panelsToExport: Panel[]) => {
    const panelsWithVoice = panelsToExport.filter((p) => p.audioBase64);
    if (panelsWithVoice.length === 0) {
      alert('No synthesized voice clips found. Please enable "Synthesize with Gemini TTS" during recap generation.');
      return;
    }

    try {
      setStatusStep('🎵 Merging all panel voiceover audio into one file...');
      const blob = await audioEngine.exportMergedVoiceoverWav(panelsToExport);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(chapterTitle || 'manhwa_recap').replace(/[^a-zA-Z0-9_-]/g, '_')}_merged_voiceover.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.warn('Audio merge error:', err);
      alert('Could not merge audio: ' + err.message);
    }
  };

  // Run End-to-End AI Recap Generation from the images using Segmented Multi-Batch processing
  const handleGenerateRecapVideo = async () => {
    const activePanels = extractedPanels.filter((p) => p.selected);
    if (activePanels.length === 0) {
      setError('Please select at least 1 image or page to generate the recap video.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setGeneratedPanelsPreview(null);

    try {
      const visionPayload = activePanels.map((p) => ({
        base64: p.dataUrl,
        mimeType: p.dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
      }));

      // High-precision segmented multimodal generation (3-4 images per segment)
      const engine = localAiEngine.getActiveEngine();
      let generatedScripts: any[] = [];

      if (engine === 'local-ollama' || engine === 'in-browser-model') {
        try {
          setStatusStep(`🦙 Generating recap using ${engine}...`);
          generatedScripts = await localAiEngine.generateRecapScriptUnified({
            chapterTitle,
            tone: humorTone,
            userNotes,
            panelDescriptions: activePanels.map((_, idx) => `Chapter Page/Panel ${idx + 1}`),
            images: activePanels.map((p) => p.dataUrl),
          });
        } catch (localErr: any) {
          console.warn('Local model failed, falling back to Gemini Vision segments:', localErr);
        }
      }

      if (generatedScripts.length === 0) {
        generatedScripts = await requestSegmentedChapterGeneration({
          images: visionPayload,
          chapterTitle,
          tone: humorTone,
          userNotes,
          segmentSize: 4, // 4 panels per segment ensures focused OCR & zero generic fluff
          onProgress: (msg, cur, tot) => {
            setStatusStep(`[Segment ${cur}/${tot}] ${msg}`);
          },
        });
      }

      setStatusStep('✍️ Choreographing kinetic camera pan & zoom, punchline SFX, and subtitles...');

      // Build complete Panels sequence
      const finalPanels: Panel[] = [];
      const isSimpleRecap = humorTone.toLowerCase().includes('simple');

      const defaultRoasts = isSimpleRecap ? [
        `Here in this scene, our characters advance forward as the situation escalates rapidly.`,
        `Examining the action carefully, the team encounters high-intensity resistance along the path.`,
        `With focused determination, our lead pushes forward through the intense corridor engagement.`,
        `The clash intensifies as each ability is unleashed against the opposing force.`,
        `Securing the objective, the immediate threat is resolved, setting the stage for what comes next.`,
      ] : [
        `Chat, look at what is happening right here in this scene! Look at that stance!`,
        `Wait, check out the aura and effects right here! Bro is not playing around today!`,
        `Look at the battle happening in this corridor, the energy scaling is completely off the charts!`,
        `Chat, look at that reaction face right there! Absolutely unhinged!`,
        `Look at how this sequence plays out! You already know things are about to get chaotic!`,
      ];

      for (let i = 0; i < activePanels.length; i++) {
        const item = activePanels[i];
        const script = generatedScripts[i] || {
          title: `Scene ${i + 1}`,
          commentary: defaultRoasts[i % defaultRoasts.length],
          suggestedCamera: isSimpleRecap ? 'slow-drift' : (i % 2 === 0 ? 'crash-zoom' : 'pan-down'),
          soundEffect: isSimpleRecap ? 'none' : (i === 0 ? 'record-scratch' : 'vine-boom'),
          transition: isSimpleRecap ? 'fade' : (i % 2 === 0 ? 'white-flash' : 'glitch'),
          durationSeconds: 5.2,
        };

        const rawWords = (script.commentary || '').split(/\s+/).filter(Boolean);
        const duration = script.durationSeconds || Math.max(4.5, Math.min(8.0, rawWords.length * 0.45));
        const wordDur = duration / Math.max(1, rawWords.length);

        const subtitles = rawWords.map((w: string, wIdx: number) => ({
          text: w,
          startTime: Math.round(wIdx * wordDur * 100) / 100,
          endTime: Math.round((wIdx + 1) * wordDur * 100) / 100,
          isPunch: !isSimpleRecap && (/^[A-Z0-9!]{3,}|bro|wait|dead|what|he|him|fr/i.test(w) || w.includes('!') || w.includes('?')),
        }));

        const shouldDisableShake = Boolean(isSimpleRecap || disableShake);
        let camera = shouldDisableShake ? {
          type: 'slow-drift' as any,
          start: { x: 0.5, y: 0.45, zoom: 1.05 },
          end: { x: 0.5, y: 0.55, zoom: 1.15 },
          shakeIntensity: 0,
          shakeTime: 0,
          easing: 'ease-in-out' as any,
        } : {
          type: (script.suggestedCamera as any) || (i % 2 === 0 ? 'crash-zoom' : 'pan-down'),
          start: { x: 0.5, y: 0.35, zoom: 1.1 },
          end: { x: 0.5, y: 0.65, zoom: 1.45 },
          shakeIntensity: script.suggestedCamera === 'shake-impact' ? 0.9 : 0.4,
          shakeTime: 1.2,
          easing: (script.suggestedCamera === 'crash-zoom' ? 'punch' : 'ease-in-out') as any,
        };

        let audioBase64: string | undefined = undefined;

        // Step 3: Optional voice synthesis via Gemini TTS
        if (autoGenerateVoice && script.commentary) {
          setStatusStep(`🎙️ Synthesizing AI Voiceover for panel ${i + 1} of ${activePanels.length}...`);
          try {
            audioBase64 = await requestTtsAudio(
              script.commentary,
              voicePersona,
              'Energetic comedic YouTube manhwa recap narrator breaking the fourth wall'
            );
          } catch (e) {
            console.warn('Voice synthesis skipped for panel:', i, e);
          }
        }

        finalPanels.push({
          id: `recap_panel_${Date.now()}_${i}`,
          title: script.commentary ? (script.commentary.slice(0, 24) + '...') : `Panel ${i + 1}`,
          imageUrl: item.dataUrl,
          duration,
          detectedDialogue: script.detectedDialogue || '',
          commentary: script.commentary,
          camera,
          disableShake: shouldDisableShake,
          transition: (script as any).transition || (i % 2 === 0 ? 'white-flash' : 'glitch'),
          soundEffect: (script.soundEffect as any) || (i === 0 ? 'record-scratch' : 'vine-boom'),
          soundEffectTime: 1.0,
          audioBase64,
          voiceSettings: {
            volume: 1.0,
            speed: 1.0,
            pitch: 0,
            startOffset: 0.0,
            fadeIn: 0.05,
            fadeOut: 0.05,
            isMuted: false,
            voicePersona: voicePersona,
            stylePrompt: 'Energetic comedic YouTube manhwa recap narrator breaking the fourth wall',
            eqFilter: 'clean',
          },
          subtitles,
        });
      }

      setStatusStep('🎬 Assembling recap video sequence...');
      onApplyProject(finalPanels, chapterTitle, 'phonk-combat');
      onClose();
    } catch (err: any) {
      console.error('Failed to generate video from chapter images:', err);
      setError(err.message || 'Failed to generate recap video from images.');
    } finally {
      setIsProcessing(false);
      setStatusStep('');
    }
  };

  const activeCount = extractedPanels.filter((p) => p.selected).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#10101a] border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#141422] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-red-500 to-amber-300 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-[#12121a] rounded-[10px] flex items-center justify-center text-amber-400">
                <Wand2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white font-['Cabinet_Grotesk'] tracking-wide">
                  AUTO-RECAP FROM MANHWA CHAPTER
                </h2>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-black text-[10px] border border-amber-500/30">
                  AI VISION + TTS
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Upload a Manhwa PDF or chapter screenshots &rarr; Gemini reads the panels &rarr; Generates video with 4th-wall script, camera pan/zoom & voice!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Step 1: Upload Source Toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-zinc-200">1. Select Chapter Source File</label>
              <button
                onClick={handleLoadDemoPages}
                className="text-amber-400 text-[11px] font-bold hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Try with Sample Chapter Pages</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => setSelectedFileSource('pdf')}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                  selectedFileSource === 'pdf'
                    ? 'border-amber-400 bg-amber-500/15 text-white shadow-sm'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <FileText className="w-5 h-5 text-red-400" />
                <div className="text-left">
                  <div className="font-extrabold text-xs">Manhwa PDF File</div>
                  <div className="text-[10px] text-zinc-500">Auto-extracts chapter pages</div>
                </div>
              </button>

              <button
                onClick={() => setSelectedFileSource('images')}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                  selectedFileSource === 'images'
                    ? 'border-amber-400 bg-amber-500/15 text-white shadow-sm'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ImageIcon className="w-5 h-5 text-blue-400" />
                <div className="text-left">
                  <div className="font-extrabold text-xs">Multiple Image Files</div>
                  <div className="text-[10px] text-zinc-500">PNG / JPG screenshots</div>
                </div>
              </button>
            </div>

            {/* Dropzone */}
            {selectedFileSource === 'pdf' ? (
              <label className="border-2 border-dashed border-zinc-700 hover:border-amber-400/80 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-zinc-900/40 hover:bg-zinc-900/70 transition-all group">
                <FileText className="w-8 h-8 text-zinc-500 group-hover:text-amber-400 mb-2 transition-colors" />
                <span className="font-bold text-zinc-200">Click or drop your Manhwa chapter PDF</span>
                <span className="text-zinc-500 text-[11px] mt-1">Supports up to 10-15 pages per recap episode</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <label className="border-2 border-dashed border-zinc-700 hover:border-amber-400/80 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-zinc-900/40 hover:bg-zinc-900/70 transition-all group">
                <Upload className="w-8 h-8 text-zinc-500 group-hover:text-amber-400 mb-2 transition-colors" />
                <span className="font-bold text-zinc-200">Click or drop manga panel images</span>
                <span className="text-zinc-500 text-[11px] mt-1">Select multiple PNG, JPG, or WebP files in order</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImagesUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Extracted Panels Preview */}
          {extractedPanels.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-zinc-200">
                  2. Review Chapter Pages ({activeCount} of {extractedPanels.length} selected)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExtractedPanels(prev => prev.map(p => ({ ...p, selected: true })))}
                    className="text-amber-400 text-[11px] hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-zinc-600">&bull;</span>
                  <button
                    onClick={() => setExtractedPanels([])}
                    className="text-red-400 text-[11px] hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2.5 bg-black/70 rounded-xl border border-zinc-800">
                {extractedPanels.map((p, i) => (
                  <div
                    key={p.id}
                    onClick={() => toggleSelectPanel(i)}
                    className={`aspect-[3/4] rounded-lg overflow-hidden border cursor-pointer relative group transition-all ${
                      p.selected
                        ? 'border-amber-400 ring-2 ring-amber-400/40'
                        : 'border-zinc-800 opacity-40 hover:opacity-70'
                    }`}
                  >
                    <img src={p.dataUrl} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-mono font-bold">
                      #{i + 1}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePanel(i);
                      }}
                      className="absolute top-1 right-1 p-1 rounded bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Recap Style & AI Director Tweaks */}
          <div className="space-y-4 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-200 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                3. Story Context & AI Director Tweaks (Anti-Generic)
              </span>

              {/* Auto-Detect Premise from Uploaded Images Button */}
              <button
                type="button"
                onClick={handleAutoDetectPremise}
                disabled={isDetectingPremise || activeCount === 0}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/20"
                title="Uses Gemini 3.8 Flash Vision to inspect pictures, read text bubbles, and auto-detect what the manhwa is about"
              >
                {isDetectingPremise ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Detecting Story...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5 text-amber-300" />
                    <span>Auto-Detect Story from Pictures</span>
                  </>
                )}
              </button>
            </div>

            {/* Detected Story Premise Card (if detected) */}
            {detectedPremiseData && (
              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/60 text-xs space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-300 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Detected Story: {detectedPremiseData.detectedTitle || 'Manhwa Chapter'}</span>
                  </div>
                  {detectedPremiseData.genre && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-900/50 text-[10px] text-blue-200 font-mono">
                      {detectedPremiseData.genre}
                    </span>
                  )}
                </div>
                {detectedPremiseData.premise && (
                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    <strong className="text-zinc-400 font-medium">Premise:</strong> {detectedPremiseData.premise}
                  </p>
                )}
                {detectedPremiseData.characters && detectedPremiseData.characters.length > 0 && (
                  <div className="text-[11px] text-zinc-400">
                    <strong className="text-zinc-400 font-medium">Characters:</strong>{' '}
                    <span className="text-amber-300 font-semibold">{detectedPremiseData.characters.join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-zinc-400 block mb-1">Chapter / Video Title</label>
              <input
                type="text"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-400"
                placeholder="e.g. Solo Janitor God"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 block mb-1">Humor Flavor / Recap Mode</label>
                <select
                  value={humorTone}
                  onChange={(e) => setHumorTone(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="Simple Recap (Clean Storytelling, No Sound Effects, Smooth Fades)">
                    ⚡ Simple Recap (Clean Story, No SFX, Smooth Fades)
                  </option>
                  <option value="Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy, roasts tropes)">
                    🔥 Unhinged Mamoru (Audience roast & memes)
                  </option>
                  <option value="Sarcastic Anime Critic (Deadpan logic, questions power scaling)">
                    💀 Sarcastic Critic (Deadpan logic)
                  </option>
                  <option value="Hype Shonen Bro (Screaming hype into comedy cuts)">
                    ⚡ Hype Shonen (Fast energy & hype)
                  </option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">AI Voiceover (Gemini TTS)</label>
                <label className="flex items-center gap-2 h-8 px-2 bg-black border border-zinc-700 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGenerateVoice}
                    onChange={(e) => setAutoGenerateVoice(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span className="text-zinc-300 font-semibold text-xs">
                    Synthesize with Voice Persona ({voicePersona})
                  </span>
                </label>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Camera Shake Motion</label>
                <label className="flex items-center gap-2 h-8 px-2 bg-black border border-zinc-700 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={disableShake}
                    onChange={(e) => setDisableShake(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span className="text-zinc-300 font-semibold text-xs">
                    Disable Screen Shake (Smooth 16:9 Motion)
                  </span>
                </label>
              </div>
            </div>

            {/* Custom AI Director Tweaks & Story Notes Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-400 text-xs font-semibold flex items-center gap-1.5">
                  <Sliders className="w-3 h-3 text-amber-400" />
                  <span>Custom AI Director Tweaks & Story Notes</span>
                </label>
                <span className="text-[10px] text-zinc-500">Guides AI narrator for exact tone & dialogue</span>
              </div>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                rows={2}
                placeholder="Tell AI specific directions: e.g. 'Read speech bubbles closely, roast the villain's dumb smile, focus on the sword fight, keep narrator pacing rapid'..."
                className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-400 resize-none font-sans"
              />

              {/* Quick Tweak Prompt Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-zinc-500">Quick Tweaks:</span>
                {[
                  { label: '+ Read Text Bubbles', text: 'Follow the dialogue text bubbles precisely and describe character reactions.' },
                  { label: '+ Comedic Roast', text: 'Roast the tropes, call out the overpowered protagonist, and point out goofy expressions.' },
                  { label: '+ Serious Lore', text: 'Focus on dramatic tension, rich worldbuilding, and serious narrative storytelling.' },
                  { label: '+ Action Focus', text: 'Emphasize the combat, martial arts choreography, and ridiculous power scaling.' },
                  { label: '+ Fast Paced', text: 'Keep voice lines short, snappy, and under 5 seconds for viral retention.' }
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setUserNotes(prev => prev ? `${prev}\n- ${chip.text}` : chip.text);
                    }}
                    className="px-2 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-300 border border-zinc-700 text-[10px] font-medium transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Segmented Processing Badge */}
            {activeCount > 4 && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
                <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-[11px] leading-tight">
                  <strong>Segmented Multi-Batch Active:</strong> Processing {activeCount} panels in {Math.ceil(activeCount / 4)} sequential segments (4 images/segment) for ultra-accurate speech bubble reading and cohesive continuity without generic tropes.
                </span>
              </div>
            )}
          </div>

          {/* Processing status banner */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin flex-shrink-0" />
              <div>
                <div className="font-bold text-amber-300 text-xs">Processing Manhwa Chapter...</div>
                <div className="text-[11px] text-zinc-300 font-mono mt-0.5">{statusStep}</div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#141422] border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {activeCount > 0 ? `${activeCount} panels ready for AI Recap` : 'Drop a PDF or images to begin'}
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
            >
              Cancel
            </button>

            <button
              onClick={handleGenerateRecapVideo}
              disabled={isProcessing || activeCount === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-50 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cooking Recap Video...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  <span>Generate Recap Video ({activeCount} Panels)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
