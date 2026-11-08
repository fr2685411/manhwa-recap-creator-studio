import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

// Shared server-side Gemini client
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1alpha',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// API: Generate Mamoru-style 4th-wall breaking recap script
app.post('/api/gemini/generate-script', async (req: Request, res: Response) => {
  try {
    const { 
      chapterTitle, 
      genre = 'Action Fantasy Manhwa', 
      tone = 'Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy)',
      panelDescriptions = [],
      userNotes = ''
    } = req.body;

    const ai = getAiClient();

    const systemPrompt = `You are an elite YouTube Manhwa Recap creator in the iconic comedic style of @MamoruManhwa.
Your personality and tone:
- You speak as a viewer watching along with the audience ("Chat, look at this guy", "Bro really thought he had plot armor", "Wait, why does the villain look like a K-pop idol with anger issues?").
- You constantly BREAK THE FOURTH WALL: talk directly to the audience, roast the author/artist's tropes ("The artist clearly copy-pasted this horse", "Truck-kun took a vacation so they used a tractor"), question ridiculous power scaling, and call out clichés.
- High energy, snappy pacing, humorous commentary, playful hyperbole.
- Don't just narrate what happens ("He drew his sword") — add commentary ("Look at him pulling out a sword bigger than his rent bill").
- Each panel should have:
  1. commentary: 1-3 punchy, hilarious spoken lines (approx 4 to 10 seconds of speaking time).
  2. suggestedCamera: one of ['pan-down', 'crash-zoom', 'pan-right', 'zoom-in', 'zoom-out', 'shake-impact', 'slow-drift']
  3. soundEffect: optional comedy SFX cue like ['vine-boom', 'record-scratch', 'anime-punch', 'discord-ping', 'choir-epic', 'none']
  4. subtitles: word-by-word or short energetic phrases for dynamic kinetic captions.
  5. durationSeconds: estimated speaking duration (usually 4 to 8 seconds).`;

    const contents = `Create an engaging recap script for Chapter: "${chapterTitle}" (${genre}).
Tone: ${tone}
User Notes: ${userNotes}
Number of panels: ${panelDescriptions.length || 6}
Panel details:
${panelDescriptions.map((desc: string, i: number) => `Panel ${i + 1}: ${desc}`).join('\n')}

Return a valid JSON array of panel scripts.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const jsonText = response.text || '[]';
    const parsed = JSON.parse(jsonText);
    res.json({ success: true, panels: parsed });
  } catch (error: any) {
    console.error('Error generating script:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to generate recap script' 
    });
  }
});

// In-memory cache for synthesized voice clips to prevent duplicate API hits
const ttsCache = new Map<string, string>();
let ttsQuotaCooldownUntil = 0;

// High-quality procedural speech WAV generator used as instant fallback when Free Tier quota (3 RPM) is hit
function generateProceduralSpeechWav(text: string, voice = 'Puck'): string {
  const sampleRate = 24000;
  const words = text.split(/\s+/).filter(Boolean);
  const dur = Math.max(2.0, Math.min(8.5, words.length * 0.38));
  const totalSamples = Math.floor(sampleRate * dur);
  const buffer = Buffer.alloc(44 + totalSamples * 2);

  // WAV Header (44 bytes)
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + totalSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // Audio format 1 = PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  buffer.writeUInt16LE(2, 32); // Block align
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(totalSamples * 2, 40);

  // Voice Persona Base Frequencies
  const baseFreqs: Record<string, number> = {
    Puck: 165,
    Fenrir: 110,
    Zephyr: 195,
    Kore: 220,
    Charon: 95,
  };
  const pitchBase = baseFreqs[voice] || 165;

  const numSyllables = Math.max(3, Math.round(words.length * 1.55));
  const sylDuration = dur / numSyllables;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const sylIndex = Math.floor(t / sylDuration);
    const sylT = (t % sylDuration) / sylDuration;
    // Bell curve amplitude envelope per syllable
    const sylEnv = Math.sin(Math.PI * Math.min(1, Math.max(0, sylT)));

    // Modulated fundamental with speech-like intonation contours
    const f0 = pitchBase + Math.sin(sylIndex * 1.6) * 22 + Math.sin(t * 7.5) * 8;
    const osc1 = Math.sin(2 * Math.PI * f0 * t);
    const osc2 = Math.sin(2 * Math.PI * (f0 * 2.05) * t) * 0.42;
    const osc3 = Math.sin(2 * Math.PI * (f0 * 3.1) * t) * 0.22;
    const voiceTone = (osc1 + osc2 + osc3) * Math.pow(sylEnv, 1.2);

    const sampleVal = Math.max(-0.95, Math.min(0.95, voiceTone * 0.65));
    const intVal = Math.floor(sampleVal * 32767);
    buffer.writeInt16LE(intVal, 44 + i * 2);
  }

  return buffer.toString('base64');
}

// API: Generate Voiceover using Gemini 3.8 Flash Lite TTS with caching & 429 quota protection
app.post('/api/gemini/tts', async (req: Request, res: Response) => {
  try {
    const { 
      text, 
      voice = 'Puck', // Puck, Fenrir, Zephyr, Kore, Charon
      style = 'Energetic comedic YouTube manhwa recap narrator breaking the fourth wall' 
    } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required for TTS' });
      return;
    }

    const cleanText = text.trim();
    const cacheKey = `${voice}_${cleanText.toLowerCase()}`;

    // 1. Return cached audio immediately if available
    if (ttsCache.has(cacheKey)) {
      res.json({
        success: true,
        audioBase64: ttsCache.get(cacheKey),
        mimeType: 'audio/wav',
        cached: true,
      });
      return;
    }

    // 2. If currently in quota cooldown period (Free Tier 3 RPM limit), return procedural speech audio
    if (Date.now() < ttsQuotaCooldownUntil) {
      const remainingSec = Math.ceil((ttsQuotaCooldownUntil - Date.now()) / 1000);
      console.log(`[TTS] In Free Tier 3 RPM cooldown (${remainingSec}s remaining). Serving procedural narration.`);
      const fallbackAudio = generateProceduralSpeechWav(cleanText, voice);
      ttsCache.set(cacheKey, fallbackAudio);
      res.json({
        success: true,
        audioBase64: fallbackAudio,
        mimeType: 'audio/wav',
        isFallback: true,
        quotaExceeded: true,
        cooldownSeconds: remainingSec,
      });
      return;
    }

    const ai = getAiClient();

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: cleanText.slice(0, 500),
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice || 'Puck' },
            },
          },
        },
      });
    } catch (e1: any) {
      console.warn('[TTS] Gemini TTS API warning:', e1.message);
      
      // If quota exceeded (429 RESOURCE_EXHAUSTED), engage cooldown and return clean procedural speech
      if (e1.message?.includes('429') || e1.message?.includes('RESOURCE_EXHAUSTED') || e1.message?.includes('quota')) {
        ttsQuotaCooldownUntil = Date.now() + 55000; // 55s cooldown to respect 3 RPM limit
        const fallbackAudio = generateProceduralSpeechWav(cleanText, voice);
        ttsCache.set(cacheKey, fallbackAudio);
        res.json({
          success: true,
          audioBase64: fallbackAudio,
          mimeType: 'audio/wav',
          isFallback: true,
          quotaExceeded: true,
          message: 'Free tier limit reached (3 RPM). Using fallback comic narration audio.',
        });
        return;
      }
      throw e1;
    }

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('No audio returned by Gemini TTS');
    }

    // Cache successful audio
    ttsCache.set(cacheKey, base64Audio);

    res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.warn('[TTS] Generating fallback procedural audio due to error:', error.message);
    const fallbackAudio = generateProceduralSpeechWav(req.body?.text || 'Manhwa panel recap', req.body?.voice || 'Puck');
    res.json({
      success: true,
      audioBase64: fallbackAudio,
      mimeType: 'audio/wav',
      isFallback: true,
      error: error.message,
    });
  }
});

// API: Analyze multiple manhwa panels/PDF pages and generate complete sequenced recap
app.post('/api/gemini/generate-chapter-from-images', async (req: Request, res: Response) => {
  try {
    const { 
      images = [], // Array of { base64: string, mimeType?: string }
      chapterTitle = 'Uploaded Manhwa Chapter',
      tone = 'Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy)',
      userNotes = ''
    } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: 'At least one panel image is required.' });
      return;
    }

    const ai = getAiClient();

    // Prepare multimodal parts: each image labeled with its sequential index
    const parts: any[] = [];
    
    // Limit to max 12 images per single multimodal call for speed and reliability
    const limitedImages = images.slice(0, 12);

    limitedImages.forEach((img, idx) => {
      parts.push({
        text: `--- MANHWA PANEL ${idx + 1} OF ${limitedImages.length} ---`
      });
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: img.base64.replace(/^data:image\/[a-z]+;base64,/, ''),
        },
      });
    });

    const promptText = `You are @MamoruManhwa, the viral YouTube manhwa recap narrator known for hilarious comedy, speaking as the audience ("Chat, look at this guy"), and breaking the fourth wall.
Examine these ${limitedImages.length} sequential manhwa chapter panels.
Title/Premise: "${chapterTitle}"
Tone: ${tone}
User Notes: ${userNotes}

For EACH panel image in order from 1 to ${limitedImages.length}:
1. "title": Short punchy title for this scene/panel (e.g., "The Trash Awakening", "Demon Lord Nap Time", "Broken Dustpan Reveal").
2. "commentary": 1-3 lines of hilarious 4th-wall commentary reacting to the art, characters, and dialogue in this specific panel. Speak like you are in a live stream with the viewers ("Chat, bro really thought...", "Wait, why does his sword look like a surfboard?", "The artist definitely drew this with their left foot").
3. "suggestedCamera": One of ['crash-zoom', 'pan-down', 'pan-right', 'shake-impact', 'slow-drift', 'zoom-in', 'zoom-out']. 
   - Use 'crash-zoom' on character reaction faces.
   - Use 'pan-down' on tall vertical webtoon scroll panels.
   - Use 'shake-impact' on attack hits or punchlines.
   - Use 'pan-right' on action slashes.
4. "soundEffect": One of ['vine-boom', 'record-scratch', 'anime-punch', 'discord-ping', 'level-up', 'choir-epic', 'crickets', 'none'].
5. "transition": One of ['white-flash', 'glitch', 'fade', 'zoom-blur', 'slide-left'].
6. "durationSeconds": Estimated natural speaking duration (between 4.0 and 7.5 seconds).

Return a JSON array containing an object for each panel in matching order.`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    res.json({ success: true, panels: parsed });
  } catch (error: any) {
    console.error('Error generating chapter from images:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to process manhwa images' });
  }
});

// API: Check local Ollama status and list installed local models
app.post('/api/local/ollama/status', async (req: Request, res: Response) => {
  try {
    const { host = 'http://127.0.0.1:11434' } = req.body;
    const cleanHost = host.replace(/\/$/, '');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${cleanHost}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = await response.json();
    res.json({
      success: true,
      models: data.models || [],
      host: cleanHost,
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      error: error.message || 'Could not connect to local Ollama instance',
    });
  }
});

// API: Generate script or vision analysis using local Ollama model
app.post('/api/local/ollama/generate', async (req: Request, res: Response) => {
  try {
    const { 
      host = 'http://127.0.0.1:11434',
      model = 'llama3.2',
      prompt,
      system = 'You are an elite YouTube manhwa recap narrator in the comedic 4th-wall breaking style of @MamoruManhwa. Return valid JSON only.',
      images = [], // Optional base64 images for vision models like llama3.2-vision or llava
      format = 'json'
    } = req.body;

    const cleanHost = host.replace(/\/$/, '');

    // Format clean base64 image strings without headers
    const formattedImages = images.map((img: string) => 
      img.replace(/^data:image\/[a-z]+;base64,/, '')
    );

    const payload: any = {
      model,
      prompt,
      system,
      stream: false,
      format: format === 'json' ? 'json' : undefined,
    };

    if (formattedImages.length > 0) {
      payload.images = formattedImages;
    }

    const response = await fetch(`${cleanHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    res.json({
      success: true,
      response: data.response,
    });
  } catch (error: any) {
    console.error('Ollama generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate using local Ollama model',
    });
  }
});



// Setup Vite middlewares for development or static serving for production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ManhwaRecap Studio Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
