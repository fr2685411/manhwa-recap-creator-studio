import React from 'react';
import { X, Flame, Zap, Camera, Volume2, Download, Keyboard } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#10101a] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#141422] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white font-['Cabinet_Grotesk'] tracking-wide">
                THE @MAMORUMANHWA SECRET SAUCE
              </h2>
              <p className="text-xs text-zinc-400">How to create viral comedic manhwa recap videos</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-zinc-300">
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
            <div className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
              <Flame className="w-4 h-4" /> 1. Break the 4th Wall (Talk as the Audience)
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Never just read the dialogue! Act like you're watching alongside chat: roast the author's copy-pasted backgrounds, call out absurd power scaling, and question the main character's life choices.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
            <div className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
              <Camera className="w-4 h-4" /> 2. Kinetic Camera Motion (Punch & Shake)
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Static panels are boring. Use <strong>Crash Zoom</strong> right into shocked character expressions, <strong>Pan Down</strong> for long webtoon scroll panels, and <strong>Screen Shake</strong> when an S-rank impact or punchline drops.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
            <div className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
              <Zap className="w-4 h-4" /> 3. Meme Sound Effects & Audio Ducking
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Place a <strong>Vine Boom</strong> or <strong>Record Scratch</strong> right on the comedic revelation. The app automatically ducks the BGM so your AI voiceover punches through crystal clear!
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
            <div className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
              <Keyboard className="w-4 h-4" /> 4. Keyboard Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-2 text-zinc-400 pt-1 font-mono text-[11px]">
              <div><kbd className="px-1.5 py-0.5 rounded bg-black text-amber-400 border border-zinc-700">Space</kbd> : Play / Pause</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-black text-amber-400 border border-zinc-700">&larr; / &rarr;</kbd> : Scrub 2s</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#141422] border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all"
          >
            Got it, Let's Cook!
          </button>
        </div>
      </div>
    </div>
  );
};
