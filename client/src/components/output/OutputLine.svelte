<script lang="ts">
  import type { OutputLine } from '../../lib/types/output';

  let { line, focused = false, index = 0 } = $props<{ line: OutputLine; focused?: boolean; index?: number }>();

  const URL_RE = /https?:\/\/[^\s<>"'\`)}\]]+/g;

  /**
   * Split text into alternating plain-text and URL segments.
   */
  function splitUrls(text: string): { text: string; url?: string }[] {
    const segments: { text: string; url?: string }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    URL_RE.lastIndex = 0;
    while ((match = URL_RE.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: text.slice(lastIndex, match.index) });
      }
      segments.push({ text: match[0], url: match[0] });
      lastIndex = URL_RE.lastIndex;
    }
    if (lastIndex < text.length) {
      segments.push({ text: text.slice(lastIndex) });
    }
    return segments.length ? segments : [{ text }];
  }

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

<div class="output-line" class:system-line={line.isSystem} class:focused-line={focused} class:rendered-html={!!line.html} data-line-id={line.id} data-line-index={index}>
  {#if line.html}
    {@html line.html}
  {:else}
    {#each line.spans as span, i (i)}
      {@const style = spanStyle(span.style)}
      {#each splitUrls(span.text) as seg}
        {#if seg.url}
          <a href={seg.url} target="_blank" rel="noopener noreferrer" {style}>{seg.text}</a>
        {:else if style}
          <span {style}>{seg.text}</span>
        {:else}
          <span>{seg.text}</span>
        {/if}
      {/each}
    {/each}
    {#if line.spans.length === 0}
      <span>&nbsp;</span>
    {/if}
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

  .output-line a {
    color: var(--link-color, #6cb4ee);
    text-decoration: underline;
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

  .rendered-html {
    white-space: normal;
  }

  .rendered-html :global(h1),
  .rendered-html :global(h2),
  .rendered-html :global(h3),
  .rendered-html :global(h4),
  .rendered-html :global(h5),
  .rendered-html :global(h6) {
    margin: 0.4em 0 0.2em;
    font-weight: bold;
    color: var(--text-primary);
  }

  .rendered-html :global(h1) { font-size: 1.4em; }
  .rendered-html :global(h2) { font-size: 1.2em; }
  .rendered-html :global(h3) { font-size: 1.1em; }

  .rendered-html :global(p) {
    margin: 0.3em 0;
  }

  .rendered-html :global(a) {
    color: var(--link-color, #6cb4ee);
    text-decoration: underline;
  }

  .rendered-html :global(code) {
    background: rgba(255, 255, 255, 0.08);
    padding: 0.1em 0.3em;
    border-radius: 3px;
    font-family: inherit;
  }

  .rendered-html :global(pre) {
    background: rgba(255, 255, 255, 0.06);
    padding: 0.5em;
    border-radius: 4px;
    overflow-x: auto;
    white-space: pre-wrap;
    margin: 0.3em 0;
  }

  .rendered-html :global(pre code) {
    background: none;
    padding: 0;
  }

  .rendered-html :global(blockquote) {
    border-left: 3px solid var(--text-muted, #888);
    margin: 0.3em 0;
    padding: 0.2em 0.6em;
    opacity: 0.85;
  }

  .rendered-html :global(table) {
    border-collapse: collapse;
    margin: 0.3em 0;
  }

  .rendered-html :global(th),
  .rendered-html :global(td) {
    border: 1px solid var(--text-muted, #555);
    padding: 0.2em 0.5em;
    text-align: left;
  }

  .rendered-html :global(th) {
    font-weight: bold;
  }

  .rendered-html :global(ul),
  .rendered-html :global(ol) {
    margin: 0.3em 0;
    padding-left: 1.5em;
  }

  .rendered-html :global(li) {
    margin: 0.1em 0;
  }

  .rendered-html :global(hr) {
    border: none;
    border-top: 1px solid var(--text-muted, #555);
    margin: 0.4em 0;
  }

  .rendered-html :global(img) {
    max-width: 100%;
    height: auto;
  }

  .rendered-html :global(dl) {
    margin: 0.3em 0;
  }

  .rendered-html :global(dt) {
    font-weight: bold;
  }

  .rendered-html :global(dd) {
    margin-left: 1.5em;
  }
</style>
