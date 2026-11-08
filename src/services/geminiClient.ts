export interface GenerateScriptParams {
  chapterTitle: string;
  genre?: string;
  tone?: string;
  panelDescriptions: string[];
  userNotes?: string;
}

export interface GeneratedPanelScript {
  commentary: string;
  suggestedCamera?: 'pan-down' | 'crash-zoom' | 'pan-right' | 'zoom-in' | 'zoom-out' | 'shake-impact' | 'slow-drift';
  soundEffect?: 'vine-boom' | 'record-scratch' | 'anime-punch' | 'discord-ping' | 'choir-epic' | 'none';
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

export async function requestChapterGenerationFromImages(params: {
  images: Array<{ base64: string; mimeType?: string }>;
  chapterTitle?: string;
  tone?: string;
  userNotes?: string;
}): Promise<GeneratedPanelScript[]> {
  const res = await fetch('/api/gemini/generate-chapter-from-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to analyze images and generate recap script');
  }

  return data.panels;
}

export async function requestTtsAudio(text: string, voice = 'Puck', style?: string): Promise<string> {
  const res = await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, style }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to synthesize speech');
  }

  return data.audioBase64;
}

export async function requestPanelAnalysis(imageBase64: string, context = ''): Promise<{
  description: string;
  commentary: string;
  cameraMotion: string;
  soundEffect: string;
}> {
  const res = await fetch('/api/gemini/analyze-panel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, context }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to analyze panel');
  }

  return data.data;
}

// Browser Web Speech fallback synthesizer (immediate zero-latency option)
export function speakBrowserVoice(text: string, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.12; // snappy Mamoru pacing
  utterance.pitch = 1.05;

  const voices = window.speechSynthesis.getVoices();
  // Prefer natural English male or high-energy voice
  const naturalVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Guy') || v.name.includes('David') || v.name.includes('Google US English')));
  if (naturalVoice) {
    utterance.voice = naturalVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
  }
  window.speechSynthesis.speak(utterance);
}
