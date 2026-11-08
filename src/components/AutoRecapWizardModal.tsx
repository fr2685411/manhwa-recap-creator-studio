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
  Volume2
} from 'lucide-react';
import { Panel, ProjectSettings } from '../types/manhwa';
import { extractPagesFromPdf, ExtractedPage } from '../services/pdfReader';
import { requestChapterGenerationFromImages, requestTtsAudio } from '../services/geminiClient';
import { localAiEngine } from '../services/localAiEngine';
import { SAMPLE_PROJECTS } from '../data/sampleChapters';

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
  const [userNotes, setUserNotes] = useState('Roast the tropes, call out the overpowered main character, and question the artist\'s anatomy.');
  
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

  // Run End-to-End AI Recap Generation from the images
  const handleGenerateRecapVideo = async () => {
    const activePanels = extractedPanels.filter((p) => p.selected);
    if (activePanels.length === 0) {
      setError('Please select at least 1 image or page to generate the recap video.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Send images to active AI engine
      const engine = localAiEngine.getActiveEngine();
      setStatusStep(
        engine === 'local-ollama'
          ? '🦙 Sending to local Ollama instance on localhost:11434...'
          : engine === 'in-browser-model'
          ? '💻 Running in-browser local model via WebGPU...'
          : '🔍 Analyzing manhwa artwork with Gemini Vision...'
      );

      const visionPayload = activePanels.map((p) => ({
        base64: p.dataUrl,
        mimeType: p.dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
      }));

      let generatedScripts: any[] = [];
      if (engine === 'local-ollama' || engine === 'in-browser-model') {
        try {
          generatedScripts = await localAiEngine.generateRecapScriptUnified({
            chapterTitle,
            tone: humorTone,
            userNotes,
            panelDescriptions: activePanels.map((_, idx) => `Chapter Page/Panel ${idx + 1}`),
            images: activePanels.map(p => p.dataUrl),
          });
        } catch (localErr: any) {
          console.warn('Local model generation failed, falling back to Gemini Vision:', localErr);
          setStatusStep('⚡ Local model hit limit. Falling back to Gemini Vision...');
          try {
            generatedScripts = await requestChapterGenerationFromImages({
              images: visionPayload,
              chapterTitle,
              tone: humorTone,
              userNotes,
            });
          } catch (cloudErr) {
            console.warn('Gemini Vision fallback error, using local script generator:', cloudErr);
          }
        }
      } else {
        try {
          generatedScripts = await requestChapterGenerationFromImages({
            images: visionPayload,
            chapterTitle,
            tone: humorTone,
            userNotes,
          });
        } catch (cloudErr: any) {
          console.warn('Gemini Vision API error, falling back to comedic script generator:', cloudErr);
          setStatusStep('⚡ Generating comedic storyboard scripts...');
          generatedScripts = await localAiEngine.generateRecapScriptUnified({
            chapterTitle,
            tone: humorTone,
            userNotes,
            panelDescriptions: activePanels.map((_, idx) => `Chapter Page/Panel ${idx + 1}`),
            images: activePanels.map(p => p.dataUrl),
          });
        }
      }

      setStatusStep('✍️ Choreographing kinetic camera pan & zoom, punchline SFX, and subtitles...');

      // Step 2: Build complete Panels sequence
      const finalPanels: Panel[] = [];
      const defaultRoasts = [
        `Chat, look at this! Bro just woke up in an SSS-rank dungeon and thought he had plot armor!`,
        `Wait, why does this boss look like he's on 500mg of dungeon tren?! Look at bro's posture!`,
        `Ain't no way bro is actually attempting this. The author completely gave up on game balance!`,
        `Bro really pulled out the golden artifact like it's Tuesday! Absolutely unhinged!`,
        `Chat, I am losing my mind. Look at the villains trembling in the background right now!`,
      ];

      for (let i = 0; i < activePanels.length; i++) {
        const item = activePanels[i];
        const script = generatedScripts[i] || {
          title: `Scene ${i + 1}`,
          commentary: defaultRoasts[i % defaultRoasts.length],
          suggestedCamera: i % 2 === 0 ? 'crash-zoom' : 'pan-down',
          soundEffect: i === 0 ? 'record-scratch' : 'vine-boom',
          transition: i % 2 === 0 ? 'white-flash' : 'glitch',
          durationSeconds: 5.2,
        };

        const rawWords = (script.commentary || '').split(/\s+/).filter(Boolean);
        const duration = script.durationSeconds || Math.max(4.5, Math.min(8.0, rawWords.length * 0.45));
        const wordDur = duration / Math.max(1, rawWords.length);

        const subtitles = rawWords.map((w: string, wIdx: number) => ({
          text: w,
          startTime: Math.round(wIdx * wordDur * 100) / 100,
          endTime: Math.round((wIdx + 1) * wordDur * 100) / 100,
          isPunch: /^[A-Z0-9!]{3,}|bro|wait|dead|what|he|him|fr/i.test(w) || w.includes('!') || w.includes('?'),
        }));

        let camera = {
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
          commentary: script.commentary,
          camera,
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

          {/* Step 3: Recap Style & Options */}
          <div className="space-y-3 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
            <span className="font-bold text-zinc-200 block">3. Mamoru Voiceover & Recap Settings</span>

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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 block mb-1">Humor Flavor</label>
                <select
                  value={humorTone}
                  onChange={(e) => setHumorTone(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy, roasts tropes)">
                    🔥 Unhinged Mamoru (Audience roast)
                  </option>
                  <option value="Sarcastic Anime Critic (Deadpan logic, questions power scaling)">
                    💀 Sarcastic Critic (Deadpan)
                  </option>
                  <option value="Hype Shonen Bro (Screaming hype into comedy cuts)">
                    ⚡ Hype Shonen (Fast energy)
                  </option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">AI Voiceover</label>
                <label className="flex items-center gap-2 h-8 px-2 bg-black border border-zinc-700 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGenerateVoice}
                    onChange={(e) => setAutoGenerateVoice(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span className="text-zinc-300 font-semibold text-xs">
                    Synthesize with Gemini TTS
                  </span>
                </label>
              </div>
            </div>
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
