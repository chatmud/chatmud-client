<script lang="ts">
  import { preferencesState } from '../../lib/state/preferences.svelte';
  import Toggle from '../common/Toggle.svelte';

  function handleDebugGmcpChange(checked: boolean): void {
    preferencesState.updateDisplay({ debugGmcp: checked });
  }
</script>

<fieldset class="settings-section">
  <legend class="settings-legend">Debug</legend>

  <div class="setting-row">
    <Toggle
      label="Log GMCP messages"
      checked={preferencesState.display.debugGmcp}
      onchange={handleDebugGmcpChange}
    />
  </div>
</fieldset>

<style>
  .settings-section {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 12px 16px;
    margin: 0;
  }

  .settings-legend {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 600;
    padding: 0 4px;
  }

  .setting-row {
    padding: 6px 0;
  }
</style>
