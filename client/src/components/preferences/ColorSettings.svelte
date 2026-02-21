<script lang="ts">
  import { preferencesState } from '../../lib/state/preferences.svelte';
  import Select from '../common/Select.svelte';

  const themeOptions = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'high-contrast', label: 'High Contrast' },
  ];

  function handleThemeChange(value: string): void {
    preferencesState.setTheme(value as 'dark' | 'light' | 'high-contrast');
  }
</script>

<fieldset class="settings-section">
  <legend class="settings-legend">Colors</legend>

  <div class="setting-row">
    <Select
      label="Theme"
      value={preferencesState.theme}
      options={themeOptions}
      onchange={handleThemeChange}
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
