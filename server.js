// server.ts
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use(express.json({ limit: "50mb" }));
var getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the environment.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: "v1alpha",
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};
app.post("/api/gemini/generate-script", async (req, res) => {
  try {
    const {
      chapterTitle,
      genre = "Action Fantasy Manhwa",
      tone = "Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy)",
      panelDescriptions = [],
      userNotes = ""
    } = req.body;
    const ai = getAiClient();
    const isSimpleRecap = tone.toLowerCase().includes("simple");
    const systemPrompt = isSimpleRecap ? `You are a professional YouTube Manhwa Recap narrator in Simple Recap style.
Your goal:
- Deliver clear, immersive, engaging storytelling that summarizes the manhwa chapter.
- No distracting fourth-wall screams or sound effects: always set "soundEffect": "none".
- Camera motions must be calm and smooth: use "suggestedCamera": "slow-drift" or "pan-down".
- Each panel should have:
  1. commentary: 1-3 clear, engaging spoken lines suitable for text-to-speech (TTS) audio narration.
  2. suggestedCamera: 'slow-drift' or 'pan-down'.
  3. soundEffect: 'none'.
  4. subtitles: word-by-word or short phrases for clean captions.
  5. durationSeconds: estimated speaking duration (usually 4 to 8 seconds).` : `You are an elite YouTube Manhwa Recap creator in the iconic comedic style of @MamoruManhwa.
Your personality and tone:
- You speak as a viewer watching along with the audience ("Chat, look at this guy", "Bro really thought he had plot armor", "Wait, why does the villain look like a K-pop idol with anger issues?").
- You constantly BREAK THE FOURTH WALL: talk directly to the audience, roast the author/artist's tropes ("The artist clearly copy-pasted this horse", "Truck-kun took a vacation so they used a tractor"), question ridiculous power scaling, and call out clich\xE9s.
- High energy, snappy pacing, humorous commentary, playful hyperbole.
- Don't just narrate what happens ("He drew his sword") \u2014 add commentary ("Look at him pulling out a sword bigger than his rent bill").
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
${panelDescriptions.map((desc, i) => `Panel ${i + 1}: ${desc}`).join("\n")}

Return a valid JSON array of panel scripts.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json"
      }
    });
    const jsonText = response.text || "[]";
    const parsed = JSON.parse(jsonText);
    res.json({ success: true, panels: parsed });
  } catch (error) {
    console.error("Error generating script:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate recap script"
    });
  }
});
var ttsCache = /* @__PURE__ */ new Map();
var ttsQuotaCooldownUntil = 0;
function wrapPcmWithWavHeader(pcmBuffer, sampleRate = 24e3, channels = 1, bitsPerSample = 16) {
  if (pcmBuffer.length >= 44 && pcmBuffer.toString("ascii", 0, 4) === "RIFF") {
    return pcmBuffer;
  }
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}
app.post("/api/gemini/tts", async (req, res) => {
  try {
    const {
      text,
      voice = "Puck",
      // Puck, Fenrir, Zephyr, Kore, Charon
      style = "Energetic comedic YouTube manhwa recap narrator breaking the fourth wall"
    } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ success: false, error: "Text is required for TTS" });
      return;
    }
    const cleanText = text.trim();
    const cacheKey = `${voice}_${cleanText.toLowerCase()}`;
    if (ttsCache.has(cacheKey)) {
      res.json({
        success: true,
        audioBase64: ttsCache.get(cacheKey),
        mimeType: "audio/wav",
        cached: true
      });
      return;
    }
    if (Date.now() < ttsQuotaCooldownUntil) {
      const remainingSec = Math.ceil((ttsQuotaCooldownUntil - Date.now()) / 1e3);
      console.log(`[TTS] In Free Tier cooldown (${remainingSec}s remaining). Telling client to use natural browser voice.`);
      res.json({
        success: false,
        useBrowserVoice: true,
        quotaExceeded: true,
        cooldownSeconds: remainingSec,
        error: `Gemini TTS quota cooldown (${remainingSec}s remaining). Using natural browser voice.`
      });
      return;
    }
    const ai = getAiClient();
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: cleanText.slice(0, 500),
                speechMetadata: {
                  style: style || "Energetic manhwa recap narrator"
                }
              }
            ]
          }
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice || "Puck" }
            }
          }
        }
      });
    } catch (e1) {
      console.warn("[TTS] Gemini TTS API warning:", e1.message);
      if (e1.message?.includes("429") || e1.message?.includes("RESOURCE_EXHAUSTED") || e1.message?.includes("quota")) {
        ttsQuotaCooldownUntil = Date.now() + 55e3;
        res.json({
          success: false,
          useBrowserVoice: true,
          quotaExceeded: true,
          error: "Gemini TTS quota reached. Using clean browser speech synthesis."
        });
        return;
      }
      throw e1;
    }
    const rawData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!rawData) {
      throw new Error("No audio returned by Gemini TTS");
    }
    const rawBuffer = Buffer.from(rawData, "base64");
    const wavBuffer = wrapPcmWithWavHeader(rawBuffer, 24e3, 1, 16);
    const finalBase64 = wavBuffer.toString("base64");
    ttsCache.set(cacheKey, finalBase64);
    res.json({
      success: true,
      audioBase64: finalBase64,
      mimeType: "audio/wav"
    });
  } catch (error) {
    console.warn("[TTS] Gemini TTS unavailable:", error.message);
    res.json({
      success: false,
      useBrowserVoice: true,
      error: error.message || "TTS generation unavailable"
    });
  }
});
app.post("/api/gemini/detect-premise", async (req, res) => {
  try {
    const { images = [] } = req.body;
    if (!images || images.length === 0) {
      res.status(400).json({ error: "At least one image is required to detect premise." });
      return;
    }
    const ai = getAiClient();
    const parts = [];
    const sampleImages = images.slice(0, 4);
    sampleImages.forEach((img, idx) => {
      parts.push({ text: `[SAMPLE PAGE ${idx + 1}]` });
      parts.push({
        inlineData: {
          mimeType: img.mimeType || "image/jpeg",
          data: (img.base64 || img).replace(/^data:image\/[a-z]+;base64,/, "")
        }
      });
    });
    parts.push({
      text: `Analyze these sample manhwa pages carefully.
Look at:
1. All speech bubbles, thought balloons, signs, and title text (transcribe or translate Korean/English).
2. The protagonist (hair color, clothing, expressions, weapons, class/role).
3. The setting (modern dungeon, medieval fantasy, murim/martial arts, academy, sci-fi).
4. The key conflict or plot happening in these specific pictures.

Return a valid JSON object:
{
  "detectedTitle": "Likely or creative title for this manhwa/chapter",
  "genre": "e.g. Action Fantasy Hunter, Murim Comedy, Villainess Otome, Dungeon Crawl",
  "premise": "2-3 sentences explaining exactly what this manhwa is about based on the visual art and dialogue bubbles",
  "protagonist": "Description of the main character (appearance, role, demeanor)",
  "characters": ["Character 1 name/description", "Character 2 name/description"],
  "currentSituation": "What is specifically happening in these uploaded pages",
  "suggestedDirectorTweaks": "Suggested creative tweaks the creator can give to the AI narrator (e.g. 'Focus on the protagonist Kang Jinwoo outsmarting the guild leader; roast the ridiculous weapon proportions; highlight the comedic panic expressions')"
}`
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts },
      config: {
        systemInstruction: "You are an elite manhwa vision and lore expert. Accurately identify the real characters, genre, premise, and specific story events directly from the comic artwork and speech bubbles. Never guess generic tropes.",
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Error detecting manhwa premise:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to detect manhwa premise" });
  }
});
app.post("/api/gemini/generate-chapter-from-images", async (req, res) => {
  try {
    const {
      images = [],
      // Array of { base64: string, mimeType?: string }
      chapterTitle = "Uploaded Manhwa Chapter",
      tone = "Unhinged Mamoru (Comedic, 4th Wall, Meme-heavy)",
      userNotes = "",
      segmentIndex = 0,
      totalSegments = 1,
      previousContext = ""
    } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: "At least one panel image is required." });
      return;
    }
    const ai = getAiClient();
    const parts = [];
    const limitedImages = images.slice(0, 16);
    limitedImages.forEach((img, idx) => {
      const panelNum = segmentIndex * limitedImages.length + idx + 1;
      parts.push({
        text: `--- MANHWA PANEL ${panelNum} (Segment ${segmentIndex + 1}/${totalSegments}, Image ${idx + 1}/${limitedImages.length}) ---`
      });
      parts.push({
        inlineData: {
          mimeType: img.mimeType || "image/jpeg",
          data: img.base64.replace(/^data:image\/[a-z]+;base64,/, "")
        }
      });
    });
    const isSimpleRecap = tone.toLowerCase().includes("simple");
    const promptText = isSimpleRecap ? `You are a professional YouTube Manhwa Recap narrator in Simple Recap style.
Examine these ${limitedImages.length} sequential manhwa chapter panels (Segment ${segmentIndex + 1} of ${totalSegments}).
Chapter Title: "${chapterTitle}"
Tone: Simple Recap (Immersive, clean storytelling, NO sound effects, smooth fades, 16:9 widescreen default)
Story Context Established So Far:
"${previousContext || "Beginning of the chapter."}"

USER DIRECTOR TWEAKS & INSTRUCTIONS:
"${userNotes || "Recap accurately based on the panel art and dialogue."}"

CRITICAL MANDATORY INSTRUCTIONS - ZERO GENERIC PLACEHOLDERS:
1. READ EVERY SPEECH BUBBLE, THOUGHT BALLOON, AND SYSTEM WINDOW (OCR). Transcribe the dialogue into "detectedDialogue".
2. DO NOT USE GENERIC CLICH\xC9S (such as "our protagonist faces the darkest depths" or "the enemies realize too late").
3. Narrate the SPECIFIC visual actions and character interactions shown in each image: what the characters actually say, what skills or items appear, and their emotional reactions.
4. In "commentary": 1-3 lines of natural, engaging storytelling directly summarizing that specific image.
5. In "segmentSummary": A 2-sentence summary of what happened in this segment to maintain continuity for the next segment.

For EACH panel image in order from 1 to ${limitedImages.length}:
{
  "title": Short descriptive title for this scene/panel,
  "detectedDialogue": Exact speech bubbles / narration read from the image,
  "commentary": Spoken voiceover recap line grounded in the art and dialogue,
  "suggestedCamera": 'slow-drift' or 'pan-down',
  "soundEffect": 'none',
  "transition": 'fade',
  "durationSeconds": Estimated natural speaking duration (between 4.0 and 7.5 seconds)
}

Return a valid JSON object:
{
  "panels": [...],
  "segmentSummary": "Summary of this segment's story progression"
}` : `You are @MamoruManhwa, the iconic viral YouTube manhwa recap narrator known for hilarious comedy, breaking the fourth wall, and speaking directly to the audience ("Chat, look at this guy!").
Examine these ${limitedImages.length} sequential manhwa chapter panels (Segment ${segmentIndex + 1} of ${totalSegments}).
Chapter Title: "${chapterTitle}"
Tone: ${tone}
Story Context Established So Far:
"${previousContext || "Beginning of the chapter."}"

USER DIRECTOR TWEAKS & INSTRUCTIONS:
"${userNotes || "Roast the tropes and commentary on the art."}"

CRITICAL MANDATORY INSTRUCTIONS - ZERO GENERIC PLACEHOLDERS:
1. READ EVERY SPEECH BUBBLE, THOUGHT BALLOON, SYSTEM WINDOW, AND SFX (OCR). Transcribe what is said into "detectedDialogue".
2. ABSOLUTELY NO GENERIC CLICH\xC9S (DO NOT say "bro faces the darkest depths" or generic hunter fluff). Mention the EXACT characters, expressions, weird monster faces, goofy anatomy, and specific lines spoken.
3. IN "commentary": Write 1-3 punchy, hilarious, unhinged lines reacting directly to what is happening in this specific panel. Talk to the audience ("Chat, look at bro's face right now", "He really thought he had plot armor with that rusty dagger").
4. In "segmentSummary": A 2-sentence summary of what happened in this segment to pass to the next segment.

For EACH panel image in order from 1 to ${limitedImages.length}:
{
  "title": Short punchy comedic title for this scene,
  "detectedDialogue": Exact speech bubbles / narration read from the image,
  "commentary": Hilarious 4th-wall commentary reacting to the characters and artwork,
  "suggestedCamera": One of ['crash-zoom', 'pan-down', 'pan-right', 'shake-impact', 'slow-drift', 'zoom-in', 'zoom-out'],
  "soundEffect": One of ['vine-boom', 'record-scratch', 'anime-punch', 'discord-ping', 'level-up', 'choir-epic', 'crickets', 'none'],
  "transition": One of ['white-flash', 'glitch', 'fade', 'zoom-blur', 'slide-left'],
  "durationSeconds": Estimated natural speaking duration (between 4.0 and 7.5 seconds)
}

Return a valid JSON object:
{
  "panels": [...],
  "segmentSummary": "Summary of this segment's story progression"
}`;
    parts.push({ text: promptText });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts },
      config: {
        systemInstruction: "You are an elite manhwa vision and dialogue analyzer. Always read speech bubbles and text in images with high OCR accuracy and ground all scripts in the actual character dialogue. Never output generic template lines.",
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    const panelsList = Array.isArray(parsed) ? parsed : parsed.panels || [];
    const segmentSummary = parsed.segmentSummary || "";
    res.json({ success: true, panels: panelsList, segmentSummary });
  } catch (error) {
    console.error("Error generating chapter from images:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to process manhwa images" });
  }
});
app.post("/api/gemini/analyze-panel", async (req, res) => {
  try {
    const {
      imageBase64,
      chapterTitle = "Manhwa Chapter",
      tone = "Simple Recap (Clean storytelling, no SFX)",
      context = ""
    } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 is required." });
      return;
    }
    const ai = getAiClient();
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    const isSimple = tone.toLowerCase().includes("simple");
    const prompt = `You are an expert manhwa recap director and voiceover writer.
Carefully examine this manhwa comic panel image.
Title / Context: "${chapterTitle}" - ${context}
Style: ${isSimple ? "Simple Recap (Clean story summary, no sound effects, TTS-ready lines)" : "Mamoru Style (Comedic 4th wall roast)"}

MANDATORY INSTRUCTIONS:
1. READ ALL SPEECH BUBBLES, thought balloons, narration boxes, signs, and system message screens visible in this image.
2. In "detectedDialogue": Transcribe the exact text from the speech bubbles and narration boxes.
3. In "commentary": Write a 1-3 line voiceover recap script that summarizes this panel BASED DIRECTLY ON what the characters are saying and doing in the image.
4. In "title": Short punchy title for this scene.
5. In "suggestedCamera": ${isSimple ? "'slow-drift' or 'pan-down'" : "'crash-zoom' | 'pan-down' | 'pan-right' | 'shake-impact' | 'slow-drift'"}.
6. In "soundEffect": ${isSimple ? "'none'" : "'none' | 'vine-boom' | 'record-scratch' | 'anime-punch' | 'discord-ping' | 'level-up'"}.
7. In "durationSeconds": Estimated natural speaking duration (between 4.0 and 7.5s).

Return a valid JSON object:
{
  "title": string,
  "detectedDialogue": string,
  "commentary": string,
  "suggestedCamera": string,
  "soundEffect": string,
  "durationSeconds": number
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64
          }
        },
        { text: prompt }
      ],
      config: {
        systemInstruction: "You are an expert manhwa vision and dialogue analyzer. Always read speech bubbles and text in images with high OCR accuracy and ground all scripts in the actual character dialogue.",
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Error analyzing panel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to analyze panel image" });
  }
});
app.post("/api/gemini/analyze-visual-complexity", async (req, res) => {
  try {
    const {
      panels = [],
      chapterTitle = "Manhwa Chapter",
      tone = "Simple Recap (Clean storytelling, no SFX)"
    } = req.body;
    if (!Array.isArray(panels) || panels.length === 0) {
      res.status(400).json({ success: false, error: "panels array is required." });
      return;
    }
    const ai = getAiClient();
    const isSimple = tone.toLowerCase().includes("simple");
    const slicedPanels = panels.slice(0, 8);
    const contents = [];
    slicedPanels.forEach((p) => {
      if (p.imageBase64) {
        const cleanBase64 = p.imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        contents.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64
          }
        });
      }
    });
    const prompt = `You are an expert anime & manhwa video editor and director specializing in visual pacing, kinetic framing, and voiceover synchronization.
Examine each attached manhwa panel image in sequential order (total ${slicedPanels.length} images).

Chapter Context: "${chapterTitle}"
Recap Style: ${isSimple ? "Clean Narrative Recap" : "Dynamic Mamoru Style"}

YOUR TASK:
Analyze the VISUAL COMPLEXITY and FRAME INTENSITY of each panel frame, and calculate the EXACT ideal dialogue duration so the narrator's spoken pacing perfectly matches what the viewer's eye needs to process.

EVALUATION CRITERIA FOR EACH PANEL:
1. visualComplexityScore (1 to 10):
   - 1-3: Low complexity (simple reaction face, single character silhouette, minimal background, comedic gag cut).
   - 4-6: Medium complexity (two-shot dialogue exchange, moderate background details, standard movement).
   - 7-8: High complexity (combat scene, multiple action lines, spell aura effects, multiple enemies or debris).
   - 9-10: Extreme complexity (epic double-spread climax, huge magical explosion, intricate status window with lots of text, dense army battle).
2. complexityLevel: 'low' | 'medium' | 'high' | 'extreme'.
3. intensityType: 'action-combat' | 'dense-lore' | 'dialogue-heavy' | 'reaction-gag' | 'establishing-shot' | 'dramatic-climax'.
4. visualDescription: Concise 1-sentence description of the visual scene in the image (actions, characters, auras, bubbles).
5. suggestedDurationSeconds:
   - Low complexity: 2.5s to 3.8s (quick punchy beat, avoids dragging).
   - Medium complexity: 4.0s to 5.2s (standard balanced storytelling).
   - High complexity: 5.5s to 7.0s (gives time to absorb combat intensity and detail).
   - Extreme complexity: 7.2s to 8.5s (dramatic climaxes and detailed system screen reveals).
6. suggestedWordCount: Recommended number of spoken words for the voiceover narrator (calculated at ~2.5 to 2.8 words per second of duration).
7. pacingRecommendation: Short tag like "Rapid Punch (3.2s)", "Intense Combat (6.5s)", "Dense Lore (5.8s)", "Dramatic Climax (7.5s)", "Snappy Gag (2.8s)".
8. pacingRationale: Why this duration was chosen based on the visual density of the frame.
9. suggestedCommentary: 1-2 sentence voiceover narration draft that matches this exact word count and visual tempo.
10. detectedDialogue: Transcribed text from any speech bubbles or status windows.

Return a valid JSON object with an "analyses" array containing one object per panel in order:
{
  "analyses": [
    {
      "panelIndex": number,
      "panelId": string,
      "visualComplexityScore": number,
      "complexityLevel": "low" | "medium" | "high" | "extreme",
      "intensityType": string,
      "visualDescription": string,
      "suggestedDurationSeconds": number,
      "suggestedWordCount": number,
      "pacingRecommendation": string,
      "pacingRationale": string,
      "suggestedCommentary": string,
      "detectedDialogue": string
    }
  ]
}`;
    contents.push({ text: prompt });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction: "You are an elite video editing director specializing in manhwa visual pacing and frame complexity analysis. Always return precise durations and word counts matched to visual intensity.",
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || '{"analyses":[]}');
    const analyses = (parsed.analyses || []).map((a, i) => ({
      ...a,
      panelId: slicedPanels[i]?.id || `panel_${i}`,
      panelIndex: i
    }));
    res.json({ success: true, analyses });
  } catch (error) {
    console.error("Error analyzing visual complexity:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to analyze visual complexity" });
  }
});
app.post("/api/local/ollama/status", async (req, res) => {
  try {
    const { host = "http://127.0.0.1:11434" } = req.body;
    const cleanHost = host.replace(/\/$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4e3);
    const response = await fetch(`${cleanHost}/api/tags`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }
    const data = await response.json();
    res.json({
      success: true,
      models: data.models || [],
      host: cleanHost
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: error.message || "Could not connect to local Ollama instance"
    });
  }
});
app.post("/api/local/ollama/generate", async (req, res) => {
  try {
    const {
      host = "http://127.0.0.1:11434",
      model = "llama3.2",
      prompt,
      system = "You are an elite YouTube manhwa recap narrator in the comedic 4th-wall breaking style of @MamoruManhwa. Return valid JSON only.",
      images = [],
      // Optional base64 images for vision models like llama3.2-vision or llava
      format = "json"
    } = req.body;
    const cleanHost = host.replace(/\/$/, "");
    const formattedImages = images.map(
      (img) => img.replace(/^data:image\/[a-z]+;base64,/, "")
    );
    const payload = {
      model,
      prompt,
      system,
      stream: false,
      format: format === "json" ? "json" : void 0
    };
    if (formattedImages.length > 0) {
      payload.images = formattedImages;
    }
    const response = await fetch(`${cleanHost}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errText}`);
    }
    const data = await response.json();
    res.json({
      success: true,
      response: data.response
    });
  } catch (error) {
    console.error("Ollama generation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate using local Ollama model"
    });
  }
});
async function startServer() {
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log("\n=======================================================================");
    console.log(`  ManhwaRecap Studio Server is RUNNING!`);
    console.log(`  >>> OPEN IN YOUR BROWSER: http://localhost:${PORT} <<<`);
    console.log(`  >>> ALTERNATIVE LINK:    http://127.0.0.1:${PORT} <<<`);
    console.log(`  IMPORTANT: On Windows, use 'http://localhost:${PORT}'`);
    console.log(`  Do NOT type '0.0.0.0:${PORT}' in Chrome (Windows will show ERR_ADDRESS_INVALID)`);
    console.log("=======================================================================\n");
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
