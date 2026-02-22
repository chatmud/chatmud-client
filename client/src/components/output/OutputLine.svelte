<script lang="ts">
  import type { OutputLine } from '../../lib/types/output';

  let { line, focused = false, index = 0 } = $props<{ line: OutputLine; focused?: boolean; index?: number }>();

  /**
   * Convert an AnsiState into a CSS style string.
   */
  function spanStyle(style: OutputLine['spans'][number]['style']): string {
    const parts: string[] = [];

    if (style.bold) parts.push('font-weight:bold');
    if (style.dim) parts.push('opacity:0.7');
    if (style.italic) parts.push('font-style:italic');
    if (style.underline) parts.push('text-decoration:underline');
    if (style.strikethrough) {
      // Combine with underline if both present
      if (style.underline) {
        parts[parts.length - 1] = 'text-decoration:underline line-through';
      } else {
        parts.push('text-decoration:line-through');
      }
    }
    if (style.hidden) parts.push('visibility:hidden');

    if (style.inverse) {
      // Swap foreground and background
      const fg = style.bg || 'var(--bg-primary)';
      const bg = style.fg || 'var(--text-primary)';
      parts.push(`color:${fg}`);
      parts.push(`background-color:${bg}`);
    } else {
      if (style.fg) parts.push(`color:${style.fg}`);
      if (style.bg) parts.push(`background-color:${style.bg}`);
    }

    return parts.join(';');
  }
</script>

<div class="output-line" class:system-line={line.isSystem} class:focused-line={focused} data-line-id={line.id} data-line-index={index}>
  {#each line.spans as span, i (i)}
    {@const style = spanStyle(span.style)}
    {#if style}
      <span {style}>{span.text}</span>
    {:else}
      <span>{span.text}</span>
    {/if}
  {/each}
  {#if line.spans.length === 0}
    <span>&nbsp;</span>
  {/if}
</div>

<style>
  .output-line {
    white-space: pre-wrap;
    word-wrap: break-word;
    min-height: 1em;
    transition: background-color 0.1s ease;
    scroll-margin: 20px;
  }

  .system-line {
    color: var(--text-muted);
    font-style: italic;
  }

  .focused-line {
    background-color: rgba(66, 135, 245, 0.15);
    outline: 1px solid rgba(66, 135, 245, 0.3);
    outline-offset: -1px;
  }
</style>
