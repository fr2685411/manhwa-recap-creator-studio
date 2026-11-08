import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Flame, 
  Loader2, 
  BookOpen, 
  Zap, 
  MessageSquare,
  Wand2
} from 'lucide-react';
import { ProjectSettings, Panel } from '../types/manhwa';
import { localAiEngine } from '../services/localAiEngine';

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
  const [chapterTitle, setChapterTitle] = useState(project.title || 'I Transmigrated as an F-Rank Cleaner');
  const [genre, setGenre] = useState('Action Fantasy Dungeon Manhwa');
  const [tone, setTone] = useState('Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy)');
  const [panelCount, setPanelCount] = useState(5);
  const [userNotes, setUserNotes] = useState('MC gets thrown into a dungeon, gets a seemingly trash skill/item that is absurdly broken, roasts the author and system.');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const panelDescriptions = Array.from({ length: panelCount }).map((_, i) => {
        if (project.panels[i]) {
          return `${project.panels[i].title}: ${project.panels[i].commentary || 'Action comic panel'}`;
        }
        return `Story beat ${i + 1} of chapter ${chapterTitle}`;
      });

      const generated = await localAiEngine.generateRecapScriptUnified({
        chapterTitle,
        genre,
        tone,
        panelDescriptions,
        userNotes,
      });

      // Merge into project panels or create updated panels
      const updatedPanels: Panel[] = generated.map((gen, idx) => {
        const existing = project.panels[idx];
        const rawWords = (gen.commentary || '').split(/\s+/).filter(Boolean);
        const duration = gen.durationSeconds || Math.max(4.5, Math.min(8.0, rawWords.length * 0.42));
        const wordDur = duration / Math.max(1, rawWords.length);

        const subtitles = gen.subtitles || rawWords.map((w, wIdx) => ({
          text: w,
          startTime: Math.round(wIdx * wordDur * 100) / 100,
          endTime: Math.round((wIdx + 1) * wordDur * 100) / 100,
          isPunch: /^[A-Z0-9!]{3,}|bro|wait|dead|what|he|him|fr/i.test(w) || w.includes('!') || w.includes('?'),
        }));

        let camera = existing?.camera || {
          type: 'crash-zoom',
          start: { x: 0.5, y: 0.5, zoom: 1.0 },
          end: { x: 0.5, y: 0.5, zoom: 1.6 },
          shakeIntensity: 0.5,
          easing: 'punch',
        };

        if (gen.suggestedCamera) {
          camera = {
            ...camera,
            type: gen.suggestedCamera as any,
          };
        }

        return {
          id: existing?.id || 'gen_' + Date.now() + '_' + idx,
          title: existing?.title || `Panel ${idx + 1}: ${rawWords.slice(0, 3).join(' ')}`,
          imageUrl: existing?.imageUrl || project.panels[0]?.imageUrl || '',
          duration,
          commentary: gen.commentary,
          camera,
          transition: existing?.transition || (idx % 2 === 0 ? 'white-flash' : 'glitch'),
          soundEffect: (gen.soundEffect as any) || 'vine-boom',
          soundEffectTime: 1.0,
          subtitles,
        };
      });

      onApplyGeneratedScript(updatedPanels, chapterTitle);
      onClose();
    } catch (err: any) {
      console.error('Script generation failed:', err);
      setError(err.message || 'Failed to generate recap script');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#10101a] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#141422] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white font-['Cabinet_Grotesk'] tracking-wide">
                AI 4TH-WALL SCRIPT GENERATOR
              </h2>
              <p className="text-xs text-zinc-400">
                Generate comedic, audience-breaking recap voiceover inspired by @MamoruManhwa
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
        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="font-bold text-zinc-300 block mb-1">Manhwa / Webtoon Title</label>
            <input
              type="text"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder="e.g. Solo Max-Level Potato Hunter"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-400 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-zinc-300 block mb-1">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-400 text-xs"
              >
                <option value="Action Fantasy Dungeon Manhwa">Dungeon Hunter / System</option>
                <option value="Murim Reincarnation Martial Arts">Murim Martial Arts</option>
                <option value="Villainess Otome Comedy">Villainess Otome Comedy</option>
                <option value="VRMMO Gaming Glitch">VRMMO Broken Exploits</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-zinc-300 block mb-1">Panels Count</label>
              <select
                value={panelCount}
                onChange={(e) => setPanelCount(parseInt(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-400 text-xs"
              >
                <option value={3}>3 Panels (Quick Clip)</option>
                <option value={5}>5 Panels (Standard Short)</option>
                <option value={7}>7 Panels (Full Chapter)</option>
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
              <option value="Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy, roasts tropes)">
                🔥 Unhinged Mamoru (Roasts art/tropes, "Chat look at bro", Meme heavy)
              </option>
              <option value="Sarcastic Anime Critic (Deadpan roasts, power scaling jokes)">
                💀 Sarcastic Critic (Deadpan delivery, questions power scaling)
              </option>
              <option value="Hype Shonen Bro (Screaming hype into sudden comedy cuts)">
                ⚡ Hype Shonen Bro (Extreme hype with sudden meme drops)
              </option>
            </select>
          </div>

          <div>
            <label className="font-bold text-zinc-300 block mb-1">Story Notes & Clichés to Roast</label>
            <textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              rows={3}
              placeholder="e.g. He gets an F-rank dustpan that kills gods, the villain has an oversized sword..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-zinc-200 focus:outline-none focus:border-amber-400 text-xs resize-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#141422] border-t border-zinc-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
          >
            Cancel
          </button>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
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
                <span>Generate Recap Script</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
