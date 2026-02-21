<script lang="ts">
  import { editorState } from '../../lib/state/editor.svelte';
  import { sendEditSet } from '../../lib/services/mcp-packages/simpleedit';
  import Button from '../common/Button.svelte';

  const session = $derived(editorState.activeSession);

  function handleSend(): void {
    if (!session) return;
    sendEditSet(session.reference, session.type, session.content);
    editorState.closeSession(session.id);
  }

  function handleClose(): void {
    if (!session) return;
    if (session.dirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close this editor session?'
      );
      if (!confirmed) return;
    }
    editorState.closeSession(session.id);
  }
</script>

{#if session}
  <div class="editor-toolbar" role="toolbar" aria-label="Editor actions">
    <div class="toolbar-info">
      <span class="toolbar-reference" title={session.reference}>
        {session.reference}
      </span>
      <span class="toolbar-type">({session.type})</span>
    </div>
    <div class="toolbar-actions">
      <Button variant="primary" onclick={handleSend} ariaLabel="Send changes to server">
        Send
      </Button>
      <Button variant="secondary" onclick={handleClose} ariaLabel="Close editor session">
        Close
      </Button>
    </div>
  </div>
{/if}

<style>
  .editor-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-top: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    gap: 8px;
  }

  .toolbar-info {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    min-width: 0;
  }

  .toolbar-reference {
    color: var(--text-secondary);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toolbar-type {
    color: var(--text-muted);
    font-size: 11px;
    white-space: nowrap;
  }

  .toolbar-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
</style>
