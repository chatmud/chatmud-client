<script lang="ts">
  import AppShell from './components/layout/AppShell.svelte';
  import SkipLinks from './components/accessibility/SkipLinks.svelte';
  import ScreenReaderAnnouncer from './components/accessibility/ScreenReaderAnnouncer.svelte';
  import { preferencesState } from './lib/state/preferences.svelte';

  $effect(() => {
    document.documentElement.setAttribute('data-theme', preferencesState.theme);
  });

  $effect(() => {
    document.documentElement.style.setProperty('--font-family', preferencesState.font.family);
    document.documentElement.style.setProperty('--font-size', `${preferencesState.font.size}px`);
    document.documentElement.style.setProperty('--line-height', String(preferencesState.font.lineHeight));
  });
</script>

<SkipLinks />
<AppShell />
<ScreenReaderAnnouncer />
