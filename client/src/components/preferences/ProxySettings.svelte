<script lang="ts">
  import { preferencesState } from '../../lib/state/preferences.svelte';

  const timeoutOptions = [
    { label: '1 minute', value: 60000 },
    { label: '5 minutes', value: 300000 },
    { label: '10 minutes', value: 600000 },
    { label: '30 minutes', value: 1800000 },
    { label: '1 hour', value: 3600000 },
    { label: '3 hours', value: 10800000 },
    { label: '6 hours', value: 21600000 },
    { label: '12 hours', value: 43200000 },
  ];

  let persistenceTimeout = $state(preferencesState.proxy.persistenceTimeout);

  function handleTimeoutChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = parseInt(target.value, 10);
    persistenceTimeout = value;
    preferencesState.updateProxy({ persistenceTimeout: value });
  }
</script>

<fieldset class="settings-section">
  <legend class="settings-legend">Proxy</legend>

  <div class="setting-row">
    <label class="setting-label" for="persistence-timeout">
      Session Persistence
      <span class="setting-hint">How long the server keeps your session alive after you navigate away or unexpectedly lose connection</span>
    </label>
    <select
      id="persistence-timeout"
      class="setting-input"
      value={String(persistenceTimeout)}
      onchange={handleTimeoutChange}
    >
      {#each timeoutOptions as opt}
        <option value={String(opt.value)}>{opt.label}</option>
      {/each}
    </select>
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
    white-space: normal;
  }

  .setting-input {
    padding: 4px 8px;
    background-color: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-family: var(--font-family);
    font-size: 13px;
    min-width: 120px;
  }

  .setting-input:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: 1px;
  }
</style>
