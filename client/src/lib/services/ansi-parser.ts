/**
 * Parses ANSI SGR escape sequences into styled spans.
 *
 * Maintains persistent state across lines so that styles carry over
 * (as they do in a real terminal). Supports standard colors (0-7),
 * bright colors (8-15 / 90-97 / 100-107), 256-color palette (38;5;n / 48;5;n),
 * and truecolor (38;2;r;g;b / 48;2;r;g;b).
 */

import type { AnsiState, OutputSpan } from '../types/output';

/** ANSI color names indexed 0-7 */
const ANSI_COLOR_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
] as const;

/**
 * Return a fresh default ANSI state with no styles applied.
 */
export function defaultAnsiState(): AnsiState {
  return {
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    blink: false,
    inverse: false,
    hidden: false,
    strikethrough: false,
    fg: null,
    bg: null,
  };
}

export class AnsiParser {
  private state: AnsiState;

  constructor() {
    this.state = defaultAnsiState();
  }

  /**
   * Reset the parser state to defaults.
   */
  reset(): void {
    this.state = defaultAnsiState();
  }

  /**
   * Parse a line of text that may contain ANSI escape sequences into OutputSpan[].
   * State persists across calls so colors carry over between lines.
   */
  parseLine(text: string): OutputSpan[] {
    const spans: OutputSpan[] = [];
    // Regex matches CSI sequences: ESC [ <params> m
    // Also matches incomplete/malformed sequences to skip them
    const ansiRegex = /\x1b\[([0-9;]*)m/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = ansiRegex.exec(text)) !== null) {
      // Emit text before this escape sequence
      if (match.index > lastIndex) {
        const segment = text.substring(lastIndex, match.index);
        if (segment.length > 0) {
          spans.push({ text: segment, style: { ...this.state } });
        }
      }

      // Parse and apply SGR parameters
      const paramStr = match[1];
      if (paramStr === '' || paramStr === '0') {
        // ESC[m or ESC[0m = reset
        this.state = defaultAnsiState();
      } else {
        const params = paramStr.split(';').map((s) => (s === '' ? 0 : parseInt(s, 10)));
        this.applySgr(params);
      }

      lastIndex = ansiRegex.lastIndex;
    }

