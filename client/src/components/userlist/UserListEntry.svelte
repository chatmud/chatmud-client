<script lang="ts">
  import type { UserlistEntry } from '../../lib/types/userlist';
  import { userlistState } from '../../lib/state/userlist.svelte';

  let {
    user,
    selected = false,
    iconName = '',
    onclick,
  } = $props<{
    user: UserlistEntry;
    selected: boolean;
    iconName: string;
    onclick?: () => void;
  }>();

  const isFriend = $derived(userlistState.friends.includes(user.objectNumber));
  const isYou = $derived(userlistState.you === user.objectNumber);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  class="user-entry"
  class:user-entry-selected={selected}
  class:user-entry-idle={user.idle}
  class:user-entry-away={user.away}
  class:user-entry-invisible={user.invisible}
  role="option"
  aria-selected={selected}
  id="user-entry-{user.objectNumber}"
  data-object-number={user.objectNumber}
  {onclick}
>
  {#if iconName}
    <span class="user-icon" aria-label="Icon: {iconName}" title={iconName}>
      {iconName}
    </span>
  {/if}

  <span class="user-name">
    {user.name}
    {#if isYou}
      <span class="user-you-label">(you)</span>
    {/if}
  </span>

  <span class="user-badges">
    {#if isFriend}
      <span class="user-badge user-badge-friend" aria-label="Friend">friend</span>
    {/if}
    {#if user.idle}
      <span class="user-badge user-badge-idle" aria-label="Idle">idle</span>
    {/if}
    {#if user.away}
      <span class="user-badge user-badge-away" aria-label="Away">away</span>
    {/if}
    {#if user.invisible}
      <span class="user-badge user-badge-invisible" aria-label="Invisible">invisible</span>
    {/if}
  </span>
</div>

<style>
  .user-entry {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: default;
    transition: background-color var(--transition-speed);
  }

  .user-entry:hover {
    background-color: var(--bg-tertiary);
  }

  .user-entry-selected {
    background-color: var(--bg-tertiary);
    outline: 1px solid var(--focus-ring);
    outline-offset: -1px;
  }

  .user-entry-idle {
    color: var(--text-muted);
  }

  .user-entry-away {
    color: var(--text-muted);
    font-style: italic;
  }

  .user-entry-invisible {
    color: var(--text-muted);
    opacity: 0.7;
  }

  .user-icon {
    flex-shrink: 0;
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 3px;
    background-color: var(--bg-input);
    color: var(--text-secondary);
    max-width: 48px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .user-you-label {
    font-size: 11px;
    color: var(--text-secondary);
    font-style: italic;
  }

  .user-badges {
    display: flex;
    flex-shrink: 0;
    gap: 3px;
    align-items: center;
  }

  .user-badge {
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 3px;
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .user-badge-friend {
    background-color: var(--accent);
    color: #ffffff;
  }

  .user-badge-idle {
    background-color: var(--bg-tertiary);
    color: var(--text-muted);
  }

  .user-badge-away {
    background-color: var(--bg-tertiary);
    color: var(--text-muted);
    font-style: italic;
  }

  .user-badge-invisible {
    background-color: var(--bg-tertiary);
    color: var(--text-muted);
    opacity: 0.8;
  }
</style>
