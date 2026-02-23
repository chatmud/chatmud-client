export interface FontPreferences {
  family: string;
  size: number;
  lineHeight: number;
}

export interface ColorPreferences {
  theme: 'dark' | 'light' | 'high-contrast';
  ansiOverrides: Partial<Record<string, string>>;
}

export interface ProxyPreferences {
  persistenceTimeout: number;
  maxBufferLines: number;
}

export interface AccessibilityPreferences {
  verbosity: 'low' | 'medium' | 'high';
  batchAnnouncements: boolean;
  focusRing: boolean;
  reducedMotion: boolean;
}

export type TtsActivationMode = 'always' | 'focused' | 'unfocused';

export interface TtsPreferences {
  enabled: boolean;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  interruptOnNew: boolean;
  activationMode: TtsActivationMode;
  filterRules: TtsFilterRule[];
}

export interface TtsFilterRule {
  pattern: string;
  action: 'include' | 'exclude';
}

export interface EditorPreferences {
  confirmOnSend: boolean;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
}

export interface DisplayPreferences {
  autoLinkUrls: boolean;
  timestamps: boolean;
  maxOutputLines: number;
  confirmDisplayUrl: boolean;
  debugGmcp: boolean;
}

export type NavigationKeyScheme = 'jkli' | 'wasd' | 'dvorak-rh' | 'dvorak-lh';

export interface KeyboardPreferences {
  navigationKeyScheme: NavigationKeyScheme;
}

export interface SoundPreferences {
  masterVolume: number;     // 0-100
  soundVolume: number;      // 0-100
  ambianceVolume: number;   // 0-100
}

export interface PreferencesSchema {
  version: number;
  font: FontPreferences;
  colors: ColorPreferences;
  proxy: ProxyPreferences;
  accessibility: AccessibilityPreferences;
  tts: TtsPreferences;
  editor: EditorPreferences;
  display: DisplayPreferences;
  keyboard: KeyboardPreferences;
  sound: SoundPreferences;
}
