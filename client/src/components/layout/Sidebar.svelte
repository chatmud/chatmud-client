<script lang="ts">
  import { userlistState } from '../../lib/state/userlist.svelte';
  import { gmcpState } from '../../lib/state/gmcp.svelte';
  import UserList from '../userlist/UserList.svelte';
</script>

<nav class="sidebar" aria-label="Sidebar">
  {#if gmcpState.roomInfo?.name}
    <div class="sidebar-section">
      <div class="section-header">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="section-icon"><path d="M8.707 1.5a1 1 0 00-1.414 0L.646 8.146a.5.5 0 00.708.708L2 8.207V13.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V8.207l.646.647a.5.5 0 00.708-.708L8.707 1.5z"/></svg>
        <span class="section-label">Room</span>
      </div>
      <div class="room-info">
        <div class="room-name">{gmcpState.roomInfo.name}</div>
        {#if gmcpState.roomInfo.area}
          <div class="room-area">{gmcpState.roomInfo.area}</div>
        {/if}
        {#if gmcpState.roomInfo.exits}
          <div class="room-exits">
            {#each Object.keys(gmcpState.roomInfo.exits) as exit}
              <span class="exit-badge">{exit}</span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="sidebar-section sidebar-section-grow">
    <div class="section-header">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="section-icon"><path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8zm-7.978-1A.261.261 0 017 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 01-.014.002H7.022zM11 7a2 2 0 100-4 2 2 0 000 4zm3-2a3 3 0 11-6 0 3 3 0 016 0zM6.936 9.28a5.88 5.88 0 00-1.23-.247A7.35 7.35 0 005 9c-4 0-5 3-5 4 0 .667.333 1 1 1h4.216A2.238 2.238 0 015 13c0-.455.135-.993.42-1.558.31-.615.792-1.204 1.516-1.643z"/><path d="M4.5 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/></svg>
      <span class="section-label">Users</span>
      <span class="badge">{userlistState.onlineCount}</span>
    </div>
    <UserList />
  </div>
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-secondary);
    overflow: hidden;
  }

  .sidebar-section {
    padding: 0;
  }

  .sidebar-section-grow {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-color);
    user-select: none;
  }

  .section-icon {
    opacity: 0.6;
    flex-shrink: 0;
  }

  .section-label {
    flex: 1;
  }

  .badge {
    padding: 0 6px;
    font-size: 10px;
    font-weight: 600;
    background-color: var(--accent-muted);
    color: var(--accent);
    border-radius: 10px;
    line-height: 18px;
  }

  .room-info {
    padding: 8px 14px 10px;
    border-bottom: 1px solid var(--border-color);
  }

  .room-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .room-area {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .room-exits {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .exit-badge {
    padding: 1px 8px;
    background-color: var(--accent-muted);
    color: var(--accent);
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 500;
  }
</style>
