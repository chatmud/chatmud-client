<script lang="ts">
  import { uiState } from '../../lib/state/ui.svelte';
  import Modal from '../common/Modal.svelte';
  import FontSettings from './FontSettings.svelte';
  import ColorSettings from './ColorSettings.svelte';
  import TTSSettings from './TTSSettings.svelte';
  import ProxySettings from './ProxySettings.svelte';
  import AccessibilitySettings from './AccessibilitySettings.svelte';
  import AboutInfo from './AboutInfo.svelte';
  import DebugSettings from './DebugSettings.svelte';
  import ShortcutKeys from './ShortcutKeys.svelte';

  type SectionId = 'font' | 'colors' | 'tts' | 'proxy' | 'accessibility' | 'shortcuts' | 'debug' | 'about';

  const sections: { id: SectionId; label: string }[] = [
    { id: 'font', label: 'Font' },
    { id: 'colors', label: 'Colors' },
    { id: 'tts', label: 'TTS' },
    { id: 'proxy', label: 'Proxy' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'debug', label: 'Debug' },
    { id: 'about', label: 'About' },
  ];

  let activeSection = $state<SectionId>('font');
  let focusedIndex = $state(0);

  $effect(() => {
    if (uiState.preferencesSection && uiState.preferencesOpen) {
      const target = uiState.preferencesSection as SectionId;
      if (sections.some(s => s.id === target)) {
        switchSection(target);
      }
      uiState.preferencesSection = null;
    }
  });

  function handleClose(): void {
    uiState.preferencesOpen = false;
  }

  function switchSection(id: SectionId): void {
    activeSection = id;
    focusedIndex = sections.findIndex((s) => s.id === id);
  }

  function handleTabKeydown(event: KeyboardEvent): void {
    let newIndex = focusedIndex;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        newIndex = (focusedIndex + 1) % sections.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = (focusedIndex - 1 + sections.length) % sections.length;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = sections.length - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        activeSection = sections[focusedIndex].id;
        return;
      default:
        return;
    }

    focusedIndex = newIndex;
    const tabEl = document.getElementById(`prefs-tab-${sections[newIndex].id}`);
    tabEl?.focus();
  }
</script>

<Modal open={uiState.preferencesOpen} onclose={handleClose} title="Preferences">
  <div class="preferences-layout">
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="preferences-nav" role="tablist" aria-label="Preferences sections" aria-orientation="vertical" onkeydown={handleTabKeydown}>
      {#each sections as section, i (section.id)}
        <button
          id="prefs-tab-{section.id}"
          class="nav-item"
          class:active={activeSection === section.id}
          role="tab"
          aria-selected={activeSection === section.id}
          aria-controls="prefs-panel-{section.id}"
          tabindex={i === focusedIndex ? 0 : -1}
          onclick={() => switchSection(section.id)}
        >
          {section.label}
        </button>
      {/each}
    </div>

    {#each sections as section (section.id)}
      <div
        id="prefs-panel-{section.id}"
        class="preferences-content"
        role="tabpanel"
        aria-labelledby="prefs-tab-{section.id}"
        tabindex="0"
        hidden={activeSection !== section.id}
      >
        {#if section.id === 'font'}
          <FontSettings />
        {:else if section.id === 'colors'}
          <ColorSettings />
        {:else if section.id === 'tts'}
          <TTSSettings />
        {:else if section.id === 'proxy'}
          <ProxySettings />
        {:else if section.id === 'accessibility'}
          <AccessibilitySettings />
        {:else if section.id === 'shortcuts'}
          <ShortcutKeys />
        {:else if section.id === 'debug'}
          <DebugSettings />
        {:else if section.id === 'about'}
          <AboutInfo />
        {/if}
      </div>
    {/each}
  </div>
</Modal>

<style>
  .preferences-layout {
    display: flex;
    gap: 16px;
    min-height: 300px;
  }

  .preferences-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 120px;
    border-right: 1px solid var(--border-color);
    padding-right: 16px;
  }

  .nav-item {
    display: block;
    width: 100%;
    padding: 6px 10px;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--text-secondary);
    font-family: var(--font-family);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background-color var(--transition-speed),
      color var(--transition-speed);
  }

  .nav-item:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .nav-item.active {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    font-weight: 600;
  }

  .nav-item:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: -1px;
  }

  .preferences-content {
    flex: 1;
    min-width: 0;
  }

  .preferences-content:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: -1px;
    border-radius: 4px;
  }
</style>
