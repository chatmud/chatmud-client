<script lang="ts">
  import { editorState } from '../../lib/state/editor.svelte';

  let tabsEl: HTMLDivElement | undefined = $state();

  function switchTab(id: string): void {
    editorState.activeSessionId = id;
  }

  function closeTab(event: MouseEvent, id: string): void {
    event.stopPropagation();
    editorState.closeSession(id);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const sessions = editorState.sessions;
    if (sessions.length === 0) return;

    const currentIndex = sessions.findIndex((s) => s.id === editorState.activeSessionId);
    if (currentIndex < 0) return;

    event.preventDefault();
    let nextIndex: number;
    if (event.key === 'ArrowLeft') {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : sessions.length - 1;
    } else {
      nextIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : 0;
    }

    editorState.activeSessionId = sessions[nextIndex].id;

    // Focus the newly active tab button
    if (tabsEl) {
      const buttons = tabsEl.querySelectorAll<HTMLButtonElement>('.tab-button');
      buttons[nextIndex]?.focus();
    }
  }
</script>

<div
  class="editor-tabs"
  role="tablist"
  aria-label="Editor sessions"
  onkeydown={handleKeydown}
  bind:this={tabsEl}
>
  {#each editorState.sessions as session (session.id)}
    <div class="tab-wrapper" class:active={session.id === editorState.activeSessionId}>
      <button
        class="tab-button"
        role="tab"
        aria-selected={session.id === editorState.activeSessionId}
        tabindex={session.id === editorState.activeSessionId ? 0 : -1}
        onclick={() => switchTab(session.id)}
      >
        <span class="tab-name">{session.name}{#if session.dirty}<span class="dirty-indicator" aria-label="unsaved changes">*</span>{/if}</span>
      </button>
      <button
        class="tab-close"
        aria-label="Close {session.name}"
        onclick={(e: MouseEvent) => closeTab(e, session.id)}
        tabindex={-1}
      >
        &times;
      </button>
    </div>
  {/each}
</div>

<style>
  .editor-tabs {
    display: flex;
    overflow-x: auto;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    min-height: 32px;
    scrollbar-width: thin;
  }

  .tab-wrapper {
    display: inline-flex;
    align-items: center;
    border-bottom: 2px solid transparent;
    transition: background-color var(--transition-speed),
      border-color var(--transition-speed);
  }

  .tab-wrapper:hover {
    background-color: var(--bg-tertiary);
  }

  .tab-wrapper.active {
    border-bottom-color: var(--accent);
    background-color: var(--bg-primary);
  }

  .tab-button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px 4px 12px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-family: var(--font-family);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: color var(--transition-speed);
  }

  .tab-wrapper:hover .tab-button,
  .tab-wrapper.active .tab-button {
    color: var(--text-primary);
  }

  .tab-button:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .tab-name {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
  }

  .dirty-indicator {
    color: var(--accent);
    margin-left: 2px;
  }

  .tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 2px;
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }

  .tab-close:hover {
    background-color: var(--bg-input);
    color: var(--text-primary);
  }
</style>
