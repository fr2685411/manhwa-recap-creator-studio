export type CameraMotionType = 
  | 'pan-down' 
  | 'crash-zoom' 
  | 'pan-right' 
  | 'zoom-in' 
  | 'zoom-out' 
  | 'shake-impact' 
  | 'slow-drift'
  | 'custom';

export type TransitionType = 
  | 'page-turn'
  | 'speed-lines'
  | 'ink-splash'
  | 'diagonal-slash'
  | 'white-flash' 
  | 'glitch'
  | 'zoom-blur' 
  | 'slide-left' 
  | 'fade'
  | 'cut';

export interface TransitionMeta {
  id: TransitionType;
  name: string;
  category: 'comic' | 'action' | 'cinematic';
  icon: string;
  description: string;
  soundCue?: string;
}

export const TRANSITION_LIBRARY: TransitionMeta[] = [
  {
    id: 'page-turn',
    name: 'Comic Page Flip',
    category: 'comic',
    icon: '📖',
    description: 'Classic physical comic book page peeling and curling across with drop shadow.',
    soundCue: 'record-scratch',
  },
  {
    id: 'speed-lines',
    name: 'Action Speed Lines',
    category: 'action',
    icon: '⚡',
    description: 'High-octane manga speed lines bursting across the screen to reveal next panel.',
    soundCue: 'anime-punch',
  },
  {
    id: 'ink-splash',
    name: 'Manga Ink Splash',
    category: 'comic',
    icon: '🖋️',
    description: 'Artistic sumi-e black ink splatter that bleeds outward across the page.',
    soundCue: 'vine-boom',
  },
  {
    id: 'diagonal-slash',
    name: 'Katana Sword Slash',
    category: 'action',
    icon: '⚔️',
    description: 'Lethal diagonal cut slicing the current panel in two with a white blade glint.',
    soundCue: 'anime-punch',
  },
  {
    id: 'white-flash',
    name: 'Anime Impact Flash',
    category: 'action',
    icon: '💥',
    description: 'Blinding white impact flash with radiant ray bursts on dramatic reveals.',
    soundCue: 'vine-boom',
  },
  {
    id: 'glitch',
    name: 'System Window Glitch',
    category: 'action',
    icon: '💫',
    description: 'Cyberpunk chromatic RGB slice glitch with digital scanlines.',
    soundCue: 'discord-ping',
  },
  {
    id: 'zoom-blur',
    name: 'Crash Zoom Blur',
    category: 'action',
    icon: '🔍',
    description: 'Rapid radial motion blur rushing directly into the next panel.',
  },
  {
    id: 'slide-left',
    name: 'Kinetic Whip Pan',
    category: 'cinematic',
    icon: '⬅️',
    description: 'Fast horizontal camera whip sweep into the next scene.',
  },
  {
    id: 'fade',
    name: 'Cinematic Dissolve',
    category: 'cinematic',
    icon: '🎞️',
    description: 'Smooth atmospheric opacity blend between panels.',
  },
  {
    id: 'cut',
    name: 'Hard Cut',
    category: 'cinematic',
    icon: '✂️',
    description: 'Instant frame cut without intermediate transition.',
  },
];

export type SoundEffectType = 
  | 'none'
  | 'vine-boom'
  | 'record-scratch'
  | 'anime-punch'
  | 'discord-ping'
  | 'choir-epic'
  | 'level-up'
  | 'crickets';

export interface CameraTransform {
  x: number;     // 0 to 1 relative center
  y: number;     // 0 to 1 relative center
  zoom: number;  // 1.0 = fit, 1.5 = 150%, 2.5 = close up
}

export interface CameraSettings {
  type: CameraMotionType;
  start: CameraTransform;
  end: CameraTransform;
  shakeIntensity: number; // 0 to 1
  shakeTime?: number;     // timestamp in seconds when shake triggers
  easing: 'ease-in-out' | 'ease-out' | 'linear' | 'punch';
}

export interface SubtitleWord {
  text: string;
  startTime: number; // seconds from panel start
  endTime: number;   // seconds from panel start
  isPunch?: boolean;
}

export type SubtitleShadowPreset = 'none' | 'comic-punch' | 'neon-glow' | 'deep-drop' | 'fire-aura' | 'subtle-halo';

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  positionY: number; // 0 - 100 percentage from top
  animation: 'pop-karaoke' | 'bounce' | 'glow' | 'comic-box';
  
  // Custom font style & typography
  fontWeight?: '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'capitalize';

  // Shadow & glow effects
  shadowPreset?: SubtitleShadowPreset;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  // Backdrop box styling
  showBackdrop?: boolean;
  backdropColor?: string;

  // Track if customized for panel
  isCustom?: boolean;
}

export type VoiceEqPreset = 'clean' | 'bass-boost' | 'phone-radio' | 'reverb-hall' | 'warm-broadcast';

export interface VoiceClipSettings {
  volume: number;       // 0.0 to 2.0 (default 1.0)
  speed: number;        // 0.7x to 1.6x (default 1.0)
  pitch: number;        // semitones: -12 to +12 (default 0)
  startOffset: number;  // seconds delay from panel start (default 0.0)
  fadeIn: number;       // seconds (default 0.05)
  fadeOut: number;      // seconds (default 0.05)
  isMuted: boolean;     // default false
  voicePersona?: 'Puck' | 'Fenrir' | 'Zephyr' | 'Kore' | 'Charon' | 'Custom';
  stylePrompt?: string;
  eqFilter: VoiceEqPreset;
}

export interface Panel {
  id: string;
  title: string;
  imageUrl: string;
  duration: number; // in seconds
  commentary: string; // The 4th wall breaking comedic dialogue
  camera: CameraSettings;
  transition: TransitionType;
  soundEffect: SoundEffectType;
  soundEffectTime: number; // seconds within panel
  audioBase64?: string; // base64 encoded wav audio from Gemini TTS
  audioBlobUrl?: string; // cached object url
  voiceSettings?: VoiceClipSettings; // Advanced video editor voiceover settings
  subtitles: SubtitleWord[];
  subtitleStyle?: SubtitleStyle; // Custom subtitle style override for this individual panel
}

export interface ProjectSettings {
  id: string;
  title: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  bgmTrack: 'phonk-combat' | 'funny-lofi' | 'epic-orchestral' | 'synthwave-hype' | 'chill-reading' | 'none';
  bgmVolume: number; // 0.0 to 1.0
  voiceVolume: number;
  voicePersona: 'Puck' | 'Fenrir' | 'Zephyr' | 'Kore' | 'Charon';
  voiceEngine: 'gemini' | 'browser';
  humorTone: 'unhinged-mamoru' | 'sarcastic-critic' | 'hype-shonen' | 'murim-slap';
  subtitleStyle: SubtitleStyle;
  panels: Panel[];
}
