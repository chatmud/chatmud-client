<script lang="ts">
  import { preferencesState } from '../../lib/state/preferences.svelte';
  import { ttsState } from '../../lib/state/tts.svelte';
  import Toggle from '../common/Toggle.svelte';

  let voiceOptions = $derived(
    ttsState.voices.map((v) => ({
      value: v.name,
      label: `${v.name} (${v.lang})`,
    }))
  );

  // General
  function handleReducedMotionChange(checked: boolean): void {
    preferencesState.updateAccessibility({ reducedMotion: checked });
  }

  // Screen reader
  function handleAriaLiveChange(checked: boolean): void {
    preferencesState.updateAccessibility({ ariaLiveRegions: checked });
  }
  // TTS
  function handleEnabledChange(checked: boolean): void {
    preferencesState.updateTts({ enabled: checked });
  }
  function handleVoiceChange(event: Event): void {
    preferencesState.updateTts({ voice: (event.target as HTMLSelectElement).value });
  }
  function handleRateChange(event: Event): void {
    preferencesState.updateTts({ rate: parseFloat((event.target as HTMLInputElement).value) });
  }
  function handlePitchChange(event: Event): void {
    preferencesState.updateTts({ pitch: parseFloat((event.target as HTMLInputElement).value) });
  }
  function handleVolumeChange(event: Event): void {
    preferencesState.updateTts({ volume: parseFloat((event.target as HTMLInputElement).value) });
  }
  function handleInterruptChange(checked: boolean): void {
    preferencesState.updateTts({ interruptOnNew: checked });
  }
  function handleActivationModeChange(event: Event): void {
    preferencesState.updateTts({ activationMode: (event.target as HTMLSelectElement).value as 'always' | 'focused' | 'unfocused' });
  }
</script>

<div class="a11y-panel">
  <fieldset class="settings-section">
    <legend class="settings-legend">General</legend>

    <div class="setting-row">
      <Toggle label="Reduced motion" checked={preferencesState.accessibility.reducedMotion} onchange={handleReducedMotionChange} />
    </div>
  </fieldset>

  <fieldset class="settings-section">
    <legend class="settings-legend">Screen Reader</legend>

    <div class="setting-row">
      <Toggle label="Aria live regions" checked={preferencesState.accessibility.ariaLiveRegions} onchange={handleAriaLiveChange} />
    </div>

  </fieldset>

  <fieldset class="settings-section">
    <legend class="settings-legend">Text to Speech</legend>

    <div class="setting-row">
      <Toggle label="Enable TTS" checked={preferencesState.tts.enabled} onchange={handleEnabledChange} disabled={!ttsState.available} />
    </div>

    {#if !ttsState.available}
      <p class="tts-unavailable">Speech synthesis is not available in this browser.</p>
    {/if}

    <div class="setting-row">
      <label class="setting-label" for="tts-voice">Voice</label>
      <select id="tts-voice" class="setting-select" value={preferencesState.tts.voice} onchange={handleVoiceChange} disabled={!preferencesState.tts.enabled}>
        <option value="">Default</option>
        {#each voiceOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <div class="setting-row">
      <label class="setting-label" for="tts-rate">Rate ({preferencesState.tts.rate.toFixed(1)})</label>
      <input id="tts-rate" class="setting-range" type="range" min="0.1" max="10" step="0.1" value={preferencesState.tts.rate} oninput={handleRateChange} disabled={!preferencesState.tts.enabled} />
    </div>

    <div class="setting-row">
      <label class="setting-label" for="tts-pitch">Pitch ({preferencesState.tts.pitch.toFixed(1)})</label>
      <input id="tts-pitch" class="setting-range" type="range" min="0" max="2" step="0.1" value={preferencesState.tts.pitch} oninput={handlePitchChange} disabled={!preferencesState.tts.enabled} />
    </div>

    <div class="setting-row">
      <label class="setting-label" for="tts-volume">Volume ({preferencesState.tts.volume.toFixed(1)})</label>
      <input id="tts-volume" class="setting-range" type="range" min="0" max="1" step="0.05" value={preferencesState.tts.volume} oninput={handleVolumeChange} disabled={!preferencesState.tts.enabled} />
    </div>

    <div class="setting-row">
      <Toggle label="Interrupt on new message" checked={preferencesState.tts.interruptOnNew} onchange={handleInterruptChange} disabled={!preferencesState.tts.enabled} />
    </div>

    <div class="setting-row">
      <label class="setting-label" for="tts-activation">Speak when</label>
      <select id="tts-activation" class="setting-select" value={preferencesState.tts.activationMode} onchange={handleActivationModeChange} disabled={!preferencesState.tts.enabled}>
        <option value="always">Always</option>
        <option value="focused">Window is focused</option>
        <option value="unfocused">Window is unfocused</option>
      </select>
    </div>
  </fieldset>
</div>

<style>
  .a11y-panel {
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
    min-width: 100px;
  }

  .setting-select {
    flex: 1;
    padding: 4px 8px;
    background-color: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-family: var(--font-family);
    font-size: 13px;
    cursor: pointer;
    appearance: auto;
  }

  .setting-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .setting-range {
    flex: 1;
    accent-color: var(--accent);
  }

  .setting-range:disabled {
    opacity: 0.5;
  }

  .setting-select:focus-visible,
  .setting-range:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: 1px;
  }

  .tts-unavailable {
    color: var(--text-muted);
    font-size: 12px;
    font-style: italic;
    margin: 4px 0;
  }
</style>
