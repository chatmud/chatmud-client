<script lang="ts">
  import { outputState } from '../../lib/state/output.svelte';
  import { connectionState } from '../../lib/state/connection.svelte';
  import OutputLine from './OutputLine.svelte';

  let container: HTMLElement | undefined = $state(undefined);

  function scrollToBottom() {
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  function isAtBottom(): boolean {
    if (!container) return true;
    const threshold = 30;
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  }

  function handleScroll() {
    outputState.scrollLocked = isAtBottom();
  }

  $effect(() => {
    const _lineCount = outputState.lines.length;
    const locked = outputState.scrollLocked;

    if (locked) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  });

  let showWelcome = $derived(outputState.lines.length === 0 && !connectionState.isConnected);
</script>

<div
  id="output-region"
  class="output-view"
  aria-label="Game output"
  bind:this={container}
  onscroll={handleScroll}
>
  {#if showWelcome}
    <div class="welcome">
      <img src="/logo.png" alt="ChatMUD logo" class="welcome-logo" />
      <p class="welcome-text">Welcome to <strong>ChatMUD</strong></p>
      <p class="welcome-sub">Click <strong>Connect</strong> to begin your adventure</p>
    </div>
  {:else}
    {#each outputState.lines as line (line.id)}
      <OutputLine {line} />
    {/each}
  {/if}

  {#if !outputState.scrollLocked && outputState.lines.length > 0}
    <button
      class="scroll-to-bottom"
      onclick={() => { outputState.scrollLocked = true; scrollToBottom(); }}
      aria-label="Scroll to bottom"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 01.708 0L8 10.293l5.646-5.647a.5.5 0 01.708.708l-6 6a.5.5 0 01-.708 0l-6-6a.5.5 0 010-.708z"/></svg>
    </button>
  {/if}

</div>

<style>
  .output-view {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 14px;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-family);
    font-size: var(--font-size);
    line-height: var(--line-height);
    position: relative;
  }

  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    opacity: 0.8;
  }

  .welcome-logo {
    width: 120px;
    height: 120px;
    object-fit: contain;
    opacity: 0.9;
  }

  .welcome-text {
    font-size: 20px;
    color: var(--text-primary);
    font-weight: 400;
  }

  .welcome-sub {
    font-size: 13px;
    color: var(--text-muted);
  }

  .scroll-to-bottom {
    position: sticky;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-subtle);
    border-radius: 50%;
    background-color: var(--bg-elevated);
    color: var(--text-secondary);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: background-color var(--transition-speed);
    margin: 0 auto;
  }

  .scroll-to-bottom:hover {
    background-color: var(--accent-muted);
    color: var(--accent);
  }

</style>
