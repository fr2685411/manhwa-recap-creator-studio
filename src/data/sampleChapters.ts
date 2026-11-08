import { ProjectSettings } from '../types/manhwa';

// Helper to create crisp, stylized manhwa comic panel SVG Data URLs
function createComicSvg(options: {
  bgGradient: [string, string];
  title: string;
  badge?: string;
  elements: string; // SVG inner elements
  actionLines?: boolean;
  systemBox?: { title: string; lines: string[] };
}): string {
  const { bgGradient, title, badge, elements, actionLines, systemBox } = options;
  
  const actionLinesSvg = actionLines ? `
    <g stroke="rgba(255,255,255,0.18)" stroke-width="2">
      <line x1="0" y1="0" x2="360" y2="480" />
      <line x1="720" y1="0" x2="360" y2="480" />
      <line x1="0" y1="960" x2="360" y2="480" />
      <line x1="720" y1="960" x2="360" y2="480" />
      <line x1="360" y1="0" x2="360" y2="960" stroke-width="1.5" stroke-dasharray="6,6" />
      <line x1="0" y1="480" x2="720" y2="480" stroke-width="1.5" stroke-dasharray="6,6" />
    </g>
  ` : '';

  const systemBoxSvg = systemBox ? `
    <g transform="translate(110, 160)">
      <rect width="500" height="200" rx="12" fill="rgba(8, 25, 45, 0.92)" stroke="#38bdf8" stroke-width="3" filter="drop-shadow(0 0 15px rgba(56, 189, 248, 0.6))" />
      <rect x="0" y="0" width="500" height="38" rx="12" fill="#0284c7" />
      <text x="20" y="26" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="16" fill="#ffffff" letter-spacing="2">SYSTEM NOTIFICATION</text>
      <text x="250" y="80" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="22" fill="#38bdf8">${systemBox.title}</text>
      ${systemBox.lines.map((l, i) => `
        <text x="250" y="${120 + i * 28}" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-weight="700" font-size="16" fill="#e0f2fe">${l}</text>
      `).join('')}
    </g>
  ` : '';

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960" width="720" height="960">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}" />
        <stop offset="100%" stop-color="${bgGradient[1]}" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.8" />
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.8" />
      </filter>
    </defs>
    <rect width="720" height="960" fill="url(#bg)" />
    <rect width="720" height="960" fill="url(#glow)" />
    ${actionLinesSvg}
    
    <!-- Manga Half-tone Dots / Border -->
    <rect x="18" y="18" width="684" height="924" fill="none" stroke="#ffffff" stroke-width="6" rx="16" opacity="0.3" />

    ${elements}
    ${systemBoxSvg}

    <!-- Panel Header Banner -->
    <g transform="translate(40, 50)">
      <rect width="260" height="42" rx="8" fill="#18181b" stroke="#f59e0b" stroke-width="2" />
      <text x="20" y="27" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="16" fill="#fbbf24" letter-spacing="1.5">MANHWA CH. 01</text>
    </g>
    ${badge ? `
    <g transform="translate(480, 50)">
      <rect width="200" height="42" rx="8" fill="#dc2626" stroke="#fca5a5" stroke-width="2" />
      <text x="100" y="27" text-anchor="middle" font-family="'Cabinet Grotesk', sans-serif" font-weight="900" font-size="18" fill="#ffffff">${badge}</text>
    </g>` : ''}
  </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Procedural high-energy comic voice WAV generator to ensure preloaded audio with 0 network calls
function createSampleVoiceWav(text: string, basePitch = 165): string {
  const sampleRate = 22050;
  const words = text.split(/\s+/).filter(Boolean);
  const dur = Math.max(2.0, Math.min(8.0, words.length * 0.38));
  const totalSamples = Math.floor(sampleRate * dur);
  const numSyllables = Math.max(3, Math.round(words.length * 1.55));
  const sylDuration = dur / numSyllables;

  const buffer = new Uint8Array(44 + totalSamples * 2);
  const view = new DataView(buffer.buffer);

  // RIFF header
  buffer.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
  view.setUint32(4, 36 + totalSamples * 2, true);
  buffer.set([0x57, 0x41, 0x56, 0x45], 8); // 'WAVE'
  buffer.set([0x66, 0x6d, 0x74, 0x20], 12); // 'fmt '
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16-bit
  buffer.set([0x64, 0x61, 0x74, 0x61], 36); // 'data'
  view.setUint32(40, totalSamples * 2, true);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const sylIndex = Math.floor(t / sylDuration);
    const sylT = (t % sylDuration) / sylDuration;
    const sylEnv = Math.sin(Math.PI * Math.min(1, Math.max(0, sylT)));

    const f0 = basePitch + Math.sin(sylIndex * 1.6) * 22 + Math.sin(t * 7.5) * 8;
    const osc1 = Math.sin(2 * Math.PI * f0 * t);
    const osc2 = Math.sin(2 * Math.PI * (f0 * 2.05) * t) * 0.42;
    const osc3 = Math.sin(2 * Math.PI * (f0 * 3.1) * t) * 0.22;
    const voiceTone = (osc1 + osc2 + osc3) * Math.pow(sylEnv, 1.2);

    const sampleVal = Math.max(-0.95, Math.min(0.95, voiceTone * 0.65));
    const intVal = Math.floor(sampleVal * 32767);
    view.setInt16(44 + i * 2, intVal, true);
  }

  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

// Pre-crafted Sample Chapters
export const SAMPLE_PROJECTS: Record<string, ProjectSettings> = {
  'janitor-hunter': {
    id: 'janitor-hunter',
    title: 'I Transmigrated as an F-Rank Cleaner with an SSS-Grade Dustpan',
    aspectRatio: '9:16',
    bgmTrack: 'phonk-combat',
    bgmVolume: 0.35,
    voiceVolume: 1.0,
    voicePersona: 'Puck',
    voiceEngine: 'gemini',
    humorTone: 'unhinged-mamoru',
    subtitleStyle: {
      fontFamily: 'Cabinet Grotesk',
      fontSize: 54,
      textColor: '#ffffff',
      highlightColor: '#fbbf24',
      strokeColor: '#000000',
      strokeWidth: 7,
      positionY: 82,
      animation: 'pop-karaoke',
    },
    panels: [
      {
        id: 'p1',
        title: 'The Slime Dungeon Awakening',
        imageUrl: createComicSvg({
          bgGradient: ['#1e1b4b', '#0f172a'],
          title: 'Floor Sweeper Awakening',
          badge: 'F-RANK MC',
          actionLines: true,
          systemBox: {
            title: '[CLASS UNLOCKED: JANITOR]',
            lines: ['Current Level: 1', 'Agility: 3  |  Charisma: -10', 'Unique Skill: Trash Compression'],
          },
          elements: `
            <!-- Dungeon Vortex & Sad MC Silhouette -->
            <circle cx="360" cy="560" r="160" fill="#312e81" opacity="0.6" filter="blur(20px)" />
            <circle cx="360" cy="560" r="110" fill="#4338ca" opacity="0.8" />
            <path d="M320 680 L360 490 L400 680 Z" fill="#09090b" />
            <circle cx="360" cy="460" r="34" fill="#09090b" />
            <!-- Sweat drop on MC -->
            <path d="M390 440 C395 430 405 440 405 450 C405 458 397 460 390 454 Z" fill="#38bdf8" />
            <!-- Slimes crawling -->
            <ellipse cx="220" cy="740" rx="45" ry="32" fill="#22c55e" opacity="0.9" />
            <ellipse cx="500" cy="730" rx="55" ry="38" fill="#22c55e" opacity="0.9" />
            <circle cx="210" cy="735" r="5" fill="#ffffff" />
            <circle cx="230" cy="735" r="5" fill="#ffffff" />
          `,
        }),
        duration: 5.5,
        commentary: 'Chat look at this! Bro died from stubbing his pinky toe and got transmigrated as a dungeon janitor!',
        camera: {
          type: 'pan-down',
          start: { x: 0.5, y: 0.25, zoom: 1.15 },
          end: { x: 0.5, y: 0.65, zoom: 1.35 },
          shakeIntensity: 0.3,
          shakeTime: 1.2,
          easing: 'ease-in-out',
        },
        transition: 'white-flash',
        soundEffect: 'record-scratch',
        soundEffectTime: 1.2,
        audioBase64: createSampleVoiceWav('Chat look at this! Bro died from stubbing his pinky toe and got transmigrated as a dungeon janitor!', 165),
        subtitles: [
          { text: 'Chat', startTime: 0.0, endTime: 0.7, isPunch: true },
          { text: 'look', startTime: 0.7, endTime: 1.1 },
          { text: 'at', startTime: 1.1, endTime: 1.4 },
          { text: 'this!', startTime: 1.4, endTime: 2.1, isPunch: true },
          { text: 'Bro', startTime: 2.1, endTime: 2.6, isPunch: true },
          { text: 'died', startTime: 2.6, endTime: 3.1 },
          { text: 'from', startTime: 3.1, endTime: 3.5 },
          { text: 'stubbing', startTime: 3.5, endTime: 4.1 },
          { text: 'his', startTime: 4.1, endTime: 4.4 },
          { text: 'pinky', startTime: 4.4, endTime: 4.9 },
          { text: 'toe', startTime: 4.9, endTime: 5.5, isPunch: true },
        ],
      },
      {
        id: 'p2',
        title: 'The Godly Golden Dustpan',
        imageUrl: createComicSvg({
          bgGradient: ['#451a03', '#1c1917'],
          title: 'Divine Dustpan',
          badge: 'SSS-RANK ARTIFACT',
          actionLines: true,
          elements: `
            <!-- Radiating Gold Ray burst -->
            <circle cx="360" cy="480" r="240" fill="#f59e0b" opacity="0.3" filter="blur(30px)" />
            <!-- Giant Floating Dustpan with holy runes -->
            <g transform="translate(240, 360) rotate(-15 120 120)" filter="url(#shadow)">
              <rect x="40" y="30" width="180" height="130" rx="14" fill="#fbbf24" stroke="#fef08a" stroke-width="6" />
              <rect x="110" y="160" width="35" height="150" rx="8" fill="#d97706" stroke="#fef08a" stroke-width="4" />
              <circle cx="128" cy="90" r="28" fill="#ef4444" stroke="#ffffff" stroke-width="4" />
              <text x="128" y="97" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="20" fill="#ffffff">SSS</text>
            </g>
            <!-- Shocked MC Face bottom left -->
            <g transform="translate(60, 680)">
              <ellipse cx="90" cy="90" rx="60" ry="70" fill="#fde047" stroke="#000000" stroke-width="5" />
              <circle cx="70" cy="75" r="16" fill="#000000" />
              <circle cx="110" cy="75" r="16" fill="#000000" />
              <ellipse cx="90" cy="120" rx="28" ry="32" fill="#ef4444" />
            </g>
          `,
        }),
        duration: 5.2,
        commentary: 'Wait, why does his plastic dustpan have 999,999 holy damage?! The author completely gave up on game balance!',
        camera: {
          type: 'crash-zoom',
          start: { x: 0.5, y: 0.45, zoom: 1.0 },
          end: { x: 0.52, y: 0.42, zoom: 2.1 },
          shakeIntensity: 0.7,
          shakeTime: 1.5,
          easing: 'punch',
        },
        transition: 'glitch',
        soundEffect: 'vine-boom',
        soundEffectTime: 1.4,
        audioBase64: createSampleVoiceWav('Wait, why does his plastic dustpan have 999,999 holy damage?! The author completely gave up on game balance!', 175),
        subtitles: [
          { text: 'Wait,', startTime: 0.0, endTime: 0.8, isPunch: true },
          { text: 'why', startTime: 0.8, endTime: 1.2 },
          { text: 'does', startTime: 1.2, endTime: 1.5 },
          { text: 'his', startTime: 1.5, endTime: 1.8 },
          { text: 'dustpan', startTime: 1.8, endTime: 2.5, isPunch: true },
          { text: 'have', startTime: 2.5, endTime: 2.9 },
          { text: '999K', startTime: 2.9, endTime: 3.6, isPunch: true },
          { text: 'holy', startTime: 3.6, endTime: 4.1 },
          { text: 'damage?!', startTime: 4.1, endTime: 5.2, isPunch: true },
        ],
      },
      {
        id: 'p3',
        title: '10-Meter Roided Orc Boss',
        imageUrl: createComicSvg({
          bgGradient: ['#7f1d1d', '#450a0a'],
          title: 'Dungeon Boss',
          badge: 'THREAT: DISASTER',
          actionLines: true,
          elements: `
            <!-- Terrifying Red Orc Silhouette with glowing eyes -->
            <path d="M160 840 Q360 480 560 840 Z" fill="#991b1b" stroke="#000000" stroke-width="8" />
            <!-- Massive Traps and Shoulders -->
            <circle cx="210" cy="590" r="85" fill="#b91c1c" />
            <circle cx="510" cy="590" r="85" fill="#b91c1c" />
            <!-- Glowing Red Eyes -->
            <ellipse cx="310" cy="460" rx="26" ry="14" fill="#fef08a" filter="drop-shadow(0 0 10px #f59e0b)" />
            <ellipse cx="410" cy="460" rx="26" ry="14" fill="#fef08a" filter="drop-shadow(0 0 10px #f59e0b)" />
            <circle cx="310" cy="460" r="8" fill="#dc2626" />
            <circle cx="410" cy="460" r="8" fill="#dc2626" />
            <!-- Veins popping -->
            <path d="M210 540 Q230 520 220 500" stroke="#fca5a5" stroke-width="4" fill="none" />
            <path d="M510 540 Q490 520 500 500" stroke="#fca5a5" stroke-width="4" fill="none" />
          `,
        }),
        duration: 4.8,
        commentary: 'Enter the boss: a 10-foot tall goblin on 400 grams of pre-workout looking like he wants his lunch money back.',
        camera: {
          type: 'pan-right',
          start: { x: 0.3, y: 0.5, zoom: 1.2 },
          end: { x: 0.7, y: 0.5, zoom: 1.45 },
          shakeIntensity: 0.4,
          easing: 'ease-in-out',
        },
        transition: 'fade',
        soundEffect: 'anime-punch',
        soundEffectTime: 0.8,
        audioBase64: createSampleVoiceWav('Enter the boss: a 10-foot tall goblin on 400 grams of pre-workout looking like he wants his lunch money back.', 145),
        subtitles: [
          { text: 'Enter', startTime: 0.0, endTime: 0.6 },
          { text: 'the', startTime: 0.6, endTime: 0.9 },
          { text: 'boss:', startTime: 0.9, endTime: 1.5, isPunch: true },
          { text: '400', startTime: 1.5, endTime: 2.1 },
          { text: 'grams', startTime: 2.1, endTime: 2.6 },
          { text: 'of', startTime: 2.6, endTime: 2.9 },
          { text: 'pre-workout', startTime: 2.9, endTime: 3.7, isPunch: true },
          { text: 'demon!', startTime: 3.7, endTime: 4.8, isPunch: true },
        ],
      },
      {
        id: 'p4',
        title: 'The Slap of Absolute Cleansing',
        imageUrl: createComicSvg({
          bgGradient: ['#0f172a', '#0284c7'],
          title: 'Impact Cleansing',
          badge: 'ONE SHOT GG',
          actionLines: true,
          elements: `
            <!-- Massive Kinetic Comic Slash Impact -->
            <path d="M60 880 L660 120" stroke="#ffffff" stroke-width="18" stroke-linecap="round" />
            <path d="M40 860 L640 100" stroke="#38bdf8" stroke-width="8" stroke-linecap="round" />
            <!-- Comic text BAMMM -->
            <text x="360" y="520" text-anchor="middle" font-family="'Bangers', 'Cabinet Grotesk', cursive" font-size="110" fill="#fde047" stroke="#000000" stroke-width="12" letter-spacing="6">SWEEEEP!</text>
            <!-- Flying teeth and stars -->
            <circle cx="210" cy="380" r="14" fill="#ffffff" stroke="#000000" stroke-width="3" />
            <circle cx="490" cy="620" r="14" fill="#ffffff" stroke="#000000" stroke-width="3" />
          `,
        }),
        duration: 5.0,
        commentary: 'My boy did not even use a spell! He just swept this demon into the recycling bin like Monday morning trash!',
        camera: {
          type: 'shake-impact',
          start: { x: 0.5, y: 0.5, zoom: 1.3 },
          end: { x: 0.5, y: 0.5, zoom: 1.6 },
          shakeIntensity: 1.0,
          shakeTime: 1.0,
          easing: 'punch',
        },
        transition: 'white-flash',
        soundEffect: 'vine-boom',
        soundEffectTime: 1.0,
        audioBase64: createSampleVoiceWav('My boy did not even use a spell! He just swept this demon into the recycling bin like Monday morning trash!', 170),
        subtitles: [
          { text: 'My', startTime: 0.0, endTime: 0.4 },
          { text: 'boy', startTime: 0.4, endTime: 0.8, isPunch: true },
          { text: 'swept', startTime: 0.8, endTime: 1.4, isPunch: true },
          { text: 'him', startTime: 1.4, endTime: 1.8 },
          { text: 'into', startTime: 1.8, endTime: 2.2 },
          { text: 'the', startTime: 2.2, endTime: 2.5 },
          { text: 'RECYCLING', startTime: 2.5, endTime: 3.4, isPunch: true },
          { text: 'BIN!', startTime: 3.4, endTime: 5.0, isPunch: true },
        ],
      },
      {
        id: 'p5',
        title: 'Level 9999 Janitor God',
        imageUrl: createComicSvg({
          bgGradient: ['#14532d', '#052e16'],
          title: 'Max Level',
          badge: 'SYSTEM BROKEN',
          actionLines: true,
          systemBox: {
            title: '[MAX LEVEL REACHED]',
            lines: ['New Title: The Custodian of Destiny', 'EXP Overflow: +999,999,999', 'Boss Loot: Infinite Golden Broom'],
          },
          elements: `
            <!-- God rays and glowing halo -->
            <circle cx="360" cy="560" r="180" fill="#22c55e" opacity="0.3" filter="blur(25px)" />
            <circle cx="360" cy="560" r="100" fill="#4ade80" opacity="0.5" />
            <circle cx="360" cy="420" r="60" fill="none" stroke="#fef08a" stroke-width="8" filter="drop-shadow(0 0 10px #f59e0b)" />
            <!-- Standing MC in heroic pose -->
            <path d="M330 680 L360 510 L390 680 Z" fill="#ffffff" />
          `,
        }),
        duration: 5.2,
        commentary: 'And of course, fifty level-up notifications pop up at once. Subscribe right now or you will reincarnate as an E-rank potato!',
        camera: {
          type: 'slow-drift',
          start: { x: 0.5, y: 0.6, zoom: 1.05 },
          end: { x: 0.5, y: 0.35, zoom: 1.25 },
          shakeIntensity: 0.2,
          easing: 'ease-in-out',
        },
        transition: 'fade',
        soundEffect: 'level-up',
        soundEffectTime: 1.0,
        audioBase64: createSampleVoiceWav('And of course, fifty level-up notifications pop up at once. Subscribe right now or you will reincarnate as an E-rank potato!', 160),
        subtitles: [
          { text: 'Subscribe', startTime: 0.0, endTime: 0.9, isPunch: true },
          { text: 'right', startTime: 0.9, endTime: 1.3 },
          { text: 'now', startTime: 1.3, endTime: 1.8, isPunch: true },
          { text: 'or', startTime: 1.8, endTime: 2.1 },
          { text: 'wake', startTime: 2.1, endTime: 2.5 },
          { text: 'up', startTime: 2.5, endTime: 2.8 },
          { text: 'as', startTime: 2.8, endTime: 3.1 },
          { text: 'a', startTime: 3.1, endTime: 3.4 },
          { text: 'POTATO!', startTime: 3.4, endTime: 5.2, isPunch: true },
        ],
      },
    ],
  },

  'necromancer-bed': {
    id: 'necromancer-bed',
    title: 'The Solo Necromancer Who Refused to Leave His Bed',
    aspectRatio: '9:16',
    bgmTrack: 'funny-lofi',
    bgmVolume: 0.35,
    voiceVolume: 1.0,
    voicePersona: 'Fenrir',
    voiceEngine: 'gemini',
    humorTone: 'sarcastic-critic',
    subtitleStyle: {
      fontFamily: 'Cabinet Grotesk',
      fontSize: 54,
      textColor: '#ffffff',
      highlightColor: '#38bdf8',
      strokeColor: '#000000',
      strokeWidth: 7,
      positionY: 82,
      animation: 'pop-karaoke',
    },
    panels: [
      {
        id: 'nb1',
        title: 'The Cozy Monarch',
        imageUrl: createComicSvg({
          bgGradient: ['#312e81', '#1e1b4b'],
          title: 'Bedside Monarch',
          badge: 'COUCH POTATO',
          elements: `
            <!-- Giant Bed & Blanket with glowing eyes -->
            <rect x="160" y="520" width="400" height="240" rx="20" fill="#475569" stroke="#64748b" stroke-width="6" />
            <rect x="180" y="480" width="160" height="90" rx="15" fill="#f8fafc" />
            <!-- Blanket mound -->
            <path d="M220 540 Q360 490 500 540 L500 680 L220 680 Z" fill="#818cf8" />
            <!-- Glowing lazy eyes peeking from duvet -->
            <circle cx="340" cy="535" r="8" fill="#38bdf8" />
            <circle cx="380" cy="535" r="8" fill="#38bdf8" />
          `,
        }),
        duration: 5.0,
        commentary: 'Look at the King of Death here. The world is burning outside and my man is wrapped in an Ikea duvet drinking iced latte.',
        camera: {
          type: 'pan-down',
          start: { x: 0.5, y: 0.3, zoom: 1.1 },
          end: { x: 0.5, y: 0.55, zoom: 1.35 },
          shakeIntensity: 0.1,
          easing: 'ease-in-out',
        },
        transition: 'fade',
        soundEffect: 'discord-ping',
        soundEffectTime: 1.0,
        subtitles: [
          { text: 'Look', startTime: 0.0, endTime: 0.5 },
          { text: 'at', startTime: 0.5, endTime: 0.8 },
          { text: 'the', startTime: 0.8, endTime: 1.1 },
          { text: 'King', startTime: 1.1, endTime: 1.6, isPunch: true },
          { text: 'of', startTime: 1.6, endTime: 1.9 },
          { text: 'Death', startTime: 1.9, endTime: 2.5, isPunch: true },
          { text: 'in', startTime: 2.5, endTime: 2.9 },
          { text: 'his', startTime: 2.9, endTime: 3.3 },
          { text: 'Ikea', startTime: 3.3, endTime: 3.9 },
          { text: 'duvet!', startTime: 3.9, endTime: 5.0, isPunch: true },
        ],
      },
      {
        id: 'nb2',
        title: 'Skeleton Dragon Remote Control',
        imageUrl: createComicSvg({
          bgGradient: ['#030712', '#111827'],
          title: 'Dragon Summon',
          badge: 'S-RANK PET',
          actionLines: true,
          elements: `
            <!-- Giant Skeletal Jaw coming out of shadows holding TV Remote -->
            <path d="M120 400 Q360 180 600 400" stroke="#cbd5e1" stroke-width="14" fill="none" />
            <path d="M180 430 L220 540 L260 440" fill="#cbd5e1" />
            <path d="M320 450 L360 580 L400 450" fill="#cbd5e1" />
            <path d="M460 440 L500 550 L540 430" fill="#cbd5e1" />
            <!-- Blue soul flames in eye sockets -->
            <circle cx="280" cy="340" r="18" fill="#38bdf8" filter="drop-shadow(0 0 15px #0284c7)" />
            <circle cx="440" cy="340" r="18" fill="#38bdf8" filter="drop-shadow(0 0 15px #0284c7)" />
            <!-- TV remote in bone claws -->
            <rect x="330" y="600" width="60" height="120" rx="8" fill="#18181b" stroke="#ffffff" stroke-width="3" />
            <circle cx="360" cy="630" r="8" fill="#ef4444" />
          `,
        }),
        duration: 5.3,
        commentary: 'He literally summoned an ancient dragon made of prehistoric bones just because the TV remote was three feet away!',
        camera: {
          type: 'crash-zoom',
          start: { x: 0.5, y: 0.65, zoom: 1.0 },
          end: { x: 0.5, y: 0.38, zoom: 1.85 },
          shakeIntensity: 0.8,
          shakeTime: 1.2,
          easing: 'punch',
        },
        transition: 'white-flash',
        soundEffect: 'vine-boom',
        soundEffectTime: 1.2,
        subtitles: [
          { text: 'He', startTime: 0.0, endTime: 0.4 },
          { text: 'summoned', startTime: 0.4, endTime: 1.0 },
          { text: 'an', startTime: 1.0, endTime: 1.3 },
          { text: 'ANCIENT', startTime: 1.3, endTime: 2.0, isPunch: true },
          { text: 'DRAGON', startTime: 2.0, endTime: 2.8, isPunch: true },
          { text: 'for', startTime: 2.8, endTime: 3.2 },
          { text: 'the', startTime: 3.2, endTime: 3.5 },
          { text: 'TV', startTime: 3.5, endTime: 4.1 },
          { text: 'REMOTE!', startTime: 4.1, endTime: 5.3, isPunch: true },
        ],
      },
    ],
  },
};
