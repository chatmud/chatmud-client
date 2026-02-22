# Client.Render

## Status

This memo describes a custom GMCP package for sending rich HTML and Markdown content from the server to the client for inline rendering within the output scrollback.

## Rationale

MUD output is traditionally limited to plain text styled with ANSI escape codes. While ANSI covers basic formatting (colors, bold, underline), it cannot express structured content such as headings, tables, definition lists, images, or hyperlinks. `Client.Render` allows the server to send semantically rich content that the client renders inline alongside normal MUD output.

## Protocol

`Client.Render` operates within the Generic Mud Communication Protocol (GMCP) telnet sub-negotiation (option 201). The client announces support by including `Client.Render 1` in its `Core.Supports.Set` list.

## Namespace

```
Client.Render
```

**Direction:** Server to Client

## Specification

### Client.Render

The server sends a `Client.Render` message containing rich content for the client to display inline in the output scrollback.

The client MUST sanitize all HTML before rendering to prevent cross-site scripting (XSS) attacks. Script tags, event handler attributes, and other dangerous content MUST be stripped.

#### Syntax

```json
Client.Render {
  "html": "<h2>Help: Movement</h2><p>Use <code>north</code>, <code>south</code>, <code>east</code>, or <code>west</code> to move.</p>"
}
```

```json
Client.Render {
  "markdown": "## Help: Movement\n\nUse `north`, `south`, `east`, or `west` to move.\n\n| Command | Direction |\n|---|---|\n| `n` | North |\n| `s` | South |"
}
```

#### Message Fields

| Required | Key | Value | Default | Description |
|----------|-----|-------|---------|-------------|
| Maybe | `html` | string | | An HTML fragment to render inline in the output. At least one of `html` or `markdown` MUST be present. If both are provided, `html` takes precedence. |
| Maybe | `markdown` | string | | A Markdown string to be parsed into HTML and rendered inline. Supports GitHub Flavored Markdown (tables, strikethrough, fenced code blocks). Used when `html` is not present. |
| No | `caption` | string | | A plain-text alternative for screen readers and text-to-speech engines. If omitted, the client derives a caption automatically from the rendered HTML's text content. |
| No | `id` | string | | A server-assigned identifier for this content. Reserved for future use -- will allow the server to remove or replace previously rendered content by ID. |

#### Allowed HTML Elements

Clients SHOULD support at minimum the following HTML elements when rendering `Client.Render` content:

- Headings: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- Block content: `p`, `br`, `hr`, `blockquote`, `pre`, `div`
- Lists: `ul`, `ol`, `li`, `dl`, `dt`, `dd`
- Tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`
- Inline content: `strong`, `em`, `del`, `code`, `span`, `a`, `img`

#### Allowed HTML Attributes

- `href` (on `a` elements)
- `src`, `alt` (on `img` elements)
- `class`, `title` (on any element)
- `colspan`, `rowspan` (on `th` and `td` elements)

Links SHOULD be forced to open in a new tab (`target="_blank"`) with `rel="noopener noreferrer"` for security.

#### Security Considerations

The client MUST sanitize all HTML content before rendering. The following MUST be stripped:

- `<script>` tags and their contents
- Event handler attributes (`onclick`, `onerror`, `onload`, etc.)
- `javascript:` URLs
- `<iframe>`, `<object>`, `<embed>`, and `<form>` elements
- `<style>` tags (to prevent CSS injection)

The recommended approach is to use a whitelist-based sanitizer such as [DOMPurify](https://github.com/cure53/DOMPurify) that only permits explicitly allowed tags and attributes.

#### Accessibility

When a `caption` is provided, the client SHOULD use it for screen reader announcements and text-to-speech output. If `caption` is absent, the client derives an announcement automatically by extracting text content from the rendered HTML via the DOM (`textContent`). Explicit captions are only needed when the plain-text extraction would produce a poor result (e.g., complex tables where reading order matters).

## Examples

### Help Page

```json
Client.Render {
  "html": "<h2>Help: Combat</h2><p>Attack a target with <code>kill &lt;target&gt;</code>.</p><h3>Commands</h3><dl><dt><code>kill &lt;target&gt;</code></dt><dd>Initiate combat with the target.</dd><dt><code>flee</code></dt><dd>Attempt to escape from combat.</dd></dl>"
}
```

### Table via Markdown

```json
Client.Render {
  "markdown": "## Skills\n\n| Skill | Level | Progress |\n|---|---|---|\n| Swordsmanship | 5 | 73% |\n| Archery | 3 | 41% |\n| Stealth | 7 | 12% |",
  "caption": "Skills: Swordsmanship level 5, 73 percent. Archery level 3, 41 percent. Stealth level 7, 12 percent."
}
```

### Formatted Room Description

```json
Client.Render {
  "html": "<h3>The Grand Hall</h3><p>Towering marble columns line the vast hall, their surfaces etched with <em>ancient runes</em> that pulse with a faint blue light. A <a href='https://example.com/map#grand-hall'>map</a> of the kingdom hangs on the eastern wall.</p>",
  "id": "room-desc"
}
```

## Version History

| Version | Changes |
|---------|---------|
| 1 | Initial specification. HTML and Markdown rendering with caption support. |

## Implementation Notes

### Server

Servers SHOULD prefer sending `markdown` when the content can be expressed in Markdown, as it is more portable across clients. Use `html` when fine-grained control over structure is needed (e.g., definition lists, complex table layouts, or custom classes).

The `caption` field is optional. The client automatically extracts plain text from the rendered HTML for screen readers and TTS. Only provide `caption` when the auto-derived text would be confusing (e.g., complex tables, content where reading order matters).

The `id` field is reserved for future use. Servers that plan to later remove or replace rendered content SHOULD include a stable identifier now. A future version of this spec will define `Client.Render.Remove` and `Client.Render.Replace` messages that reference this ID.

### Client (ChatMUD-Web)

The ChatMUD-Web client implements `Client.Render` as follows:

- HTML sanitization: [DOMPurify](https://github.com/cure53/DOMPurify) with a strict whitelist of allowed tags and attributes
- Markdown parsing: [marked](https://github.com/markedjs/marked) with GitHub Flavored Markdown support
- Link handling: all links forced to `target="_blank"` with `rel="noopener noreferrer"` via DOMPurify hooks
- Rendering: sanitized HTML is injected via Svelte's `{@html}` directive inside a styled wrapper
- Accessibility: `caption` (or `textContent` fallback) announced via the screen reader live region and TTS engine

## Authors

ChatMUD Development Team
