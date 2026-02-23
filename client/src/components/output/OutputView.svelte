<script lang="ts">
  import { outputState } from '../../lib/state/output.svelte';
  import { connectionState } from '../../lib/state/connection.svelte';
  import OutputLine from './OutputLine.svelte';

  let container: HTMLElement | undefined = $state(undefined);
  let focusedLineIndex: number | null = $state(null);
  let lineCountWhenUnlocked = $state(0);
  let newLineCount = $derived(
    outputState.scrollLocked ? 0 : Math.max(0, outputState.lines.length - lineCountWhenUnlocked)
  );

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
    const wasLocked = outputState.scrollLocked;
    const nowLocked = isAtBottom();
    outputState.scrollLocked = nowLocked;
    if (wasLocked && !nowLocked) {
      lineCountWhenUnlocked = outputState.lines.length;
    }
  }

  $effect(() => {
    outputState.lines.length;
    const locked = outputState.scrollLocked;

    if (locked) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  });

  let showWelcome = $derived(outputState.lines.length === 0 && !connectionState.isConnected);

  function announceOutputLine(lineIndex: number): void {
    const line = outputState.lines[lineIndex];
    if (!line) return;
    let text: string;
    if (line.html) {
      const tmp = document.createElement('div');
      tmp.innerHTML = line.html;
      text = tmp.textContent || '';
    } else {
      text = line.spans.map((s) => s.text).join('');
    }
    if (text.length > 0) {
      outputState.announce(text);
    }
  }

  function scrollFocusedLineIntoView(index: number): void {
    if (!container) return;
    const el = container.querySelector(`[data-line-index="${index}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /** Suppress Alt+key combinations used by channel history */
  function isChannelHistoryKey(e: KeyboardEvent): boolean {
    if (!e.altKey) return false;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return true;
    const navLetters = new Set(['i', 'j', 'k', 'l', 'w', 'a', 's', 'd', 'c', 'h', 't', 'n', 'o', 'e', ',']);
    if (navLetters.has(e.key.toLowerCase())) return true;
    const codeMatch = e.code.match(/^Key([A-Z])$/);
    if (codeMatch && navLetters.has(codeMatch[1].toLowerCase())) return true;
    if (e.code === 'Comma') return true;
    if (e.key === ' ') return true;
    if (/^Digit\d$/.test(e.code) || /^\d$/.test(e.key)) return true;
    if (['PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) return true;
    if (e.key === 'Delete') return true;
    return false;
  }

  function handleOutputKeyDown(e: KeyboardEvent): void {
    // Let Alt+key combos pass through to global handler
    if (isChannelHistoryKey(e)) return;

    // Redirect printable keystrokes to command input
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const input = document.getElementById('command-input') as HTMLInputElement | null;
      if (input && !input.disabled) {
        input.focus();
        return;
      }
    }

    const lineCount = outputState.lines.length;
    if (lineCount === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (focusedLineIndex === null) {
          focusedLineIndex = lineCount - 1;
        } else if (focusedLineIndex < lineCount - 1) {
          focusedLineIndex++;
        }
        announceOutputLine(focusedLineIndex);
        scrollFocusedLineIntoView(focusedLineIndex);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (focusedLineIndex === null) {
          focusedLineIndex = lineCount - 1;
        } else if (focusedLineIndex > 0) {
          focusedLineIndex--;
        }
        announceOutputLine(focusedLineIndex);
        scrollFocusedLineIntoView(focusedLineIndex);
        break;
      }
      case 'Home': {
        e.preventDefault();
        focusedLineIndex = 0;
        announceOutputLine(focusedLineIndex);
        scrollFocusedLineIntoView(focusedLineIndex);
        break;
      }
      case 'End': {
        e.preventDefault();
        focusedLineIndex = lineCount - 1;
        announceOutputLine(focusedLineIndex);
        scrollFocusedLineIntoView(focusedLineIndex);
        break;
      }
    }
  }

  function handleOutputFocus(): void {
    if (focusedLineIndex === null && outputState.lines.length > 0) {
      focusedLineIndex = outputState.lines.length - 1;
    }
  }
</script>

<div class="output-wrapper">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    id="output-region"
    class="output-view"
    role="log"
    aria-label="Output"
    aria-live="off"
    tabindex={0}
    bind:this={container}
    onscroll={handleScroll}
    onkeydown={handleOutputKeyDown}
    onfocus={handleOutputFocus}
  >
    {#if showWelcome}
      <div class="welcome">
        <img src="/logo.png" alt="ChatMUD logo" class="welcome-logo" />
        <p class="welcome-text">Welcome to <strong>ChatMUD</strong></p>
        <p class="welcome-sub">Click <strong>Connect</strong> to begin your adventure</p>
      </div>
    {:else}
      {#each outputState.lines as line, index (line.id)}
        <OutputLine {line} focused={focusedLineIndex === index} {index} />
      {/each}
    {/if}
  </div>

  {#if !outputState.scrollLocked && outputState.lines.length > 0}
    <button
      class="scroll-to-bottom"
      onclick={() => { outputState.scrollLocked = true; scrollToBottom(); }}
      aria-label={newLineCount > 0 ? `Scroll to bottom, ${newLineCount} new lines` : 'Scroll to bottom'}
    >
      {#if newLineCount > 0}
        <span class="new-line-badge">{newLineCount > 99 ? '99+' : newLineCount}</span>
      {/if}
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 01.708 0L8 10.293l5.646-5.647a.5.5 0 01.708.708l-6 6a.5.5 0 01-.708 0l-6-6a.5.5 0 010-.708z"/></svg>
    </button>
  {/if}
</div>

<style>
  .output-wrapper {
    position: relative;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .output-view {
    height: 100%;
    overflow-y: scroll;
    overflow-x: hidden;
    padding: 4px 14px;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-family);
    font-size: var(--font-size);
    line-height: var(--line-height);
    outline: none;
  }

  .output-view:focus {
    box-shadow: inset 0 0 0 2px var(--accent-muted);
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
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 32px;
    height: auto;
    padding: 4px 8px;
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    background-color: var(--bg-elevated);
    color: var(--text-secondary);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: background-color var(--transition-speed);
  }

  .scroll-to-bottom:hover {
    background-color: var(--accent-muted);
    color: var(--accent);
  }

  .new-line-badge {
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    color: var(--accent);
  }

  .scroll-to-bottom:hover .new-line-badge {
    color: var(--accent);
  }

</style>
