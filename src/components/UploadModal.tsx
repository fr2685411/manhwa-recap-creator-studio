import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Scissors, 
  Plus, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Panel } from '../types/manhwa';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPanels: (newPanels: Panel[]) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onAddPanels,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'strip'>('files');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [stripImageUrl, setStripImageUrl] = useState<string | null>(null);
  const [sliceCount, setSliceCount] = useState<number>(4);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  // Handle standard multi-image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedImages((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle single long strip upload for webtoon slicing
  const handleStripUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setStripImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Convert uploaded standalone files into Panels
  const handleAddUploadedFiles = () => {
    if (uploadedImages.length === 0) return;

    const newPanels: Panel[] = uploadedImages.map((dataUrl, idx) => ({
      id: 'custom_panel_' + Date.now() + '_' + idx,
      title: `Uploaded Panel ${idx + 1}`,
      imageUrl: dataUrl,
      duration: 5.0,
      commentary: 'Chat look at what happens next in this panel!',
      camera: {
        type: idx % 2 === 0 ? 'crash-zoom' : 'pan-down',
        start: { x: 0.5, y: 0.35, zoom: 1.1 },
        end: { x: 0.5, y: 0.65, zoom: 1.4 },
        shakeIntensity: 0.4,
        shakeTime: 1.2,
        easing: 'ease-in-out',
      },
      transition: idx % 2 === 0 ? 'white-flash' : 'glitch',
      soundEffect: idx % 2 === 0 ? 'vine-boom' : 'anime-punch',
      soundEffectTime: 1.0,
      subtitles: [
        { text: 'Chat', startTime: 0.0, endTime: 0.7, isPunch: true },
        { text: 'look', startTime: 0.7, endTime: 1.2 },
        { text: 'at', startTime: 1.2, endTime: 1.5 },
        { text: 'what', startTime: 1.5, endTime: 2.1 },
        { text: 'happens', startTime: 2.1, endTime: 2.9 },
        { text: 'NEXT!', startTime: 2.9, endTime: 4.5, isPunch: true },
      ],
    }));

    onAddPanels(newPanels);
    onClose();
  };

  // Slice long strip into distinct canvas image slices
  const handleSliceStrip = async () => {
    if (!stripImageUrl) return;
    setIsProcessing(true);

    try {
      const img = new Image();
      img.src = stripImageUrl;
      await new Promise((res) => { img.onload = res; });

      const sliceHeight = img.height / sliceCount;
      const slicedPanels: Panel[] = [];

      for (let i = 0; i < sliceCount; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = sliceHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            img,
            0, i * sliceHeight, img.width, sliceHeight,
            0, 0, img.width, sliceHeight
          );
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

          slicedPanels.push({
            id: 'strip_slice_' + Date.now() + '_' + i,
            title: `Webtoon Slice ${i + 1}`,
            imageUrl: dataUrl,
            duration: 4.8,
            commentary: `Scene ${i + 1}: Check out the details in this vertical manhwa cut!`,
            camera: {
              type: 'pan-down',
              start: { x: 0.5, y: 0.25, zoom: 1.1 },
              end: { x: 0.5, y: 0.75, zoom: 1.35 },
              shakeIntensity: 0.3,
              shakeTime: 1.0,
              easing: 'ease-in-out',
            },
            transition: 'fade',
            soundEffect: i === 0 ? 'record-scratch' : (i === sliceCount - 1 ? 'vine-boom' : 'anime-punch'),
            soundEffectTime: 1.0,
            subtitles: [
              { text: 'Check', startTime: 0.0, endTime: 0.6 },
              { text: 'out', startTime: 0.6, endTime: 1.0 },
              { text: 'this', startTime: 1.0, endTime: 1.4 },
              { text: 'insane', startTime: 1.4, endTime: 2.2, isPunch: true },
              { text: 'action', startTime: 2.2, endTime: 3.0, isPunch: true },
              { text: 'panel!', startTime: 3.0, endTime: 4.5, isPunch: true },
            ],
          });
        }
      }

      onAddPanels(slicedPanels);
      onClose();
    } catch (err) {
      console.error('Failed to slice strip:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#10101a] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#141422] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white font-['Cabinet_Grotesk'] tracking-wide">
                ADD MANHWA PANELS
              </h2>
              <p className="text-xs text-zinc-400">Upload standalone images or slice a vertical webtoon strip</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-zinc-800 bg-[#0d0d15] text-xs font-bold">
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'files'
                ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Multiple Images</span>
          </button>
          <button
            onClick={() => setActiveTab('strip')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'strip'
                ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span>Webtoon Strip Slicer</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 space-y-4 text-xs">
          {activeTab === 'files' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-zinc-700 hover:border-amber-400/80 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-zinc-900/40 hover:bg-zinc-900/70 transition-all group">
                <Upload className="w-8 h-8 text-zinc-500 group-hover:text-amber-400 mb-2 transition-colors" />
                <span className="font-bold text-zinc-200">Click to upload manga / manhwa images</span>
                <span className="text-zinc-500 text-[11px] mt-1">PNG, JPG, or WebP &bull; Select multiple files</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {uploadedImages.length > 0 && (
                <div>
                  <div className="font-bold text-zinc-300 mb-2 flex items-center justify-between">
                    <span>Uploaded Panels ({uploadedImages.length})</span>
                    <button
                      onClick={() => setUploadedImages([])}
                      className="text-red-400 text-[11px] hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-black/60 rounded-xl border border-zinc-800">
                    {uploadedImages.map((src, i) => (
                      <div key={i} className="aspect-[3/4] rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 relative">
                        <img src={src} alt="Upload" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-mono">
                          #{i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'strip' && (
            <div className="space-y-4">
              {!stripImageUrl ? (
                <label className="border-2 border-dashed border-zinc-700 hover:border-amber-400/80 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-zinc-900/40 hover:bg-zinc-900/70 transition-all group">
                  <Scissors className="w-8 h-8 text-zinc-500 group-hover:text-amber-400 mb-2 transition-colors" />
                  <span className="font-bold text-zinc-200">Upload Tall Webtoon Scroll Strip</span>
                  <span className="text-zinc-500 text-[11px] mt-1">We will auto-slice it into animated sequential panels!</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleStripUpload}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-300">Slice Settings</span>
                    <button
                      onClick={() => setStripImageUrl(null)}
                      className="text-amber-400 text-[11px] hover:underline"
                    >
                      Replace Strip
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400">Number of Slices:</span>
                    <div className="flex items-center gap-1">
                      {[3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          onClick={() => setSliceCount(num)}
                          className={`w-8 h-8 rounded-lg font-bold text-xs transition-all ${
                            sliceCount === num
                              ? 'bg-amber-500 text-black shadow-sm'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-800 bg-black p-2 flex justify-center">
                    <img src={stripImageUrl} alt="Webtoon Strip" className="max-h-96 object-contain" />
                  </div>
                </div>
              )}
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

          {activeTab === 'files' ? (
            <button
              onClick={handleAddUploadedFiles}
              disabled={uploadedImages.length === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add {uploadedImages.length} Panels</span>
            </button>
          ) : (
            <button
              onClick={handleSliceStrip}
              disabled={!stripImageUrl || isProcessing}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
            >
              <Scissors className="w-4 h-4 stroke-[2.5]" />
              <span>Slice & Create {sliceCount} Panels</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
