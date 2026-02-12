export enum AutoreadMode {
  Off = "off",
  Unfocused = "unfocused",
  All = "all",
}

export type GeneralPreferences = {
  localEcho: boolean;
};

export type SpeechPreferences = {
  autoreadMode: AutoreadMode;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
};

export type SoundPreferences = {
  muteInBackground: boolean;
  volume: number;
};

export type ChannelPreferences = {
  autoreadMode: AutoreadMode;
  notify: boolean;
};

export type EditorPreferences = {
  autocompleteEnabled: boolean;
  accessibilityMode: boolean;
};

export type MidiPreferences = {
  enabled: boolean;
  lastInputDeviceId?: string;
  lastOutputDeviceId?: string;
};

export type AuthPreferences = {
  autoLoginEnabled: boolean;
  username: string;
  password: string;
};

export type PrefState = {
  general: GeneralPreferences;
  speech: SpeechPreferences;
  sound: SoundPreferences;
  channels?: { [channelId: string]: ChannelPreferences };
  editor: EditorPreferences;
  midi: MidiPreferences;
  auth: AuthPreferences;
};

export enum PrefActionType {
  SetGeneral = "SET_GENERAL",
  SetSpeech = "SET_SPEECH",
  SetSound = "SET_SOUND",
  SetChannels = "SET_CHANNELS",
  SetEditorAutocompleteEnabled = "SET_EDITOR_AUTOCOMPLETE_ENABLED",
  SetEditorAccessibilityMode = "SET_EDITOR_ACCESSIBILITY_MODE",
  SetMidi = "SET_MIDI",
  SetAuth = "SET_AUTH",
}

export type PrefAction =
  | { type: PrefActionType.SetGeneral; data: GeneralPreferences }
  | { type: PrefActionType.SetSpeech; data: SpeechPreferences }
  | { type: PrefActionType.SetSound; data: SoundPreferences }
  | { type: PrefActionType.SetChannels; data: { [channelId: string]: ChannelPreferences } }
  | { type: PrefActionType.SetEditorAutocompleteEnabled; data: boolean }
  | { type: PrefActionType.SetEditorAccessibilityMode; data: boolean }
  | { type: PrefActionType.SetMidi; data: MidiPreferences }
  | { type: PrefActionType.SetAuth; data: AuthPreferences };

class PreferencesStore {
  private state: PrefState;
  private listeners: Set<() => void> = new Set();

  /**
   * Encode auth credentials using base64
   */
  private encodeAuth(auth: AuthPreferences): AuthPreferences {
    if (!auth.username && !auth.password) {
      return auth;
    }

    try {
      return {
        autoLoginEnabled: auth.autoLoginEnabled,
        username: auth.username ? btoa(auth.username) : "",
        password: auth.password ? btoa(auth.password) : "",
      };
    } catch {
      return auth; // Return as-is if encoding fails
    }
  }

  /**
   * Decode auth credentials from base64
   */
  private decodeAuth(auth: AuthPreferences): AuthPreferences {
    if (!auth.username && !auth.password) {
      return auth;
    }

    try {
      return {
        autoLoginEnabled: auth.autoLoginEnabled,
        username: auth.username ? atob(auth.username) : "",
        password: auth.password ? atob(auth.password) : "",
      };
    } catch {
      // If decoding fails, assume it's already plain text (for migration)
      return auth;
    }
  }

  constructor() {
    // Merge the initial preferences with the stored preferences from localStorage
    const storedData = localStorage.getItem("preferences");
    const initialPreferences = this.getInitialPreferences();
    let parsedData = storedData ? JSON.parse(storedData) : null;

    // Migration: move volume from general to sound if it exists
    if (parsedData?.general?.volume !== undefined && parsedData?.sound) {
      if (!parsedData.sound.volume) {
        parsedData.sound.volume = parsedData.general.volume;
      }
      delete parsedData.general.volume;
    }

    // Decode auth credentials if they exist
    if (parsedData?.auth) {
      parsedData.auth = this.decodeAuth(parsedData.auth);
    }

    this.state = parsedData ? this.mergePreferences(initialPreferences, parsedData) : initialPreferences;
  }

  private getInitialPreferences(): PrefState {
    return {
      general: {
        localEcho: false,
      },
      speech: {
        autoreadMode: AutoreadMode.Off,
        voice: "",
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
      },
      sound: {
        muteInBackground: false,
        volume: 1.0,
      },
      channels: {
        "sayto": {
          autoreadMode: AutoreadMode.Off,
          notify: true,
        },
      },
      editor: {
        autocompleteEnabled: true,
        accessibilityMode: true,
      },
      midi: {
        enabled: false,
      },
      auth: {
        autoLoginEnabled: false,
        username: "",
        password: "",
      },
    };
  }

  private mergePreferences(initial: PrefState, stored: PrefState): PrefState {
    // Merge the stored preferences with the initial preferences, picking up new preferences
    return {
      ...initial,
      general: { ...initial.general, ...stored.general },
      speech: { ...initial.speech, ...stored.speech },
      sound: { ...initial.sound, ...stored.sound },
      channels: stored.channels ? { ...initial.channels, ...stored.channels } : initial.channels,
      editor: { ...initial.editor, ...stored.editor },
      midi: { ...initial.midi, ...stored.midi },
      auth: { ...initial.auth, ...stored.auth },
    };
  }

  private reducer(state: PrefState, action: PrefAction): PrefState {
    switch (action.type) {
      case PrefActionType.SetGeneral:
        return { ...state, general: action.data };
      case PrefActionType.SetSpeech:
        return { ...state, speech: action.data };
      case PrefActionType.SetSound:
        return { ...state, sound: action.data };
      case PrefActionType.SetChannels:
        return { ...state, channels: action.data };
      case PrefActionType.SetEditorAutocompleteEnabled:
        return { ...state, editor: { ...state.editor, autocompleteEnabled: action.data } };
      case PrefActionType.SetEditorAccessibilityMode:
        return { ...state, editor: { ...state.editor, accessibilityMode: action.data } };
      case PrefActionType.SetMidi:
        return { ...state, midi: action.data };
      case PrefActionType.SetAuth:
        return { ...state, auth: action.data };
      default:
        return state;
    }
  }

  dispatch = (action: PrefAction) => {
    this.state = this.reducer(this.state, action);

    // Encode auth credentials before saving to localStorage
    const stateToSave = {
      ...this.state,
      auth: this.encodeAuth(this.state.auth),
    };

    localStorage.setItem("preferences", JSON.stringify(stateToSave));
    this.listeners.forEach((listener) => listener());
  }

  public getState(): PrefState {
    return this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const preferencesStore = new PreferencesStore();
