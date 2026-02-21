<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { outputState } from '../../lib/state/output.svelte';

  let liveEl: HTMLDivElement | null = null;
  let containerEl: HTMLDivElement | undefined = $state(undefined);
  let bufferTimer: ReturnType<typeof setTimeout> | null = null;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;
  let textBuffer = '';

  const BUFFER_DELAY = 250;
  const CLEAR_DELAY = 1000;
  const MAX_BUFFER = 1000;

  onMount(() => {
    if (!containerEl) return;

    // Create the live region dynamically after mount, matching svelte-mud's
    // approach. Screen readers register live regions at parse time; creating
    // the element after mount avoids stale-region quirks.
    liveEl = document.createElement('div');
    liveEl.setAttribute('aria-live', 'polite');
    liveEl.setAttribute('aria-atomic', 'true');
    liveEl.className = 'sr-only';
    containerEl.appendChild(liveEl);
  });

  onDestroy(() => {
    if (bufferTimer !== null) clearTimeout(bufferTimer);
    if (clearTimer !== null) clearTimeout(clearTimer);
    if (liveEl?.parentNode) liveEl.parentNode.removeChild(liveEl);
    liveEl = null;
  });

  function flush(): void {
    if (!liveEl || !textBuffer.trim()) return;

    if (bufferTimer !== null) {
      clearTimeout(bufferTimer);
      bufferTimer = null;
    }
    if (clearTimer !== null) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }

    liveEl.textContent = textBuffer;
    textBuffer = '';

    clearTimer = setTimeout(() => {
      if (liveEl) liveEl.textContent = '';
      clearTimer = null;
    }, CLEAR_DELAY);
  }

  $effect(() => {
    const pending = outputState.pendingAnnouncementText;
    if (pending.length === 0) return;

    const texts = outputState.consumeAnnouncements();
    for (const text of texts) {
      textBuffer += (textBuffer ? ' ' : '') + text;
    }

    if (textBuffer.length > MAX_BUFFER) {
      flush();
      return;
    }

    if (bufferTimer !== null) {
      clearTimeout(bufferTimer);
    }
    bufferTimer = setTimeout(flush, BUFFER_DELAY);
  });
</script>

<div bind:this={containerEl}></div>
