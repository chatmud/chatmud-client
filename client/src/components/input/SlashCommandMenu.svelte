<script lang="ts">
  import { slashCommandState } from '../../lib/state/slash-commands.svelte';
  import type { SlashCommand } from '../../lib/commands/registry';

  interface Props {
    onselect: (cmd: SlashCommand) => void;
  }

  let { onselect }: Props = $props();

  function handleClick(cmd: SlashCommand) {
    onselect(cmd);
  }

  function queryPart(name: string): string {
    return name.slice(0, slashCommandState.query.length);
  }

  function restPart(name: string): string {
    return name.slice(slashCommandState.query.length);
  }
</script>

<div
  class="slash-menu"
  id="slash-command-menu"
  role="listbox"
  aria-label="Slash commands"
>
  {#each slashCommandState.suggestions as cmd, i}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="slash-item"
      class:selected={i === slashCommandState.selectedIndex}
      role="option"
      id="slash-opt-{cmd.name}"
      aria-selected={i === slashCommandState.selectedIndex}
      tabindex="-1"
      onclick={() => handleClick(cmd)}
    >
      <span class="cmd-name">
        <span class="cmd-slash">/</span><span class="cmd-match">{queryPart(cmd.name)}</span><span class="cmd-rest">{restPart(cmd.name)}</span>
      </span>
      <span class="cmd-desc">{cmd.description}</span>
      {#if cmd.args}
        <span class="cmd-args">{cmd.args}</span>
      {/if}
    </div>
  {/each}
  <div class="slash-footer" aria-hidden="true">
    ↑↓ navigate · Tab accept · Esc dismiss
  </div>
</div>

<style>
  .slash-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.35);
    max-height: 280px;
    overflow-y: auto;
    z-index: 100;
    margin-bottom: 4px;
    animation: slide-up 120ms ease-out;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .slash-menu {
      animation: none;
    }
  }

  .slash-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    border-left: 2px solid transparent;
    transition: background 80ms;
  }

  .slash-item:hover {
    background: var(--accent-muted);
  }

  .slash-item.selected {
    background: var(--accent-muted);
    border-left-color: var(--accent);
  }

  .cmd-name {
    font-family: var(--font-family);
    font-size: var(--font-size);
    flex-shrink: 0;
  }

  .cmd-slash {
    color: var(--accent);
    font-weight: 700;
  }

  .cmd-match {
    color: var(--text-primary);
    font-weight: 700;
  }

  .cmd-rest {
    color: var(--text-secondary);
  }

  .cmd-desc {
    color: var(--text-muted);
    font-size: 0.875em;
    flex: 1;
  }

  .cmd-args {
    color: var(--text-muted);
    font-style: italic;
    font-size: 0.875em;
    margin-left: auto;
    flex-shrink: 0;
  }

  .slash-footer {
    padding: 5px 12px;
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    border-top: 1px solid var(--border-subtle);
  }
</style>
