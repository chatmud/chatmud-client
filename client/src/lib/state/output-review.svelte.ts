/**
 * Output Review Buffer.
 *
 * Provides keyboard-driven output line navigation, line-get with multi-press
 * (read / copy / paste), and multi-line selection.
 */

import { outputState } from './output.svelte';
import { preferencesState } from './preferences.svelte';
import { ttsEngine } from '../services/tts-engine';

const LINEGET_TIMEOUT_MS = 400;
const SELECTION_TIMEOUT_MS = 300_000; // 5 minutes

/** Extract digit 0-9 from a key event, using e.code as fallback */
function getDigitFromEvent(e: KeyboardEvent): number | null {
  const match = e.code.match(/^Digit(\d)$/);
  if (match) return parseInt(match[1]);
  const fromKey = parseInt(e.key);
  if (!isNaN(fromKey) && fromKey >= 0 && fromKey <= 9) return fromKey;
  return null;
}

class OutputReviewState {
  /** Current review cursor position (0-based index into outputState.lines) */
  cline = $state(0);
  /** Whether multi-line selection mode is active */
  selecting = $state(false);

  private lastcount = 0;
  private selectStartLine = 0;
  private selectTime = 0;
  private modes: Record<number, { time: number; count: number }> = {};
  private cleanupKeyboard: (() => void) | null = null;

  // --- Helpers ---

  /** Extract plain text from an output line by index */
  getLineText(index: number): string {
    const line = outputState.lines[index];
    if (!line) return '';
    if (line.html) {
      const tmp = document.createElement('div');
      tmp.innerHTML = line.html;
      return tmp.textContent || '';
    }
    return line.spans.map((s) => s.text).join('');
  }

  /**
   * Skip over blank lines starting from `ln` in direction `dir`.
   * Skip over blank lines in the given direction.
   */
  private skipBlankLines(ln: number, dir: 'f' | 'b'): number {
    const count = outputState.lines.length;
    if (count === 0) return 0;

    if (ln < 0) return this.skipBlankLines(0, 'f');
    if (ln >= count) return this.skipBlankLines(count - 1, 'b');

    let i = ln;
    while (i >= 0 && i < count && this.getLineText(i) === '') {
      i += dir === 'b' ? -1 : 1;
    }

    if (i < 0 || i >= count) {
      if (this.getLineText(ln) !== '') return ln;
      return dir === 'b' ? this.skipBlankLines(0, 'f') : this.skipBlankLines(count - 1, 'b');
    }
    return i;
  }

  /** Adjust cursor positions when the output buffer has been trimmed. */
  private bufferCheck(): void {
    const curcount = outputState.lines.length;
    if (curcount < this.lastcount) {
      const trimmed = this.lastcount - curcount;
      this.cline = Math.max(0, this.cline - trimmed);
      if (this.selecting) {
        this.selectStartLine = Math.max(0, this.selectStartLine - trimmed);
      }
    }
    this.lastcount = curcount;
  }

  // --- Navigation commands ---

  prevLine(): void {
    this.bufferCheck();
    const oline = this.cline;
    this.cline = this.skipBlankLines(this.cline - 1, 'b');
    const text = this.getLineText(this.cline);
    ttsEngine.cancel();
    if (this.cline === oline) {
      outputState.announce('boundary');
    }
    outputState.announce(text);
  }

  nextLine(): void {
    this.bufferCheck();
    const oline = this.cline;
    this.cline = this.skipBlankLines(this.cline + 1, 'f');
    const text = this.getLineText(this.cline);
    ttsEngine.cancel();
    if (this.cline === oline) {
      outputState.announce('boundary');
    }
    outputState.announce(text);
  }

  curLine(): void {
    this.bufferCheck();
    const text = this.getLineText(this.cline);
    ttsEngine.cancel();
    outputState.announce(text);
  }

  topLine(): void {
    this.cline = this.skipBlankLines(0, 'f');
    const text = this.getLineText(this.cline);
    ttsEngine.cancel();
    outputState.announce('top: ' + text);
  }

  endLine(): void {
    const count = outputState.lines.length;
    if (count === 0) return;
    this.cline = this.skipBlankLines(count - 1, 'b');
    const text = this.getLineText(this.cline);
    ttsEngine.cancel();
    outputState.announce('Bottom: ' + text);
  }

  whichLine(): void {
    this.bufferCheck();
    ttsEngine.cancel();
    outputState.announce(`line ${this.cline + 1} of ${outputState.lines.length}`);
  }

