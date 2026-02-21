<script lang="ts">
  import { userlistState } from '../../lib/state/userlist.svelte';
  import UserListEntry from './UserListEntry.svelte';

  let selectedIndex = $state(-1);

  const users = $derived(userlistState.sortedUsers);

  /**
   * Resolve the icon name for a user from the icons array.
   * user.icon is a numeric index into userlistState.icons.
   */
  function iconNameFor(iconIndex: number): string {
    return userlistState.icons[iconIndex] ?? '';
  }

  /**
   * Clamp selectedIndex when the user list changes so it never
   * points past the end of the array.
   */
  $effect(() => {
    if (users.length === 0) {
      selectedIndex = -1;
    } else if (selectedIndex >= users.length) {
      selectedIndex = users.length - 1;
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if (users.length === 0) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (selectedIndex < users.length - 1) {
          selectedIndex++;
        } else {
          selectedIndex = 0;
        }
        scrollSelectedIntoView();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (selectedIndex > 0) {
          selectedIndex--;
        } else {
          selectedIndex = users.length - 1;
        }
        scrollSelectedIntoView();
        break;
      }
      case 'Home': {
        event.preventDefault();
        selectedIndex = 0;
        scrollSelectedIntoView();
        break;
      }
      case 'End': {
        event.preventDefault();
        selectedIndex = users.length - 1;
        scrollSelectedIntoView();
        break;
      }
    }
  }

  function scrollSelectedIntoView() {
    // Defer to next tick so the DOM has updated
    requestAnimationFrame(() => {
      const selected = users[selectedIndex];
      if (!selected) return;
      const el = document.getElementById(`user-entry-${selected.objectNumber}`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  }

  function handleEntryClick(index: number) {
    selectedIndex = index;
  }
</script>

<div
  id="user-list"
  class="user-list"
  role="listbox"
  aria-label="Connected users"
  tabindex="0"
  aria-activedescendant={selectedIndex >= 0 && users[selectedIndex]
    ? `user-entry-${users[selectedIndex].objectNumber}`
    : undefined}
  onkeydown={handleKeydown}
>
  {#if users.length > 0}
    {#each users as user, i (user.objectNumber)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div onclick={() => handleEntryClick(i)}>
        <UserListEntry
          {user}
          selected={selectedIndex === i}
          iconName={iconNameFor(user.icon)}
        />
      </div>
    {/each}
  {:else}
    <div class="user-list-empty" role="status">
      No users online
    </div>
  {/if}
</div>

<style>
  .user-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
    overflow-y: auto;
    flex: 1;
  }

  .user-list:focus-visible {
    outline: none;
  }

  .user-list:focus-visible :global(.user-entry-selected) {
    outline-width: var(--focus-ring-width);
    outline-color: var(--focus-ring);
  }

  .user-list-empty {
    padding: 12px;
    color: var(--text-muted);
    text-align: center;
    font-size: 12px;
  }
</style>
