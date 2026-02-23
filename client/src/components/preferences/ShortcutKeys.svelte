<script lang="ts">
  import { preferencesState } from '../../lib/state/preferences.svelte';
  import { navigationKeyMaps } from '../../lib/state/channel-history.svelte';

  let scheme = $derived(preferencesState.keyboard.navigationKeyScheme);
  let navKeys = $derived(navigationKeyMaps[scheme]);

  interface ShortcutGroup {
    title: string;
    shortcuts: { keys: string; description: string }[];
  }

  let groups = $derived<ShortcutGroup[]>([
    {
      title: 'Global',
      shortcuts: [
        { keys: 'Alt+V', description: 'Toggle volume panel' },
        { keys: 'Alt+M', description: 'Toggle mute' },
        { keys: 'Alt+,', description: 'Open preferences' },
        { keys: 'Alt+K', description: 'Connect / disconnect' },
        { keys: 'Alt+?', description: 'Show keyboard shortcuts' },
        { keys: 'Escape', description: 'Stop all sounds and TTS' },
      ],
    },
    {
      title: 'Command Input',
      shortcuts: [
        { keys: 'Enter', description: 'Send command' },
        { keys: 'Up / Down', description: 'Command history' },
      ],
    },
    {
      title: 'Output',
      shortcuts: [
        { keys: 'Up / Down', description: 'Navigate output lines' },
        { keys: 'Home / End', description: 'Jump to first / last line' },
      ],
    },
    {
      title: 'Buffer Navigation',
      shortcuts: [
        { keys: `Alt+${navKeys.left.toUpperCase()} / Alt+${navKeys.right.toUpperCase()}`, description: 'Previous / next buffer' },
        { keys: 'Alt+Left / Alt+Right', description: 'Previous / next buffer (arrows)' },
        { keys: `Alt+${navKeys.up.toUpperCase()} / Alt+${navKeys.down.toUpperCase()}`, description: 'Previous / next message' },
        { keys: 'Alt+Up / Alt+Down', description: 'Previous / next message (arrows)' },
        { keys: 'Alt+1-9', description: 'Read message N (1 = most recent)' },
        { keys: 'Alt+1-9 (double)', description: 'Copy message N to clipboard' },
        { keys: 'Alt+Shift+1-9', description: 'Jump to buffer N' },
        { keys: 'Alt+PageUp / PageDown', description: 'Skip 10 messages' },
        { keys: 'Alt+Home / End', description: 'Jump to start / end of buffer' },
        { keys: 'Alt+Space', description: 'Repeat current message' },
        { keys: 'Alt+Shift+Space', description: 'Copy current message' },
        { keys: 'Alt+Shift+T', description: 'Toggle message timestamps' },
        { keys: 'Alt+Shift+Delete', description: 'Delete current buffer' },
      ],
    },
    {
      title: 'Editor',
      shortcuts: [
        { keys: 'Ctrl+S / Cmd+S', description: 'Send changes' },
        { keys: 'Ctrl+Shift+Z / Cmd+Shift+Z', description: 'Revert to original' },
        { keys: 'Escape', description: 'Close editor' },
      ],
    },
  ]);
</script>

<div class="shortcuts-panel">
  {#each groups as group (group.title)}
    <fieldset class="shortcut-group">
      <legend class="group-legend">{group.title}</legend>
      <table class="shortcut-table">
        <tbody>
          {#each group.shortcuts as shortcut (shortcut.keys)}
            <tr>
              <td class="shortcut-keys">{shortcut.keys}</td>
              <td class="shortcut-desc">{shortcut.description}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </fieldset>
  {/each}
  <p class="scheme-note">
    Buffer navigation keys reflect the <strong>{scheme}</strong> scheme.
  </p>
</div>

<style>
  .shortcuts-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
  }

  .shortcut-group {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 8px 12px;
    margin: 0;
  }

  .group-legend {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 600;
    padding: 0 4px;
  }

  .shortcut-table {
    width: 100%;
    border-collapse: collapse;
  }

  .shortcut-table tr + tr {
    border-top: 1px solid var(--border-subtle);
  }

  .shortcut-keys {
    color: var(--text-primary);
    font-size: 12px;
    font-family: var(--font-family);
    padding: 4px 8px 4px 0;
    white-space: nowrap;
    width: 1%;
  }

  .shortcut-desc {
    color: var(--text-secondary);
    font-size: 12px;
    padding: 4px 0;
  }

  .scheme-note {
    color: var(--text-muted, var(--text-secondary));
    font-size: 11px;
    margin: 0;
    padding: 0 4px;
  }
</style>
