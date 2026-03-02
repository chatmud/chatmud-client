<script lang="ts">
  import { preferencesState } from '../../lib/state/preferences.svelte';
  import Select from '../common/Select.svelte';

  // --- Font ---

  const MONOSPACE_FONTS = [
    { value: "'Consolas', 'Courier New', 'Liberation Mono', monospace", label: 'Consolas' },
    { value: "'Courier New', Courier, monospace", label: 'Courier New' },
    { value: "'Fira Code', 'Fira Mono', monospace", label: 'Fira Code' },
    { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
    { value: "'Source Code Pro', monospace", label: 'Source Code Pro' },
    { value: "'Ubuntu Mono', monospace", label: 'Ubuntu Mono' },
    { value: "'SF Mono', Monaco, monospace", label: 'SF Mono' },
    { value: "monospace", label: 'System Monospace' },
  ];

  let fontFamily = $state(preferencesState.font.family);
  let fontSize = $state(preferencesState.font.size);
  let lineHeight = $state(preferencesState.font.lineHeight);

  function handleFontFamilyChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    fontFamily = target.value;
    preferencesState.updateFont({ family: fontFamily });
  }

  function handleFontSizeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (value >= 8 && value <= 32) {
      fontSize = value;
      preferencesState.updateFont({ size: fontSize });
    }
  }

  function handleLineHeightChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    if (value >= 1.0 && value <= 2.5) {
      lineHeight = value;
      preferencesState.updateFont({ lineHeight });
    }
  }

  // --- Colors ---

  const themeOptions = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'high-contrast', label: 'High Contrast' },
  ];

  function handleThemeChange(value: string): void {
    preferencesState.setTheme(value as 'dark' | 'light' | 'high-contrast');
  }

  // --- Buffer ---

  function handleMaxLinesChange(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value);
    if (Number.isFinite(val) && val >= 500 && val <= 50000) {
      preferencesState.updateDisplay({ maxOutputLines: val });
    }
  }
</script>

<div class="output-panel">
  <fieldset class="settings-section">
    <legend class="settings-legend">Font</legend>

    <div class="setting-row">
      <label class="setting-label" for="font-family">Font family</label>
      <select
        id="font-family"
        class="setting-select"
        value={fontFamily}
        onchange={handleFontFamilyChange}
      >
        {#each MONOSPACE_FONTS as font (font.value)}
          <option value={font.value}>{font.label}</option>
        {/each}
      </select>
    </div>

    <div class="setting-row">
      <label class="setting-label" for="font-size">Size</label>
      <input
        id="font-size"
        class="setting-input"
        type="number"
        min="8"
        max="32"
        step="1"
        value={fontSize}
        onchange={handleFontSizeChange}
      />
    </div>

    <div class="setting-row">
      <label class="setting-label" for="line-height">Line height</label>
      <input
        id="line-height"
        class="setting-input"
        type="number"
        min="1.0"
        max="2.5"
        step="0.1"
        value={lineHeight}
        onchange={handleLineHeightChange}
      />
    </div>
  </fieldset>

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

  <fieldset class="settings-section">
    <legend class="settings-legend">Buffer</legend>

    <div class="setting-row">
      <label class="setting-label" for="max-output-lines">Max output lines</label>
      <input
        id="max-output-lines"
        class="setting-input"
        type="number"
        min="500"
        max="50000"
        step="500"
        value={preferencesState.display.maxOutputLines}
        onchange={handleMaxLinesChange}
      />
    </div>
  </fieldset>
</div>

<style>
  .output-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 420px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-subtle) transparent;
  }

  .settings-section {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 10px 16px 12px;
    margin: 0;
  }

  .settings-legend {
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    padding: 0 6px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 0;
  }

  .setting-row + .setting-row {
    border-top: 1px solid var(--border-subtle);
  }

  .setting-label {
    color: var(--text-secondary);
    font-size: 13px;
    white-space: nowrap;
  }

  .setting-select,
  .setting-input {
    padding: 4px 8px;
    background-color: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-family: var(--font-family);
    font-size: 13px;
  }

  .setting-select {
    min-width: 120px;
  }

  .setting-input {
    width: 80px;
  }

  .setting-select:focus-visible,
  .setting-input:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: 1px;
  }
</style>
