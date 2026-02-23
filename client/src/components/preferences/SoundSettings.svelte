<script lang="ts">
  import { preferencesState } from '../../lib/state/preferences.svelte';
  import { mediaState } from '../../lib/state/media.svelte';
  import { mediaService } from '../../lib/services/media-service';

  const sliders: { key: 'masterVolume' | 'soundVolume' | 'ambianceVolume'; label: string }[] = [
    { key: 'masterVolume', label: 'Master' },
    { key: 'soundVolume', label: 'Sound' },
    { key: 'ambianceVolume', label: 'Ambience' },
  ];

  function handleInput(key: 'masterVolume' | 'soundVolume' | 'ambianceVolume', event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    preferencesState.updateSound({ [key]: value });
    mediaState[key] = value;
    mediaService.updateVolumes();
  }
</script>

<div class="sound-panel">
  {#each sliders as { key, label } (key)}
    <div class="vol-row">
      <label class="vol-label" for="vol-{key}">{label}</label>
      <input
        id="vol-{key}"
        class="vol-range"
        type="range"
        min="0"
        max="100"
        step="1"
        value={preferencesState.sound[key]}
        oninput={(e) => handleInput(key, e)}
      />
      <span class="vol-value">{preferencesState.sound[key]}%</span>
    </div>
  {/each}
</div>

<style>
  .sound-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    min-width: 200px;
  }

  .vol-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vol-label {
    color: var(--text-secondary);
    font-size: 12px;
    min-width: 58px;
    flex-shrink: 0;
  }

  .vol-range {
    flex: 1;
    height: 4px;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .vol-range:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: 2px;
  }

  .vol-value {
    color: var(--text-muted, var(--text-secondary));
    font-size: 11px;
    min-width: 32px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