  // --- LineGet: read / copy / paste line N from end of buffer ---

  lineGet(n: number): void {
    const count = outputState.lines.length;
    const index = count - n;
    if (index < 0) {
      outputState.announce('boundary');
      return;
    }
    const text = this.getLineText(index);

    const now = performance.now();
    const mode = this.modes[n];
    let pressCount: number;
    if (!mode || now - mode.time >= LINEGET_TIMEOUT_MS) {
      pressCount = 1;
    } else {
      pressCount = mode.count + 1;
    }
    this.modes[n] = { time: now, count: pressCount };

    ttsEngine.cancel();

    if (pressCount >= 3) {
      // Triple press: paste into command input
      const inputEl = document.getElementById('command-input') as
        | HTMLTextAreaElement
        | HTMLInputElement
        | null;
      if (inputEl) {
        inputEl.value = text;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.focus();
      }
      outputState.announce('pasted.');
    } else if (pressCount === 2) {
      // Double press: copy to clipboard
      navigator.clipboard.writeText(text).then(() => {
        outputState.announce('copied.');
      });
    } else {
      // Single press: read line
      outputState.announce(text);
    }
  }

  // --- Selection mode ---

  selectLines(eol: string): void {
    this.bufferCheck();
    const now = Date.now();

    if (!this.selecting || (this.selectTime > 0 && now - this.selectTime > SELECTION_TIMEOUT_MS)) {
      // Start selection
      this.selecting = true;
      this.selectTime = now;
      this.selectStartLine = this.cline;
      ttsEngine.cancel();
      outputState.announce('start of selection.');
    } else {
      // End selection: copy lines from start to current
      const start = Math.min(this.selectStartLine, this.cline);
      const end = Math.max(this.selectStartLine, this.cline);
      const lines: string[] = [];
      for (let i = start; i <= end; i++) {
        lines.push(this.getLineText(i));
      }
      const text = lines.join(eol);
      ttsEngine.cancel();
      navigator.clipboard.writeText(text).then(() => {
        if (eol === ' ') {
          outputState.announce('Copied selection without line breaks.');
        } else {
          outputState.announce('Copied selection');
        }
      });
      this.selecting = false;
    }
  }

  // --- Clear buffer ---

  clearBuffer(): void {
    outputState.clear();
    this.cline = 0;
    this.lastcount = 0;
    this.selecting = false;
    outputState.announce('output buffer cleared');
  }

  // --- Keyboard handler ---

  setupKeyboardHandler(): () => void {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift (no Alt, no Meta): output line navigation
      if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
        switch (e.code) {
          case 'KeyU':
            e.preventDefault();
            this.prevLine();
            return;
          case 'KeyO':
            e.preventDefault();
            this.nextLine();
            return;
          case 'KeyI':
            e.preventDefault();
            this.curLine();
            return;
          case 'KeyY':
            e.preventDefault();
            this.topLine();
            return;
          case 'KeyN':
            e.preventDefault();
            this.endLine();
            return;
          case 'KeyH':
            e.preventDefault();
            this.whichLine();
            return;
          case 'KeyC':
            e.preventDefault();
            this.clearBuffer();
            return;
          case 'Space':
            e.preventDefault();
            this.selectLines('\n');
            return;
        }
      }

      // Ctrl+Shift+Alt (no Meta): select-with-spaces
      if (e.ctrlKey && e.shiftKey && e.altKey && !e.metaKey) {
        switch (e.code) {
          case 'Space':
            e.preventDefault();
            this.selectLines(' ');
            return;
        }
      }

      // Ctrl+Alt+O (no Shift, no Meta): toggle ARIA live regions
      if (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && e.code === 'KeyO') {
        e.preventDefault();
        const next = !preferencesState.accessibility.ariaLiveRegions;
        preferencesState.updateAccessibility({ ariaLiveRegions: next });
        outputState.announce(next ? 'ARIA live regions on' : 'ARIA live regions off');
        return;
      }

      // Ctrl+digit (no Shift, no Alt, no Meta): LineGet
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const digit = getDigitFromEvent(e);
        if (digit !== null) {
          e.preventDefault();
          const n = digit === 0 ? 10 : digit;
          this.lineGet(n);
          return;
        }
      }
    };

    document.addEventListener('keydown', handler, true);
    this.cleanupKeyboard = () => document.removeEventListener('keydown', handler, true);
    return this.cleanupKeyboard;
  }
}

export const outputReviewState = new OutputReviewState();
