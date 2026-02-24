import { outputState } from '../state/output.svelte';
import { wsService } from '../services/websocket';
import { connectionState } from '../state/connection.svelte';
import { uiState } from '../state/ui.svelte';
import { mediaState } from '../state/media.svelte';
import { mediaService } from '../services/media-service';
import { inputState } from '../state/input.svelte';

export interface SlashCommand {
  name: string;
  description: string;
  args?: string;
  action: () => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
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
    description: 'Disconnect from the server',
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
    name: 'preferences',
    description: 'Open preferences',
    action: () => {
      uiState.togglePreferences();
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
