<script lang="ts">
  import { editorState } from '../../lib/state/editor.svelte';
  import { uiState } from '../../lib/state/ui.svelte';
  import { preferencesState } from '../../lib/state/preferences.svelte';
  import { sendEditSet } from '../../lib/services/mcp-packages/simpleedit';
  import { focusTrap } from '../../actions/focus-trap';
  import EditorToolbar from './EditorToolbar.svelte';
  import type { EditContentType } from '../../lib/types/editor';

  type Monaco = typeof import('monaco-editor');
  type IStandaloneCodeEditor = import('monaco-editor').editor.IStandaloneCodeEditor;

  let containerEl: HTMLDivElement | undefined = $state();
  let monaco: Monaco | null = $state(null);
  let editor: IStandaloneCodeEditor | null = $state(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  /** Map edit content type to a Monaco language identifier. */
  function getLanguage(type: EditContentType): string {
    if (type === 'moo-code') return 'javascript';
    return 'plaintext';
  }

  /** Map app theme to Monaco theme. */
  function getMonacoTheme(): string {
    switch (preferencesState.theme) {
      case 'light': return 'vs';
      case 'high-contrast': return 'hc-black';
      default: return 'vs-dark';
    }
  }

  /** Track which session the editor model is currently showing. */
  let currentModelSessionId: string | null = null;

  /**
   * Lazily load Monaco and set up the worker environment,
   * then create the editor instance.
   */
  $effect(() => {
    if (!containerEl) return;

    let destroyed = false;

    async function initMonaco() {
      try {
        // Set up the Monaco web worker environment
        await import('../../lib/monaco-env');
        const monacoModule = await import('monaco-editor');

        if (destroyed) return;
        monaco = monacoModule;

        const session = editorState.activeSession;
        const language = session ? getLanguage(session.type) : 'plaintext';
        const content = session?.content ?? '';

        const ed = monacoModule.editor.create(containerEl!, {
          value: content,
          language,
          theme: getMonacoTheme(),
          minimap: { enabled: false },
          accessibilitySupport: 'on',
          ariaLabel: session ? `Editor: ${session.name}` : 'Editor',
          fontSize: preferencesState.editor.fontSize,
          tabSize: preferencesState.editor.tabSize,
          wordWrap: preferencesState.editor.wordWrap ? 'on' : 'off',
          automaticLayout: true,
          scrollBeyondLastLine: false,
        });

        if (destroyed) {
          ed.dispose();
          return;
        }

        editor = ed;
        currentModelSessionId = session?.id ?? null;
        loading = false;

        // Listen for content changes
        ed.onDidChangeModelContent(() => {
          const activeId = editorState.activeSessionId;
          if (activeId) {
            editorState.updateContent(activeId, ed.getValue());
          }
        });

        // Save action: send content to server
        ed.addAction({
          id: 'chatmud.send',
          label: 'Send Changes to Server',
          keybindings: [monacoModule.KeyMod.CtrlCmd | monacoModule.KeyCode.KeyS],
          run: () => {
            const s = editorState.activeSession;
            if (s) {
              sendEditSet(s.reference, s.type, s.content);
              editorState.closeSession(s.id);
            }
          },
        });

        // Revert action: restore original content
        ed.addAction({
          id: 'chatmud.revert',
          label: 'Revert to Original',
          keybindings: [
            monacoModule.KeyMod.CtrlCmd | monacoModule.KeyMod.Shift | monacoModule.KeyCode.KeyZ,
          ],
          run: () => {
            const s = editorState.activeSession;
            if (s) {
              ed.setValue(s.originalContent);
              editorState.updateContent(s.id, s.originalContent);
            }
          },
        });
      } catch (err) {
        if (!destroyed) {
          loadError = err instanceof Error ? err.message : 'Failed to load editor';
          loading = false;
        }
      }
    }

    initMonaco();

    return () => {
      destroyed = true;
      if (editor) {
        editor.dispose();
        editor = null;
      }
      monaco = null;
      loading = true;
      loadError = null;
      currentModelSessionId = null;
    };
  });

  /**
   * Sync editor model when active session changes.
   */
  $effect(() => {
    if (!editor || !monaco) return;

    const session = editorState.activeSession;
    const sessionId = session?.id ?? null;

    // Only update the model if we switched to a different session
    if (sessionId === currentModelSessionId) return;
    currentModelSessionId = sessionId;

    if (session) {
      const language = getLanguage(session.type);
      const model = editor.getModel();

      if (model) {
        monaco.editor.setModelLanguage(model, language);
        // Prevent firing the change handler during model swap
        editor.setValue(session.content);
      }

      editor.updateOptions({
        ariaLabel: `Editor: ${session.name}`,
      });
    }
  });

  /**
   * Sync Monaco theme when app theme changes.
   */
  $effect(() => {
    const theme = preferencesState.theme;
    if (editor && monaco) {
      monaco.editor.setTheme(getMonacoTheme());
    }
  });

  /**
   * Close editor panel when no sessions remain.
   */
  $effect(() => {
    if (!editorState.hasOpenSessions) {
      uiState.editorOpen = false;
    }
  });

  let isOpen = $derived(uiState.editorOpen && editorState.hasOpenSessions);

  function handleClose() {
    uiState.editorOpen = false;
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="editor-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Editor"
    tabindex="-1"
    use:focusTrap
  >
    <aside class="editor-panel">
      <div class="editor-body">
        {#if loading}
          <div class="editor-loading" role="status">
            <span>Loading editor...</span>
          </div>
        {/if}
        {#if loadError}
          <div class="editor-error" role="alert">
            <span>Editor failed to load: {loadError}</span>
          </div>
        {/if}
        <div
          class="editor-container"
          class:hidden={loading || !!loadError}
          bind:this={containerEl}
        ></div>
      </div>
      <EditorToolbar />
    </aside>
  </div>
{/if}

<style>
  .editor-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    justify-content: flex-end;
    background-color: rgba(0, 0, 0, 0.5);
    animation: backdrop-fade-in var(--transition-speed, 150ms) ease-out;
  }

  .editor-panel {
    display: flex;
    flex-direction: column;
    background-color: var(--bg-secondary);
    border-left: 1px solid var(--border-color);
    width: min(50vw, 700px);
    min-width: 300px;
    overflow: hidden;
    height: 100%;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
    animation: slide-in-right var(--transition-speed, 150ms) ease-out;
  }

  .editor-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .editor-container {
    flex: 1;
    min-height: 0;
  }

  .editor-container.hidden {
    visibility: hidden;
    position: absolute;
    inset: 0;
  }

  .editor-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text-muted);
    font-size: 13px;
  }

  .editor-error {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--error, #e06c75);
    font-size: 13px;
    padding: 16px;
    text-align: center;
  }

  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  @keyframes backdrop-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .editor-panel,
    .editor-backdrop {
      animation: none;
    }
  }
</style>
