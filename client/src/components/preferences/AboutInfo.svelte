<script lang="ts">
  import { CLIENT_VERSION, GIT_COMMIT } from '../../lib/constants';

  let proxyLoading = $state(true);
  let proxyVersion = $state('');
  let proxyCommit = $state('');
  let proxyError = $state(false);

  async function fetchProxyInfo(): Promise<void> {
    try {
      const res = await fetch('/stats');
      if (res.ok) {
        const data = await res.json();
        proxyVersion = data.version ?? 'unknown';
        proxyCommit = data.commit ?? 'unknown';
      } else {
        proxyError = true;
      }
    } catch {
      proxyError = true;
    } finally {
      proxyLoading = false;
    }
  }

  fetchProxyInfo();
</script>

<fieldset class="settings-section">
  <legend class="settings-legend">About</legend>

  <dl class="info-list">
    <div class="info-row">
      <dt class="info-label">Client version</dt>
      <dd class="info-value">{CLIENT_VERSION}</dd>
    </div>
    <div class="info-row">
      <dt class="info-label">Client commit</dt>
      <dd class="info-value mono">{GIT_COMMIT}</dd>
    </div>
    <div class="info-row">
      <dt class="info-label">Proxy version</dt>
      <dd class="info-value">
        {#if proxyLoading}
          <span class="loading-text">Loading&hellip;</span>
        {:else if proxyError}
          unavailable
        {:else}
          {proxyVersion}
        {/if}
      </dd>
    </div>
    <div class="info-row">
      <dt class="info-label">Proxy commit</dt>
      <dd class="info-value mono">
        {#if proxyLoading}
          <span class="loading-text">Loading&hellip;</span>
        {:else if proxyError}
          unavailable
        {:else}
          {proxyCommit}
        {/if}
      </dd>
    </div>
  </dl>
</fieldset>

<style>
  .settings-section {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 12px 16px;
    margin: 0;
  }

  .settings-legend {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 600;
    padding: 0 4px;
  }

  .info-list {
    margin: 0;
    padding: 0;
  }

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
  }

  .info-label {
    color: var(--text-secondary);
    font-size: 13px;
    margin: 0;
  }

  .info-value {
    color: var(--text-primary);
    font-size: 13px;
    margin: 0;
  }

  .info-value.mono {
    font-family: monospace;
    font-size: 12px;
  }

  .loading-text {
    color: var(--text-secondary);
  }
</style>
