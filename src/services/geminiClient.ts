export interface GenerateScriptParams {
  chapterTitle: string;
  genre?: string;
  tone?: string;
  panelDescriptions: string[];
  userNotes?: string;
  images?: Array<{ base64: string; mimeType?: string }>;
}

export interface GeneratedPanelScript {
  title?: string;
  detectedDialogue?: string; // Text extracted from speech bubbles/narration boxes
  commentary: string;
  suggestedCamera?: 'pan-down' | 'crash-zoom' | 'pan-right' | 'zoom-in' | 'zoom-out' | 'shake-impact' | 'slow-drift';
  soundEffect?: 'vine-boom' | 'record-scratch' | 'anime-punch' | 'discord-ping' | 'choir-epic' | 'none';
  transition?: string;
  durationSeconds?: number;
  subtitles?: Array<{ text: string; startTime: number; endTime: number; isPunch?: boolean }>;
}

export async function requestScriptGeneration(params: GenerateScriptParams): Promise<GeneratedPanelScript[]> {
  const res = await fetch('/api/gemini/generate-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to generate recap script');
  }

  return data.panels;
}

export interface DetectedPremiseData {
  detectedTitle?: string;
  genre?: string;
  premise?: string;
  protagonist?: string;
  characters?: string[];
  currentSituation?: string;
  suggestedDirectorTweaks?: string;
}

export async function requestDetectPremiseFromImages(
  images: Array<{ base64: string; mimeType?: string }>
): Promise<DetectedPremiseData> {
  const res = await fetch('/api/gemini/detect-premise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to detect manhwa premise');
  }

  return data.data;
}

export async function requestChapterGenerationFromImages(params: {
  images: Array<{ base64: string; mimeType?: string }>;
  chapterTitle?: string;
  tone?: string;
  userNotes?: string;
  segmentIndex?: number;
  totalSegments?: number;
  previousContext?: string;
}): Promise<{ panels: GeneratedPanelScript[]; segmentSummary?: string }> {
  const res = await fetch('/api/gemini/generate-chapter-from-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to analyze images and generate recap script');
  }

  return {
    panels: data.panels || [],
    segmentSummary: data.segmentSummary || '',
  };
}

// Seamlessly process many images in high-precision segments and stitch them together
export async function requestSegmentedChapterGeneration(params: {
  images: Array<{ base64: string; mimeType?: string }>;
  chapterTitle?: string;
  tone?: string;
  userNotes?: string;
  segmentSize?: number;
  onProgress?: (msg: string, currentSegment: number, totalSegments: number) => void;
}): Promise<GeneratedPanelScript[]> {
  const { images, chapterTitle = 'Manhwa Chapter', tone, userNotes, segmentSize = 4, onProgress } = params;
  if (!images || images.length === 0) return [];

  // If small count (<= 4), single segment is optimal
  if (images.length <= segmentSize) {
    onProgress?.(`Analyzing all ${images.length} panels with vision & OCR...`, 1, 1);
    const res = await requestChapterGenerationFromImages({
      images,
      chapterTitle,
      tone,
      userNotes,
      segmentIndex: 0,
      totalSegments: 1,
    });
    return res.panels;
  }

  // Chunk images into sequential segments of segmentSize (e.g. 3-4 panels)
  const segments: Array<Array<{ base64: string; mimeType?: string }>> = [];
  for (let i = 0; i < images.length; i += segmentSize) {
    segments.push(images.slice(i, i + segmentSize));
  }

  const allStitchedPanels: GeneratedPanelScript[] = [];
  let runningStoryContext = '';

  for (let s = 0; s < segments.length; s++) {
    const currentChunk = segments[s];
    const segStart = s * segmentSize + 1;
    const segEnd = Math.min(images.length, (s + 1) * segmentSize);

    onProgress?.(
      `🔍 Analyzing Segment ${s + 1}/${segments.length} (Panels ${segStart}-${segEnd}) with OCR & character vision...`,
      s + 1,
      segments.length
    );

    try {
      const segResult = await requestChapterGenerationFromImages({
        images: currentChunk,
        chapterTitle,
        tone,
        userNotes,
        segmentIndex: s,
        totalSegments: segments.length,
        previousContext: runningStoryContext,
      });

      if (segResult.panels && segResult.panels.length > 0) {
        allStitchedPanels.push(...segResult.panels);
      }
      if (segResult.segmentSummary) {
        runningStoryContext = (runningStoryContext ? runningStoryContext + ' ' : '') + segResult.segmentSummary;
      }
    } catch (segErr: any) {
      console.warn(`Segment ${s + 1} generation issue:`, segErr);
      onProgress?.(`⚠️ Retrying segment ${s + 1} with standard vision...`, s + 1, segments.length);
      // Fallback single-segment retry
      const segResult = await requestChapterGenerationFromImages({
        images: currentChunk,
        chapterTitle,
        tone,
        userNotes: userNotes + ' (Focus on dialogue and action in these panels)',
        segmentIndex: s,
        totalSegments: segments.length,
      });
      if (segResult.panels) allStitchedPanels.push(...segResult.panels);
    }
  }

  onProgress?.(`✨ Stitched ${allStitchedPanels.length} panels into cohesive story!`, segments.length, segments.length);
  return allStitchedPanels;
}

