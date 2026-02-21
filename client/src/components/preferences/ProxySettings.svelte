<script lang="ts">
  import { preferencesState } from '../../lib/state/preferences.svelte';

  let persistenceTimeout = $state(preferencesState.proxy.persistenceTimeout);
  let maxBufferLines = $state(preferencesState.proxy.maxBufferLines);

  /**
   * Format milliseconds into a human-readable duration string.
   */
  function formatDuration(ms: number): string {
    if (ms === 0) return 'Disabled';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
    }
    if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }
    return `${seconds}s`;
  }

  function handleTimeoutChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (value >= 0 && value <= 43200000) {
      persistenceTimeout = value;
      preferencesState.updateProxy({ persistenceTimeout: value });
    }
  }

  function handleBufferChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (value >= 10 && value <= 10000) {
      maxBufferLines = value;
      preferencesState.updateProxy({ maxBufferLines: value });
    }
  }
</script>

<fieldset class="settings-section">
  <legend class="settings-legend">Proxy</legend>

  <div class="setting-row">
    <label class="setting-label" for="persistence-timeout">
      Persistence Timeout
      <span class="setting-hint">{formatDuration(persistenceTimeout)}</span>
    </label>
    <input
      id="persistence-timeout"
      class="setting-input"
      type="number"
      min="0"
      max="43200000"
      step="60000"
      value={persistenceTimeout}
      onchange={handleTimeoutChange}
    />
    <span class="setting-unit">ms</span>
  </div>

  <div class="setting-row">
    <label class="setting-label" for="max-buffer">Max Buffer Lines</label>
    <input
      id="max-buffer"
      class="setting-input"
      type="number"
      min="10"
      max="10000"
      step="100"
      value={maxBufferLines}
      onchange={handleBufferChange}
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
  }

  .setting-label {
    color: var(--text-secondary);
    font-size: 13px;
    white-space: nowrap;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-hint {
    color: var(--text-muted);
    font-size: 11px;
  }

  .setting-input {
    padding: 4px 8px;
    background-color: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-family: var(--font-family);
    font-size: 13px;
    max-width: 120px;
  }

  .setting-unit {
    color: var(--text-muted);
    font-size: 12px;
    min-width: 20px;
  }

  .setting-input:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: 1px;
  }
</style>
