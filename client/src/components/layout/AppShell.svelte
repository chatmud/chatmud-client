<script lang="ts">
  import { uiState } from '../../lib/state/ui.svelte';
  import { connectionState } from '../../lib/state/connection.svelte';
  import { outputState } from '../../lib/state/output.svelte';
  import { mediaState } from '../../lib/state/media.svelte';
  import Sidebar from './Sidebar.svelte';
  import MainPanel from './MainPanel.svelte';
  import EditorPanel from '../editor/EditorPanel.svelte';
  import StatusBar from './StatusBar.svelte';
  import CommandInput from '../input/CommandInput.svelte';
  import PreferencesDialog from '../preferences/PreferencesDialog.svelte';
  import { mediaService } from '../../lib/services/media-service';
  import { ttsEngine } from '../../lib/services/tts-engine';
  import SoundSettings from '../preferences/SoundSettings.svelte';

  let showSidebar = $derived(uiState.sidebarOpen);
  let volumeOpen = $state(false);
  let volumeAnchor: HTMLElement | undefined = $state();

  let isMobile = $state(window.matchMedia('(max-width: 600px)').matches);

  $effect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const handler = (e: MediaQueryListEvent) => { isMobile = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  let gridColumns = $derived(() => {
    const cols: string[] = [];
    if (showSidebar && !isMobile) cols.push('var(--sidebar-width)');
    cols.push('1fr');
    return cols.join(' ');
  });

  function handleConnect() {
    // Import and call wsService dynamically to avoid circular imports
    import('../../lib/services/websocket').then(({ wsService }) => {
      wsService.connect(connectionState.sessionId ?? undefined);
    });
  }

  function handleDisconnect() {
    import('../../lib/services/websocket').then(({ wsService }) => {
      wsService.disconnect();
    });
  }

  function handleClear() {
    outputState.clear();
    outputState.announce('Output cleared');
  }

  function toggleMute() {
    mediaState.muted = !mediaState.muted;
    mediaService.updateVolumes();
  }

  function toggleVolume() {
    volumeOpen = !volumeOpen;
  }

  function handleVolumeClickOutside(e: MouseEvent) {
    if (volumeOpen && volumeAnchor && !volumeAnchor.contains(e.target as Node)) {
      volumeOpen = false;
    }
  }

  function toggleConnectDisconnect() {
    if (connectionState.status === 'disconnected') {
      handleConnect();
    } else {
      handleDisconnect();
    }
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    const alt = e.altKey && !e.ctrlKey && !e.metaKey;
    const cmd = e.metaKey && !e.ctrlKey && !e.altKey;

    // Alt-only shortcuts (Cmd+V/M conflict with paste/minimize)
    if (alt && !e.shiftKey) {
      switch (e.key) {
        case 'v':
          e.preventDefault();
          toggleVolume();
          return;
        case 'm':
          e.preventDefault();
          toggleMute();
          return;
      }
    }

    // Alt or Cmd shortcuts
    if ((alt || cmd) && !e.shiftKey) {
      switch (e.key) {
        case 'k':
          e.preventDefault();
          toggleConnectDisconnect();
          return;
      }
    }

    // Alt-only (Cmd+, conflicts with browser settings)
    if (alt && !e.shiftKey && e.key === ',') {
      e.preventDefault();
      uiState.togglePreferences();
      return;
    }

    // Alt+? or Cmd+? (requires shift for ?)
    if ((alt || cmd) && e.key === '?') {
      e.preventDefault();
      uiState.openPreferencesTo('shortcuts');
      return;
    }

    if (e.key === 'Escape') {
      if (volumeOpen) {
        volumeOpen = false;
        return;
      }
      if (!uiState.preferencesOpen && !uiState.editorOpen) {
        mediaService.handleStop({});
        ttsEngine.cancel();
      }
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} onclick={handleVolumeClickOutside} />

<!-- Toolbar -->
<header class="toolbar">
  <div class="toolbar-left">
    <svg class="toolbar-logo" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12" stroke="var(--brand-light)" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M22 12c0 5.52-4.48 10-10 10" stroke="var(--brand-light)" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M12 5.5A6.5 6.5 0 0118.5 12" stroke="var(--brand-dark)" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M5.5 12A6.5 6.5 0 0112 18.5" stroke="var(--brand-dark)" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="2.5" fill="var(--brand-mid)"/>
    </svg>
    <span class="toolbar-title">
      <span class="title-chat">CHAT</span><span class="title-mud">MUD</span>
    </span>
  </div>

  <div class="toolbar-center">
    {#if connectionState.isConnected}
      <button class="toolbar-btn" onclick={() => uiState.toggleSidebar()} aria-label="Toggle sidebar" title="Toggle sidebar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3h14v1.5H1V3zm0 4h14v1.5H1V7zm0 4h10v1.5H1V11z"/></svg>
      </button>
    {/if}
  </div>

  <div class="toolbar-right">
    {#if connectionState.status !== 'disconnected'}
      {#if outputState.lines.length > 0}
        <button class="toolbar-btn" onclick={handleClear} aria-label="Clear output" title="Clear output">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
        </button>
      {/if}
      <div class="volume-wrapper" bind:this={volumeAnchor}>
        <button class="toolbar-btn" onclick={toggleVolume} aria-label="Volume" title="Volume" aria-expanded={volumeOpen}>
          {#if mediaState.muted}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6.717 3.55A.5.5 0 017 4v8a.5.5 0 01-.812.39L3.825 10.5H1.5A.5.5 0 011 10V6a.5.5 0 01.5-.5h2.325l2.363-1.89a.5.5 0 01.529-.06zM6 5.04L4.312 6.39A.5.5 0 014 6.5H2v3h2a.5.5 0 01.312.11L6 10.96V5.04z"/><path d="M10.707 8l1.647-1.646a.5.5 0 00-.708-.708L10 7.293 8.354 5.646a.5.5 0 10-.708.708L9.293 8l-1.647 1.646a.5.5 0 00.708.708L10 8.707l1.646 1.647a.5.5 0 00.708-.708L10.707 8z"/></svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.536 14.01A8.47 8.47 0 0014.026 8a8.47 8.47 0 00-2.49-6.01l-.708.707A7.48 7.48 0 0113.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/><path d="M10.121 12.596A6.48 6.48 0 0012.025 8a6.48 6.48 0 00-1.904-4.596l-.707.707A5.48 5.48 0 0111.025 8a5.48 5.48 0 01-1.61 3.89l.706.706z"/><path d="M8.707 11.182A4.49 4.49 0 0010.025 8a4.49 4.49 0 00-1.318-3.182l-.708.708A3.49 3.49 0 019.025 8 3.49 3.49 0 018 10.475l.707.707zM6.717 3.55A.5.5 0 017 4v8a.5.5 0 01-.812.39L3.825 10.5H1.5A.5.5 0 011 10V6a.5.5 0 01.5-.5h2.325l2.363-1.89a.5.5 0 01.529-.06z"/></svg>
          {/if}
        </button>
        {#if volumeOpen}
          <div class="volume-dropdown" role="dialog" aria-label="Volume controls">
            <div class="volume-mute-row">
              <button class="volume-mute-btn" onclick={toggleMute}>
                {mediaState.muted ? 'Unmute' : 'Mute'}
              </button>
            </div>
            <SoundSettings />
          </div>
        {/if}
      </div>
    {/if}
    <button class="toolbar-btn" onclick={() => uiState.togglePreferences()} aria-label="Preferences" title="Preferences">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 001.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 003.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.115l.094-.319z"/></svg>
    </button>
    {#if connectionState.status === 'disconnected'}
      <button class="toolbar-action connect" onclick={handleConnect}>
        Connect
      </button>
    {:else}
      <button class="toolbar-action disconnect" onclick={handleDisconnect}>
        Disconnect
      </button>
    {/if}
  </div>
</header>

<!-- Main content area -->
<div
  class="app-content"
  style:grid-template-columns={gridColumns()}
>
  {#if showSidebar}
    <div class="grid-sidebar">
      <Sidebar />
    </div>
  {/if}

  <div class="grid-main">
    <MainPanel />
  </div>
</div>

<!-- Bottom bar: input + status -->
<div class="bottom-bar">
  <CommandInput />
  <StatusBar />
</div>

<EditorPanel />
<PreferencesDialog />

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--toolbar-height);
    padding: 0 12px;
    background-color: var(--toolbar-bg);
    border-bottom: 1px solid var(--toolbar-border);
    flex-shrink: 0;
    gap: 12px;
    user-select: none;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .toolbar-logo {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .toolbar-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .title-chat {
    color: var(--brand-dark);
  }

  .title-mud {
    color: var(--brand-light);
  }

  .toolbar-center {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background-color var(--transition-speed), color var(--transition-speed);
  }

  .toolbar-btn:hover {
    background-color: var(--accent-muted);
    color: var(--text-primary);
  }

  .volume-wrapper {
    position: relative;
  }

  .volume-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background-color: var(--bg-elevated);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 50;
  }

  .volume-mute-row {
    padding: 6px 12px 0;
  }

  .volume-mute-btn {
    width: 100%;
    padding: 4px 8px;
    background: none;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: var(--font-family);
    font-size: 12px;
    cursor: pointer;
    transition: background-color var(--transition-speed), color var(--transition-speed);
  }

  .volume-mute-btn:hover {
    background-color: var(--accent-muted);
    color: var(--text-primary);
  }

  .toolbar-action {
    padding: 4px 14px;
    border: none;
    border-radius: var(--radius-md);
    font-family: var(--font-family);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color var(--transition-speed);
  }

  .toolbar-action.connect {
    background-color: var(--brand-mid);
    color: #ffffff;
  }

  .toolbar-action.connect:hover {
    background-color: var(--brand-light);
    color: #0d1117;
  }

  .toolbar-action.disconnect {
    background-color: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
  }

  .toolbar-action.disconnect:hover {
    background-color: var(--error);
    color: #ffffff;
    border-color: transparent;
  }

  .app-content {
    display: grid;
    grid-template-rows: 1fr;
    flex: 1;
    overflow: hidden;
    min-height: 0;
    position: relative;
  }

  .grid-sidebar {
    grid-row: 1;
    overflow: hidden;
    border-right: 1px solid var(--border-color);
  }

  .grid-main {
    grid-row: 1;
    overflow: hidden;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 600px) {
    .grid-sidebar {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: var(--sidebar-width);
      z-index: 20;
      background-color: var(--bg-secondary);
      box-shadow: 2px 0 12px rgba(0, 0, 0, 0.4);
    }
  }

  .bottom-bar {
    flex-shrink: 0;
    border-top: 1px solid var(--border-color);
  }

  /* Make the overall app a flex column */
  :global(#app) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>