export async function requestTtsAudio(text: string, voice = 'Puck', style?: string): Promise<string> {
  const res = await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, style }),
  });

  const data = await res.json();
  if (!res.ok || !data.success || !data.audioBase64) {
    throw new Error(data.error || 'TTS audio unavailable');
  }

  return data.audioBase64;
}

export async function requestPanelAnalysis(params: {
  imageBase64: string;
  chapterTitle?: string;
  tone?: string;
  context?: string;
}): Promise<{
  title?: string;
  detectedDialogue: string;
  commentary: string;
  suggestedCamera: string;
  soundEffect: string;
  durationSeconds: number;
}> {
  const res = await fetch('/api/gemini/analyze-panel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to analyze panel');
  }

  return data.data;
}

// Convert any image URL (SVG data URI, canvas, local asset, or blob) to JPEG base64 for Gemini Vision
export async function convertImageUrlToBase64(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:image/jpeg;base64,') || imageUrl.startsWith('data:image/png;base64,')) {
    return imageUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(1280, img.width || 800);
      canvas.height = Math.min(1800, img.height || 1200);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => {
      reject(new Error('Failed to load image for vision analysis'));
    };
    img.src = imageUrl;
  });
}

// Browser Web Speech voice synthesizer: produces 100% natural, crisp, human-articulated narration
export function speakBrowserVoice(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }

  const cleanText = text.replace(/<[^>]*>/g, '').trim();
  if (!cleanText) {
    onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.08; // crisp, energetic narrative pacing
  utterance.pitch = 1.02;

  const selectVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    
    // 1. First priority: High-quality natural voices (Edge/Windows Natural, Google US English, Samantha, Daniel)
    const naturalVoice = voices.find(v => 
      v.lang.startsWith('en') && (
        v.name.includes('Natural') || 
        v.name.includes('Online (Natural)') ||
        v.name.includes('Guy') || 
        v.name.includes('David') || 
        v.name.includes('Google US English') ||
        v.name.includes('Samantha') ||
        v.name.includes('Daniel')
      )
    );
    if (naturalVoice) return naturalVoice;

    // 2. Second priority: Any standard English voice
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    return englishVoice || voices[0];
  };

  const chosen = selectVoice();
  if (chosen) {
    utterance.voice = chosen;
  }

  let ended = false;
  const finish = () => {
    if (!ended) {
      ended = true;
      onEnd?.();
    }
  };

  utterance.onend = finish;
  utterance.onerror = finish;

  // Failsafe timer so ducking never gets permanently stuck
  const timeoutMs = Math.max(3000, cleanText.split(/\s+/).length * 480);
  setTimeout(finish, timeoutMs);

  window.speechSynthesis.speak(utterance);
}

export interface PanelVisualComplexityAnalysis {
  panelIndex: number;
  panelId: string;
  visualComplexityScore: number; // 1 to 10
  complexityLevel: 'low' | 'medium' | 'high' | 'extreme';
  intensityType: string;
  visualDescription: string;
  suggestedDurationSeconds: number;
  suggestedWordCount: number;
  pacingRecommendation: string;
  pacingRationale: string;
  suggestedCommentary: string;
  detectedDialogue?: string;
}

export async function requestVisualComplexityAnalysis(params: {
  panels: Array<{ id: string; imageBase64: string; title?: string }>;
  chapterTitle?: string;
  tone?: string;
}): Promise<PanelVisualComplexityAnalysis[]> {
  const res = await fetch('/api/gemini/analyze-visual-complexity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to analyze visual complexity of panels');
  }

  return data.analyses || [];
}
