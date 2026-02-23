<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { outputState } from '../../lib/state/output.svelte';
  import { preferencesState } from '../../lib/state/preferences.svelte';

  const CLEAR_DELAY = 7000;

  let containerEl: HTMLDivElement | undefined = $state(undefined);
  let assertiveLog: HTMLElement | null = null;
  let politeLog: HTMLElement | null = null;
  let enabled = $derived(preferencesState.accessibility.ariaLiveRegions);

  onMount(() => {
    if (!containerEl) return;

    assertiveLog = createLog('assertive');
    politeLog = createLog('polite');
    containerEl.appendChild(assertiveLog);
    containerEl.appendChild(politeLog);

    outputState.registerAssertiveCallback(announceAssertive);
  });

  onDestroy(() => {
    assertiveLog = null;
    politeLog = null;
  });

  function createLog(ariaLive: 'assertive' | 'polite'): HTMLElement {
    const node = document.createElement('div');
    node.setAttribute('role', 'log');
    node.setAttribute('aria-live', ariaLive);
    node.setAttribute('aria-relevant', 'additions');
    node.className = 'sr-only';
    return node;
  }

  function appendMessage(log: HTMLElement | null, text: string): void {
    if (!log) return;
    const node = document.createElement('div');
    node.textContent = text;
    log.appendChild(node);
    setTimeout(() => node.remove(), CLEAR_DELAY);
  }

  function announceAssertive(text: string): void {
    if (!enabled) return;
    appendMessage(assertiveLog, text);
  }

  // Polite announcements for MUD output
  $effect(() => {
    const pending = outputState.pendingAnnouncementText;
    if (pending.length === 0) return;

    const texts = untrack(() => outputState.consumeAnnouncements());
    if (!enabled) return;
    for (const text of texts) {
      appendMessage(politeLog, text);
    }
  });
</script>

<div bind:this={containerEl}></div>
