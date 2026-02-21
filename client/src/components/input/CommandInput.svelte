<script lang="ts">
  import { inputState } from '../../lib/state/input.svelte';
  import { wsService } from '../../lib/services/websocket';
  import { connectionState } from '../../lib/state/connection.svelte';

  let inputValue = $state('');
  let inputElement: HTMLInputElement | undefined = $state(undefined);

  let inputType = $derived(inputState.echoMode ? 'text' : 'password');
  let isConnected = $derived(connectionState.isConnected);

  $effect(() => {
    if (inputElement) {
      inputElement.focus();
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'Enter': {
        event.preventDefault();
        const command = inputValue;
        if (command !== '') {
          inputState.addToHistory(command);
        }
        wsService.sendCommand(command);
        inputValue = '';
        inputState.currentInput = '';
        inputState.historyIndex = -1;
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const result = inputState.navigateHistory('up');
        inputValue = result;
        inputState.currentInput = result;
        requestAnimationFrame(() => {
          if (inputElement) {
            inputElement.selectionStart = inputElement.value.length;
            inputElement.selectionEnd = inputElement.value.length;
          }
        });
        break;
      }
      case 'ArrowDown': {
        event.preventDefault();
        const result = inputState.navigateHistory('down');
        inputValue = result;
        inputState.currentInput = result;
        break;
      }
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    inputValue = target.value;
    inputState.currentInput = target.value;
    inputState.historyIndex = -1;
  }
</script>

<div class="command-input-bar">
  <span class="input-prompt" aria-hidden="true">&gt;</span>
  <input
    id="command-input"
    class="command-input"
    type={inputType}
    value={inputValue}
    oninput={handleInput}
    onkeydown={handleKeydown}
    bind:this={inputElement}
    placeholder={isConnected ? 'Enter command...' : 'Not connected'}
    aria-label="Command input"
    autocomplete="off"
    autocorrect="off"
    autocapitalize="off"
    spellcheck={false}
    disabled={!isConnected}
  />
</div>

<style>
  .command-input-bar {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    background-color: var(--bg-secondary);
    height: var(--input-height);
    gap: 6px;
  }

  .input-prompt {
    color: var(--accent);
    font-size: 16px;
    font-weight: 700;
    flex-shrink: 0;
    line-height: 1;
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
</style>
