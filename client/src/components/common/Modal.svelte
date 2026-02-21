<script lang="ts">
  import type { Snippet } from 'svelte';
  import { focusTrap } from '../../actions/focus-trap';

  let {
    open,
    onclose,
    title,
    children,
  } = $props<{
    open: boolean;
    onclose: () => void;
    title: string;
    children: Snippet;
  }>();

  const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
    use:focusTrap
  >
    <div class="modal-dialog">
      <div class="modal-header">
        <h2 id={titleId} class="modal-title">{title}</h2>
        <button
          class="modal-close"
          onclick={onclose}
          aria-label="Close dialog"
        >
          &times;
        </button>
      </div>
      <div class="modal-body">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.6);
  }

  .modal-dialog {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    width: min(560px, 90vw);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 20px;
    cursor: pointer;
    padding: 4px 8px;
    line-height: 1;
    border-radius: 4px;
  }

  .modal-close:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 16px;
    overflow-y: auto;
  }
</style>
