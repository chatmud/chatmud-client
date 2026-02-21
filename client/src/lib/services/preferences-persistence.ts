/**
 * Persistence layer for user preferences.
 *
 * Loads/saves preferences from localStorage with version migration
 * support. Missing fields are filled in from defaults so the app
 * always has a complete PreferencesSchema to work with.
 */

import type { PreferencesSchema } from '../types/preferences';

const STORAGE_KEY = 'chatmud-preferences';
const CURRENT_VERSION = 1;

/**
 * Return a complete set of default preferences.
 */
export function getDefaultPreferences(): PreferencesSchema {
  return {
    version: CURRENT_VERSION,
    font: {
      family: "'Consolas', 'Courier New', 'Liberation Mono', monospace",
      size: 14,
      lineHeight: 1.4,
    },
    colors: {
      theme: 'dark',
      ansiOverrides: {},
    },
    proxy: {
      persistenceTimeout: 600000,
      maxBufferLines: 1000,
    },
    accessibility: {
      verbosity: 'medium',
      batchAnnouncements: true,
      focusRing: true,
      reducedMotion: false,
    },
    tts: {
      enabled: false,
      voice: '',
      rate: 1,
      pitch: 1,
      volume: 1,
      interruptOnNew: false,
      filterRules: [],
    },
    editor: {
      confirmOnSend: true,
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
    },
    display: {
      autoLinkUrls: true,
      timestamps: false,
      maxOutputLines: 1000,
      confirmDisplayUrl: true,
    },
  };
}

/**
 * Load preferences from localStorage. Returns defaults if nothing is
 * stored or if the stored data is malformed.
 */
export function loadPreferences(): PreferencesSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPreferences();
    const parsed = JSON.parse(raw);
    return migratePreferences(parsed);
  } catch {
    return getDefaultPreferences();
  }
}

/**
 * Save preferences to localStorage.
 */
export function savePreferences(prefs: PreferencesSchema): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * Migrate loaded preference data to the current version.
 * Merges loaded data over defaults so any missing fields are filled in.
 * This approach is forward-compatible: adding new preference fields in
 * future versions just requires updating getDefaultPreferences().
 */
function migratePreferences(data: Record<string, unknown>): PreferencesSchema {
  const defaults = getDefaultPreferences();

  return {
    ...defaults,
    ...data,
    font: { ...defaults.font, ...((data.font as object) || {}) },
    colors: { ...defaults.colors, ...((data.colors as object) || {}) },
    proxy: { ...defaults.proxy, ...((data.proxy as object) || {}) },
    accessibility: { ...defaults.accessibility, ...((data.accessibility as object) || {}) },
    tts: { ...defaults.tts, ...((data.tts as object) || {}) },
    editor: { ...defaults.editor, ...((data.editor as object) || {}) },
    display: { ...defaults.display, ...((data.display as object) || {}) },
    version: CURRENT_VERSION,
  } as PreferencesSchema;
}
