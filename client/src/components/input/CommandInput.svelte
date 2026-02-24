<script lang="ts">
  import { inputState } from '../../lib/state/input.svelte';
  import { wsService } from '../../lib/services/websocket';
  import { connectionState } from '../../lib/state/connection.svelte';
  import { slashCommandState } from '../../lib/state/slash-commands.svelte';
  import { findCommand } from '../../lib/commands/registry';
  import type { SlashCommand } from '../../lib/commands/registry';
  import SlashCommandMenu from './SlashCommandMenu.svelte';

  let inputValue = $state('');
  let inputElement: HTMLTextAreaElement | HTMLInputElement | undefined = $state(undefined);

  let isPasswordMode = $derived(!inputState.echoMode);
  let isConnected = $derived(connectionState.isConnected);
  let autosay = $derived(inputState.autosayMode);

  let menuVisible = $derived(
    slashCommandState.isOpen && slashCommandState.suggestions.length > 0
  );

  let activeDescendantId = $derived(
    menuVisible ? 'slash-opt-' + slashCommandState.selectedCommand?.name : undefined
  );

  function autoResize() {
    if (!inputElement || !(inputElement instanceof HTMLTextAreaElement)) return;
    inputElement.style.height = 'auto';
    const scrollHeight = inputElement.scrollHeight;
    inputElement.style.height = scrollHeight + 'px';
    // Switch to scrollable when content exceeds the CSS max-height
    const maxHeight = parseFloat(getComputedStyle(inputElement).maxHeight);
    inputElement.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  function isCursorOnFirstLine(): boolean {
    if (!inputElement) return true;
    const pos = inputElement.selectionStart ?? 0;
    return !inputValue.substring(0, pos).includes('\n');
  }

  function isCursorOnLastLine(): boolean {
    if (!inputElement) return true;
    const pos = inputElement.selectionStart ?? 0;
    return !inputValue.substring(pos).includes('\n');
  }

  $effect(() => {
    if (inputElement && isConnected) {
      inputElement.focus();
    }
  });

  /** Suppress Alt+key combinations used by channel history navigation */
  function isChannelHistoryKey(e: KeyboardEvent): boolean {
    if (!e.altKey) return false;
    // Arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return true;
    // Navigation scheme letters (all schemes: i,j,k,l,w,a,s,d,c,h,t,n,o,e and comma)
    const navLetters = new Set(['i', 'j', 'k', 'l', 'w', 'a', 's', 'd', 'c', 'h', 't', 'n', 'o', 'e', ',']);
    if (navLetters.has(e.key.toLowerCase())) return true;
    // Also check e.code fallback for macOS Option+letter
    const codeMatch = e.code.match(/^Key([A-Z])$/);
    if (codeMatch && navLetters.has(codeMatch[1].toLowerCase())) return true;
    if (e.code === 'Comma') return true;
    // Space (repeat/copy message)
    if (e.key === ' ') return true;
    // Digits (read/jump-to-buffer)
    if (/^Digit\d$/.test(e.code) || /^\d$/.test(e.key)) return true;
    // PageUp/PageDown/Home/End
    if (['PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) return true;
    // Delete (delete buffer)
    if (e.key === 'Delete') return true;
    return false;
  }

  function moveCursorToEnd() {
    if (inputElement) {
      inputElement.selectionStart = inputElement.value.length;
      inputElement.selectionEnd = inputElement.value.length;
    }
  }

  function acceptSuggestion(cmd: SlashCommand) {
    if (!cmd.args) {
      cmd.action();
      inputValue = '';
      inputState.currentInput = '';
      inputState.historyIndex = -1;
      slashCommandState.close();
      requestAnimationFrame(() => {
        autoResize();
        inputElement?.focus();
      });
    } else {
      inputValue = '/' + cmd.name + ' ';
      inputState.currentInput = inputValue;
      slashCommandState.close();
      requestAnimationFrame(() => {
        autoResize();
        moveCursorToEnd();
      });
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    // Suppress Alt+key combinations so browser doesn't intercept them
    if (isChannelHistoryKey(event)) {
      event.preventDefault();
      return;
    }

    // Slash command menu navigation
    if (menuVisible) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        slashCommandState.selectPrev();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        slashCommandState.selectNext();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        slashCommandState.close();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        const cmd = slashCommandState.selectedCommand;
        if (cmd) acceptSuggestion(cmd);
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const cmd = slashCommandState.selectedCommand;
        if (cmd) acceptSuggestion(cmd);
        return;
      }
    }

    switch (event.key) {
      case 'Enter': {
        if (event.shiftKey) {
          // Allow Shift+Enter to insert a newline
          return;
        }
        event.preventDefault();
        const command = inputValue;

        // Client-side slash command interception
        const trimmed = command.trim();
        if (trimmed.startsWith('/')) {
          const match = findCommand(trimmed);
          if (match) {
            match.action();
            inputValue = '';
            inputState.currentInput = '';
            inputState.historyIndex = -1;
            slashCommandState.close();
            requestAnimationFrame(autoResize);
            return;
          }
        }

        if (command !== '') {
          inputState.addToHistory(command);
        }
        // Split multiline input and send each line as a separate command.
        // Autosay mode prepends "say " to non-empty lines that aren't slash-prefixed.
        const lines = command.split('\n');
        for (const line of lines) {
          const out =
            inputState.autosayMode && line.length > 0 && !line.trimStart().startsWith('/')
              ? 'say ' + line
              : line;
          wsService.sendCommand(out);
        }
        inputValue = '';
        inputState.currentInput = '';
        inputState.historyIndex = -1;
        slashCommandState.close();
        requestAnimationFrame(autoResize);
        break;
      }
      case 'ArrowUp': {
        // Only navigate history when cursor is on the first line
        if (!isCursorOnFirstLine()) break;
        event.preventDefault();
        const result = inputState.navigateHistory('up');
        inputValue = result;
        inputState.currentInput = result;
        requestAnimationFrame(() => {
          autoResize();
          moveCursorToEnd();
        });
        break;
      }
      case 'ArrowDown': {
        // Only navigate history when cursor is on the last line
        if (!isCursorOnLastLine()) break;
        event.preventDefault();
        const result = inputState.navigateHistory('down');
        inputValue = result;
        inputState.currentInput = result;
        requestAnimationFrame(autoResize);
        break;
      }
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement | HTMLInputElement;
    inputValue = target.value;
    inputState.currentInput = target.value;
    inputState.historyIndex = -1;
    autoResize();

    const val = inputValue;
    if (!isPasswordMode && val.startsWith('/') && !val.includes('\n')) {
      slashCommandState.open(val.slice(1).toLowerCase());
    } else {
      slashCommandState.close();
    }
  }

  function handleBlur() {
    setTimeout(() => slashCommandState.close(), 150);
  }
</script>

<div class="command-input-bar">
  <span class="input-prompt" class:autosay aria-hidden="true">{#if autosay}say&gt;{:else}&gt;{/if}</span>
  <div class="input-wrapper">
    {#if menuVisible}
      <SlashCommandMenu onselect={acceptSuggestion} />
    {/if}
    {#if isPasswordMode}
      <input
        id="command-input"
        class="command-input"
        type="password"
        value={inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onblur={handleBlur}
        bind:this={inputElement}
        placeholder={isConnected ? 'Enter command...' : 'Not connected'}
        aria-label="Command input"
        autocomplete="off"
        autocapitalize="off"
        spellcheck={false}
        disabled={!isConnected}
      />
    {:else}
      <textarea
        id="command-input"
        class="command-input"
        class:autosay
        value={inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onblur={handleBlur}
        bind:this={inputElement}
        placeholder={isConnected ? 'Enter command...' : 'Not connected'}
        role="combobox"
        aria-label="Command input"
        aria-autocomplete="list"
        aria-expanded={menuVisible}
        aria-controls="slash-command-menu"
        aria-activedescendant={activeDescendantId}
        autocomplete="off"
        autocapitalize="off"
        spellcheck={false}
        disabled={!isConnected}
        rows={1}
      ></textarea>
    {/if}
  </div>
</div>

<style>
  .command-input-bar {
    display: flex;
    align-items: flex-start;
    padding: 6px 12px;
    background-color: var(--bg-secondary);
    min-height: var(--input-height);
    gap: 6px;
  }

  .input-prompt {
    color: var(--accent);
    font-size: 16px;
    font-weight: 700;
    flex-shrink: 0;
    line-height: var(--line-height);
    padding-top: 7px;
  }

  .input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .command-input {
    flex: 1;
    padding: 7px 10px;
    background-color: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    font-family: var(--font-family);
    font-size: var(--font-size);
    line-height: var(--line-height);
    outline: none; /* Custom focus style below replaces native outline */
    transition: border-color var(--transition-speed), box-shadow var(--transition-speed);
    resize: none;
    overflow-y: hidden;
    max-height: 150px;
  }

  .command-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-muted);
  }

  .command-input::placeholder {
    color: var(--text-muted);
  }

  .command-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .command-input:disabled::placeholder {
    color: var(--text-secondary);
  }

  /* Autosay mode — amber accent throughout the input bar */
  .input-prompt.autosay {
    color: var(--warning);
    transition: color var(--transition-speed);
  }

  .command-input.autosay {
    border-color: color-mix(in srgb, var(--warning) 40%, var(--border-subtle));
  }

  .command-input.autosay:focus {
    border-color: var(--warning);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--warning) 20%, transparent);
  }
</style>
