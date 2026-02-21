<script lang="ts">
  import { connectionState } from '../../lib/state/connection.svelte';
  import { statusState } from '../../lib/state/status.svelte';
  import { mediaState } from '../../lib/state/media.svelte';

  let statusLabel = $derived(() => {
    switch (connectionState.status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return `Reconnecting (${connectionState.reconnectAttempt})...`;
      case 'disconnected': return 'Disconnected';
      default: return connectionState.status;
    }
  });

  let statusClass = $derived(() => {
    switch (connectionState.status) {
      case 'connected': return 'status-connected';
      case 'connecting':
      case 'reconnecting': return 'status-connecting';
      case 'disconnected': return 'status-disconnected';
      default: return '';
    }
  });

  let latencyDisplay = $derived(
    statusState.pingLatency !== null ? `${statusState.pingLatency}ms` : null
  );

  let mediaCount = $derived(mediaState.activeMedia.length);
</script>

<footer class="status-bar" aria-label="Status bar">
  <div class="status-left">
    <span class="status-indicator {statusClass()}">
      <span class="status-dot" aria-hidden="true"></span>
      <span class="status-label">{statusLabel()}</span>
    </span>

    {#if statusState.statusText}
      <span class="status-divider" aria-hidden="true"></span>
      <span class="status-text">{statusState.statusText}</span>
    {/if}
  </div>

  <div class="status-right">
    {#if mediaCount > 0}
      <span class="status-media" aria-label="{mediaCount} active media">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M6 13c0 1.105-1.12 2-2.5 2S1 14.105 1 13c0-1.104 1.12-2 2.5-2s2.5.896 2.5 2zm9-2c0 1.105-1.12 2-2.5 2s-2.5-.895-2.5-2 1.12-2 2.5-2 2.5.895 2.5 2z"/><path fill-rule="evenodd" d="M14 11V2h1v9h-1zM6 3v10H5V3h1z"/><path d="M5 2.905a1 1 0 01.9-.995l8-.8a1 1 0 011.1.995V3L6 4V2.905z"/></svg>
        {mediaCount}
      </span>
    {/if}
    {#if latencyDisplay !== null}
      <span class="status-latency" aria-label="Ping: {latencyDisplay}">
        {latencyDisplay}
      </span>
    {/if}
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--statusbar-height);
    padding: 0 12px;
    background-color: var(--brand-dark);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.8);
    flex-shrink: 0;
    user-select: none;
  }

  .status-left {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }

  .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  .status-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-connected .status-dot {
    background-color: #3fb950;
    box-shadow: 0 0 4px rgba(63, 185, 80, 0.5);
  }

  .status-connecting .status-dot {
    background-color: #d29922;
    animation: pulse 1.5s infinite;
  }

  .status-disconnected .status-dot {
    background-color: #f85149;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .status-label {
    font-weight: 500;
  }

  .status-divider {
    width: 1px;
    height: 12px;
    background-color: rgba(255, 255, 255, 0.2);
  }

  .status-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.7;
  }

  .status-latency {
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }

  .status-media {
    display: flex;
    align-items: center;
    gap: 3px;
    opacity: 0.7;
  }
</style>
