# ManhwaRecap AI Studio

Create viral, 4th-wall breaking YouTube Manhwa Recap videos with comedic AI voiceover, dynamic camera pan/zoom animations, kinetic karaoke subtitles, manga transition effects, and 1080p WebM/MP4 export.

---

## ⚡ 1-Click Instant Launcher (No Terminal Needed!)

After extracting your downloaded ZIP file, you can run the whole app with **one double-click**:

### On Windows:
- Double-click **`LAUNCH_APP.bat`** (or **`run.bat`** / **`start.bat`**).
- It automatically:
  1. Sets the directory directly to your app folder so it never gets lost.
  2. Detects Node.js on your computer (and offers automatic 1-click install if missing).
  3. Sets up your `.env` configuration file automatically.
  4. Automatically runs `npm install` on first launch to install all requirements.
  5. Starts both the backend and frontend servers on `http://localhost:3000`.
  6. **Automatically opens your web browser to `http://localhost:3000`** so you can start creating immediately!
  7. If anything ever goes wrong, it keeps the window open so you can see the message.

### On Linux & macOS:
- Double-click or run **`./start-app.sh`** (or `./start-app.bin`).
- It will verify Node.js, install dependencies, launch the server, and automatically open your browser.

---

## 🚀 Manual Terminal Start (Alternative)

If you prefer using the command line:

### 1. Prerequisites
- **Node.js**: Version **18+** or **20+** installed ([Download Node.js](https://nodejs.org/)).
- **Package Manager**: `npm` (comes bundled with Node.js).
- **Gemini API Key**: (Optional, for Cloud Gemini AI scriptwriting & Gemini TTS). Get a free key at [Google AI Studio](https://aistudio.google.com/).
- *(Optional for 100% offline local AI)*: [Ollama](https://ollama.com/) if you want local LLMs (e.g. `llama3.1`, `mistral`, `deepseek-r1`).

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   - On Windows (CMD):
     ```cmd
     copy .env.example .env
     ```
   - On Windows (PowerShell) / Mac / Linux:
     ```bash
     cp .env.example .env
     ```
   Open `.env` in a text editor (like Notepad or VS Code) and add your Gemini API Key:
   ```env
   GEMINI_API_KEY="your-gemini-api-key-here"
   PORT=3000
   ```
   *(Note: Even without a Gemini key, the app still works! You can use browser text-to-speech, local web models, or local Ollama).*

5. **Start the Application**:
   ```bash
   npm run dev
   ```

6. **Open in Your Browser**:
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## ⚡ Running Locally with Your GPU (RTX 5070 Ti + 32GB RAM)

With an **RTX 5070 Ti (16GB VRAM)** and **32GB RAM**, your machine is ideal for fast local inference:

### Option A: Local Script Generation via Ollama
1. Install [Ollama](https://ollama.com/).
2. Run any model in your terminal:
   ```bash
   ollama run llama3.1:8b
   # or
   ollama run mistral
   ```
3. In the app's **Auto Recap Wizard**, choose **Local AI Engine -> Ollama (Local Server)**. It will connect to `http://localhost:11434` automatically.

### Option B: In-Browser Transformers (ONNX / WebGPU)
- The app supports in-browser ONNX inference with WebGPU acceleration.
- Under **Settings / Engine**, switch to **In-Browser Model** to run speech and vision models client-side without sending data to external servers.

---

## 🛠️ Available Scripts

- `npm run dev`: Starts the Express + Vite unified server at `http://localhost:3000`.
- `npm run build`: Compiles production frontend bundle to the `dist/` folder.
- `npm start`: Runs the production server with pre-built assets.
- `npm run lint`: Checks TypeScript types.

---

## 🎬 Key Features
- **Smart Chapter Importer**: Drag & drop manhwa PNG/JPG panel images or PDF chapters.
- **Mamoru-style 4th-Wall Script Engine**: Generates comedic commentary reacting to tropes, author clichés, and meme moments.
- **Voiceover Studio**: Multi-voice TTS, volume, pitch, speed, and audio waveform inspector.
- **Kinetic Subtitle Studio**: Bangers, Cabinet Grotesk, Anton fonts, comic punch stroke outlines, custom highlight colors, and shadow glow.
- **Camera Pan & Zoom**: Crash zoom, slow drift, pan down, and shake impact.
- **Manga Transitions**: Comic page turn, ink splatter, speed lines, blade slash, and white flash.
- **1080p Video Exporter**: Real-time canvas rendering with background music ducking and video download.
