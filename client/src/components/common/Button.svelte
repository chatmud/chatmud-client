<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    onclick,
    variant = 'primary',
    disabled = false,
    ariaLabel,
    children,
  } = $props<{
    onclick?: (event: MouseEvent) => void;
    variant?: 'primary' | 'secondary' | 'ghost';
    disabled?: boolean;
    ariaLabel?: string;
    children: Snippet;
  }>();
</script>

<button
  class="btn btn-{variant}"
  {disabled}
  aria-label={ariaLabel}
  {onclick}
>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 12px;
    border: 1px solid transparent;
    border-radius: 4px;
    font-family: var(--font-family);
    font-size: var(--font-size);
    line-height: var(--line-height);
    cursor: pointer;
    transition: background-color var(--transition-speed),
      border-color var(--transition-speed),
      color var(--transition-speed);
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: var(--accent);
    color: #ffffff;
    border-color: var(--accent);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  .btn-secondary {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    border-color: var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--bg-input);
  }

  .btn-ghost {
    background-color: transparent;
    color: var(--text-primary);
    border-color: transparent;
  }

  .btn-ghost:hover:not(:disabled) {
    background-color: var(--bg-tertiary);
  }
</style>
