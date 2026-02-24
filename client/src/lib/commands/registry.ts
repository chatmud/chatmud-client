import { outputState } from '../state/output.svelte';
import { wsService } from '../services/websocket';
import { connectionState } from '../state/connection.svelte';
import { uiState } from '../state/ui.svelte';
import { mediaState } from '../state/media.svelte';
import { mediaService } from '../services/media-service';
import { inputState } from '../state/input.svelte';
import { preferencesState } from '../state/preferences.svelte';
import { pwaState } from '../state/pwa.svelte';

export interface SlashCommand {
  name: string;
  description: string;
  args?: string;
  action: (args?: string) => void;
}

function parseVolume(args: string | undefined): number | null {
  const n = parseInt(args ?? '', 10);
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : null;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'amb',
    description: 'Set ambience volume',
    args: '<1-100>',
    action: (args) => {
      const vol = parseVolume(args);
      if (vol === null) {
        outputState.addSystemLine('Usage: /amb <1-100>');
        return;
      }
      preferencesState.updateSound({ ambianceVolume: vol });
      mediaState.ambianceVolume = vol;
      mediaService.updateVolumes();
      outputState.announce(`Ambience volume set to ${vol}`);
    },
  },
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
    name: 'install',
    description: 'Add this app to your home screen or desktop',
    action: () => {
      if (pwaState.isInstalled) {
        outputState.addSystemLine('Already running as an installed app');
      } else if (pwaState.canInstall) {
        pwaState.triggerInstall();
      } else {
        outputState.addSystemLine('Installation not available in this browser or context');
      }
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
    name: 'tts',
    description: 'Toggle text-to-speech',
    action: () => {
      const next = !preferencesState.tts.enabled;
      preferencesState.updateTts({ enabled: next });
      outputState.announce(next ? 'Text to speech on' : 'Text to speech off');
    },
  },
  {
    name: 'voice',
    description: 'Join voice chat (coming soon)',
    action: () => {
      outputState.addSystemLine('Voice chat is not yet available');
    },
  },
  {
    name: 'vol',
    description: 'Set master volume',
    args: '<1-100>',
    action: (args) => {
      const vol = parseVolume(args);
      if (vol === null) {
        outputState.addSystemLine('Usage: /vol <1-100>');
        return;
      }
      preferencesState.updateSound({ masterVolume: vol });
      mediaState.masterVolume = vol;
      mediaService.updateVolumes();
      outputState.announce(`Volume set to ${vol}`);
    },
  },
];

export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(q));
}

export function findCommand(input: string): { command: SlashCommand; args: string } | undefined {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  for (const cmd of SLASH_COMMANDS) {
    const prefix = '/' + cmd.name;
    if (lower === prefix || lower.startsWith(prefix + ' ')) {
      return { command: cmd, args: trimmed.slice(prefix.length).trim() };
    }
  }
  return undefined;
}
