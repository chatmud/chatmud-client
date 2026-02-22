<script lang="ts">
  import { CLIENT_VERSION, GIT_COMMIT } from '../../lib/constants';

  let proxyVersion = $state('...');
  let proxyCommit = $state('...');

  async function fetchProxyInfo(): Promise<void> {
    try {
      const res = await fetch('/stats');
      if (res.ok) {
        const data = await res.json();
        proxyVersion = data.version ?? 'unknown';
        proxyCommit = data.commit ?? 'unknown';
      } else {
        proxyVersion = 'unavailable';
        proxyCommit = 'unavailable';
      }
    } catch {
      proxyVersion = 'unavailable';
      proxyCommit = 'unavailable';
    }
  }

  fetchProxyInfo();
</script>

<fieldset class="settings-section">
  <legend class="settings-legend">About</legend>

  <div class="info-row">
    <span class="info-label">Client version</span>
    <span class="info-value">{CLIENT_VERSION}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Proxy version</span>
    <span class="info-value">{proxyVersion}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Commit</span>
    <span class="info-value mono">{GIT_COMMIT}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Proxy commit</span>
    <span class="info-value mono">{proxyCommit}</span>
  </div>
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
  }

  .info-value {
    color: var(--text-primary);
    font-size: 13px;
  }

  .info-value.mono {
    font-family: monospace;
    font-size: 12px;
  }
</style>
