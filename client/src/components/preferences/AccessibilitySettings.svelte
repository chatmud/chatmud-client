<script lang="ts">
  import { preferencesState } from '../../lib/state/preferences.svelte';
  import Toggle from '../common/Toggle.svelte';
  import Select from '../common/Select.svelte';

  const verbosityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  function handleVerbosityChange(value: string): void {
    preferencesState.updateAccessibility({
      verbosity: value as 'low' | 'medium' | 'high',
    });
  }

  function handleBatchAnnouncementsChange(checked: boolean): void {
    preferencesState.updateAccessibility({ batchAnnouncements: checked });
  }

  function handleFocusRingChange(checked: boolean): void {
    preferencesState.updateAccessibility({ focusRing: checked });
  }

  function handleReducedMotionChange(checked: boolean): void {
    preferencesState.updateAccessibility({ reducedMotion: checked });
  }

  function handleAriaLiveChange(checked: boolean): void {
    preferencesState.updateAccessibility({ ariaLiveRegions: checked });
  }
</script>

<fieldset class="settings-section">
  <legend class="settings-legend">Accessibility</legend>

  <div class="setting-row">
    <Select
      label="Verbosity"
      value={preferencesState.accessibility.verbosity}
      options={verbosityOptions}
      onchange={handleVerbosityChange}
    />
  </div>

  <div class="setting-row">
    <Toggle
      label="Batch announcements"
      checked={preferencesState.accessibility.batchAnnouncements}
      onchange={handleBatchAnnouncementsChange}
    />
  </div>

  <div class="setting-row">
    <Toggle
      label="Focus ring"
      checked={preferencesState.accessibility.focusRing}
      onchange={handleFocusRingChange}
    />
  </div>

  <div class="setting-row">
    <Toggle
      label="Reduced motion"
      checked={preferencesState.accessibility.reducedMotion}
      onchange={handleReducedMotionChange}
    />
  </div>

  <div class="setting-row">
    <Toggle
      label="Aria live regions"
      checked={preferencesState.accessibility.ariaLiveRegions}
      onchange={handleAriaLiveChange}
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
