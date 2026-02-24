import { outputState } from '../state/output.svelte';
import { wsService } from '../services/websocket';
import { connectionState } from '../state/connection.svelte';
import { uiState } from '../state/ui.svelte';
import { mediaState } from '../state/media.svelte';
import { mediaService } from '../services/media-service';
import { inputState } from '../state/input.svelte';
import { preferencesState } from '../state/preferences.svelte';
import { ttsEngine } from '../services/tts-engine';

export interface SlashCommand {
  name: string;
  description: string;
  args?: string;
  action: () => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'aria',
    description: 'Toggle ARIA live region announcements',
    action: () => {
      const next = !preferencesState.accessibility.ariaLiveRegions;
      preferencesState.updateAccessibility({ ariaLiveRegions: next });
      outputState.announce(next ? 'ARIA live regions on' : 'ARIA live regions off');
    },
  },
  {
    name: 'autosay',
    description: 'Toggle autosay — prefixes every message with "say "',
    action: () => {
      inputState.autosayMode = !inputState.autosayMode;
      outputState.announce(inputState.autosayMode ? 'Autosay on' : 'Autosay off');
    },
  },
  {
    name: 'clear',
    description: 'Clear the output buffer',
    action: () => {
      if (window.confirm('Clear all output?')) {
        outputState.clear();
        outputState.announce('Output cleared');
      }
    },
  },
  {
    name: 'connect',
    description: 'Connect to the MUD server',
    action: () => {
      wsService.connect(connectionState.sessionId ?? undefined);
    },
  },
  {
    name: 'disconnect',
    description: 'Disconnect from the MUD server',
    action: () => {
      wsService.disconnect();
    },
  },
  {
    name: 'help',
    description: 'Show keyboard shortcuts',
    action: () => {
      uiState.openPreferencesTo('shortcuts');
    },
  },
  {
    name: 'mute',
    description: 'Toggle audio mute',
    action: () => {
      mediaState.muted = !mediaState.muted;
      mediaService.updateVolumes();
    },
  },
  {
    name: 'prefs',
    description: 'Open preferences',
    action: () => {
      uiState.togglePreferences();
    },
  },
  {
    name: 'preferences',
    description: 'Open preferences',
    action: () => {
      uiState.togglePreferences();
    },
  },
  {
    name: 'tts',
    description: 'Toggle text-to-speech',
    action: () => {
      const next = !preferencesState.tts.enabled;
      preferencesState.updateTts({ enabled: next });
      outputState.announce(next ? 'Text to speech on' : 'Text to speech off');
    },
  },
  {
    name: 'tts-stop',
    description: 'Stop current text-to-speech playback',
    action: () => {
      ttsEngine.cancel();
    },
  },
  {
    name: 'voice',
    description: 'Join voice chat (coming soon)',
    action: () => {
      outputState.addSystemLine('Voice chat is not yet available');
    },
  },
];

export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(q));
}

export function findCommand(input: string): SlashCommand | undefined {
  const normalized = input.trim().toLowerCase();
  return SLASH_COMMANDS.find((cmd) => '/' + cmd.name === normalized);
}
