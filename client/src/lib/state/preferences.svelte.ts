import type {
  PreferencesSchema,
  FontPreferences,
  TtsPreferences,
  ProxyPreferences,
  AccessibilityPreferences,
  EditorPreferences,
  DisplayPreferences,
  KeyboardPreferences,
  SoundPreferences,
} from '../types/preferences';
import { STORAGE_KEYS } from '../constants';
// Note: Don't import from services yet - we'll call persistence functions from the component layer
const CURRENT_VERSION = 1;

function getDefaults(): PreferencesSchema {
  return {
    version: CURRENT_VERSION,
    font: {
      family: "'Consolas', 'Courier New', 'Liberation Mono', monospace",
      size: 14,
      lineHeight: 1.4,
    },
    colors: { theme: 'dark', ansiOverrides: {} },
    proxy: { persistenceTimeout: 600000, maxBufferLines: 1000 },
    accessibility: {
      reducedMotion: false,
      ariaLiveRegions: true,
    },
    tts: {
      enabled: false,
      voice: '',
      rate: 1,
      pitch: 1,
      volume: 1,
      interruptOnNew: false,
      activationMode: 'always' as const,
      filterRules: [],
    },
    editor: { confirmOnSend: true, fontSize: 14, tabSize: 2, wordWrap: true },
    keyboard: { navigationKeyScheme: 'jkli' },
    sound: { masterVolume: 60, soundVolume: 60, ambianceVolume: 60, muteInBackground: true },
    display: {
      autoLinkUrls: true,
      timestamps: false,
      maxOutputLines: 1000,
      confirmDisplayUrl: true,
      debugGmcp: false,
    },
  };
}

function loadFromStorage(): PreferencesSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (!raw) return getDefaults();
    const parsed = JSON.parse(raw);
    const defaults = getDefaults();
    return {
      ...defaults,
      ...parsed,
      font: { ...defaults.font, ...(parsed.font || {}) },
      colors: { ...defaults.colors, ...(parsed.colors || {}) },
      proxy: { ...defaults.proxy, ...(parsed.proxy || {}) },
      accessibility: { ...defaults.accessibility, ...(parsed.accessibility || {}) },
      tts: { ...defaults.tts, ...(parsed.tts || {}) },
      editor: { ...defaults.editor, ...(parsed.editor || {}) },
      keyboard: { ...defaults.keyboard, ...(parsed.keyboard || {}) },
      sound: { ...defaults.sound, ...(parsed.sound || {}) },
      display: { ...defaults.display, ...(parsed.display || {}) },
      version: CURRENT_VERSION,
    };
  } catch {
    return getDefaults();
  }
}

class PreferencesState {
  private _prefs = $state<PreferencesSchema>(loadFromStorage());

  get font() {
    return this._prefs.font;
  }
  get colors() {
    return this._prefs.colors;
  }
  get theme() {
    return this._prefs.colors.theme;
  }
  get proxy() {
    return this._prefs.proxy;
  }
  get accessibility() {
    return this._prefs.accessibility;
  }
  get tts() {
    return this._prefs.tts;
  }
  get editor() {
    return this._prefs.editor;
  }
  get keyboard() {
    return this._prefs.keyboard;
  }
  get sound() {
    return this._prefs.sound;
  }
  get display() {
    return this._prefs.display;
  }

  update(partial: Partial<PreferencesSchema>): void {
    this._prefs = { ...this._prefs, ...partial };
    this.save();
  }

  updateFont(font: Partial<FontPreferences>): void {
    this._prefs = { ...this._prefs, font: { ...this._prefs.font, ...font } };
    this.save();
  }

  setTheme(theme: 'dark' | 'light' | 'high-contrast'): void {
    this._prefs = { ...this._prefs, colors: { ...this._prefs.colors, theme } };
    this.save();
  }

  updateTts(tts: Partial<TtsPreferences>): void {
    this._prefs = { ...this._prefs, tts: { ...this._prefs.tts, ...tts } };
    this.save();
  }

  updateProxy(proxy: Partial<ProxyPreferences>): void {
    this._prefs = { ...this._prefs, proxy: { ...this._prefs.proxy, ...proxy } };
    this.save();
  }

  updateAccessibility(accessibility: Partial<AccessibilityPreferences>): void {
    this._prefs = { ...this._prefs, accessibility: { ...this._prefs.accessibility, ...accessibility } };
    this.save();
  }

  updateEditor(editor: Partial<EditorPreferences>): void {
    this._prefs = { ...this._prefs, editor: { ...this._prefs.editor, ...editor } };
    this.save();
  }

  updateKeyboard(keyboard: Partial<KeyboardPreferences>): void {
    this._prefs = { ...this._prefs, keyboard: { ...this._prefs.keyboard, ...keyboard } };
    this.save();
  }

  updateSound(sound: Partial<SoundPreferences>): void {
    this._prefs = { ...this._prefs, sound: { ...this._prefs.sound, ...sound } };
    this.save();
  }

  updateDisplay(display: Partial<DisplayPreferences>): void {
    this._prefs = { ...this._prefs, display: { ...this._prefs.display, ...display } };
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(this._prefs));
    } catch {
      /* quota exceeded */
    }
  }
}

export const preferencesState = new PreferencesState();