    // Emit any remaining text after the last escape sequence
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex);
      if (remaining.length > 0) {
        spans.push({ text: remaining, style: { ...this.state } });
      }
    }

    // If no spans were generated (empty line), emit a single empty span
    if (spans.length === 0) {
      spans.push({ text: '', style: { ...this.state } });
    }

    return spans;
  }

  /**
   * Apply SGR (Select Graphic Rendition) parameters to the current state.
   */
  private applySgr(params: number[]): void {
    let i = 0;
    while (i < params.length) {
      const p = params[i];

      switch (p) {
        // Reset
        case 0:
          this.state = defaultAnsiState();
          break;

        // Style attributes on
        case 1:
          this.state.bold = true;
          break;
        case 2:
          this.state.dim = true;
          break;
        case 3:
          this.state.italic = true;
          break;
        case 4:
          this.state.underline = true;
          break;
        case 5:
          this.state.blink = true;
          break;
        case 7:
          this.state.inverse = true;
          break;
        case 8:
          this.state.hidden = true;
          break;
        case 9:
          this.state.strikethrough = true;
          break;

        // Style attributes off
        case 22:
          this.state.bold = false;
          this.state.dim = false;
          break;
        case 23:
          this.state.italic = false;
          break;
        case 24:
          this.state.underline = false;
          break;
        case 25:
          this.state.blink = false;
          break;
        case 27:
          this.state.inverse = false;
          break;
        case 28:
          this.state.hidden = false;
          break;
        case 29:
          this.state.strikethrough = false;
          break;

        // Standard foreground colors (30-37)
        case 30:
        case 31:
        case 32:
        case 33:
        case 34:
        case 35:
        case 36:
        case 37:
          this.state.fg = this.colorToString(p - 30, false);
          break;

        // Extended foreground color
        case 38: {
          const result = this.parseExtendedColor(params, i);
          if (result.color !== null) {
            this.state.fg = result.color;
          }
          i = result.nextIndex;
          continue; // Skip the i++ at the end
        }

        // Default foreground
        case 39:
          this.state.fg = null;
          break;

        // Standard background colors (40-47)
        case 40:
        case 41:
        case 42:
        case 43:
        case 44:
        case 45:
        case 46:
        case 47:
          this.state.bg = this.colorToString(p - 40, false);
          break;

        // Extended background color
        case 48: {
          const result = this.parseExtendedColor(params, i);
          if (result.color !== null) {
            this.state.bg = result.color;
          }
          i = result.nextIndex;
          continue; // Skip the i++ at the end
        }

        // Default background
        case 49:
          this.state.bg = null;
          break;

        // Bright foreground colors (90-97)
        case 90:
        case 91:
        case 92:
        case 93:
        case 94:
        case 95:
        case 96:
        case 97:
          this.state.fg = this.colorToString(p - 90, true);
          break;

        // Bright background colors (100-107)
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
          this.state.bg = this.colorToString(p - 100, true);
          break;

        default:
          // Unknown SGR parameter, ignore
          break;
      }

      i++;
    }
  }

  /**
   * Parse an extended color sequence (38;5;n or 38;2;r;g;b) starting at
   * the position of the 38/48 parameter.
   *
   * Returns the parsed color string and the next index to continue from.
   */
  private parseExtendedColor(
    params: number[],
    index: number,
  ): { color: string | null; nextIndex: number } {
    if (index + 1 >= params.length) {
      return { color: null, nextIndex: index + 1 };
    }

    const mode = params[index + 1];

    if (mode === 5) {
      // 256-color: 38;5;n
      if (index + 2 >= params.length) {
        return { color: null, nextIndex: Math.min(index + 3, params.length) };
      }
      const n = params[index + 2];
      return { color: this.color256ToString(n), nextIndex: index + 3 };
    }

    if (mode === 2) {
      // Truecolor: 38;2;r;g;b
      if (index + 4 >= params.length) {
        return { color: null, nextIndex: Math.min(index + 5, params.length) };
      }
      const r = params[index + 2];
      const g = params[index + 3];
      const b = params[index + 4];
      return { color: `rgb(${r},${g},${b})`, nextIndex: index + 5 };
    }

    return { color: null, nextIndex: index + 2 };
  }

  /**
   * Map an ANSI color code (0-7) to a CSS custom property reference.
   * If bright, uses --ansi-bright-* vars; otherwise --ansi-*.
   */
  private colorToString(code: number, bright: boolean): string {
    const name = ANSI_COLOR_NAMES[code];
    if (bright) {
      return `var(--ansi-bright-${name})`;
    }
    return `var(--ansi-${name})`;
  }

  /**
   * Convert a 256-color palette index to a CSS color string.
   *
   * 0-7:     Standard ANSI colors (use CSS vars)
   * 8-15:    Bright ANSI colors (use CSS vars)
   * 16-231:  6x6x6 RGB color cube
   * 232-255: Grayscale ramp
   */
  private color256ToString(n: number): string {
    if (n < 0 || n > 255) {
      return `var(--ansi-white)`;
    }

    // Standard colors
    if (n < 8) {
      return this.colorToString(n, false);
    }

    // Bright colors
    if (n < 16) {
      return this.colorToString(n - 8, true);
    }

    // 6x6x6 RGB cube (indices 16-231)
    if (n < 232) {
      const index = n - 16;
      const r = Math.floor(index / 36);
      const g = Math.floor((index % 36) / 6);
      const b = index % 6;
      // Each component: 0 maps to 0, 1-5 map to 55 + 40*value
      const toChannel = (v: number) => (v === 0 ? 0 : 55 + 40 * v);
      return `rgb(${toChannel(r)},${toChannel(g)},${toChannel(b)})`;
    }

    // Grayscale ramp (indices 232-255)
    // 232 = rgb(8,8,8), 255 = rgb(238,238,238), step of 10
    const gray = 8 + (n - 232) * 10;
    return `rgb(${gray},${gray},${gray})`;
  }
}
