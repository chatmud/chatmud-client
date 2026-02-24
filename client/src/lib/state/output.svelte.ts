import type { OutputLine, AnsiState } from '../types/output';
import { DEFAULT_MAX_OUTPUT_LINES, STORAGE_KEYS } from '../constants';
import { ttsEngine } from '../services/tts-engine';
import { ttsState } from './tts.svelte';
const SAVE_DEBOUNCE_MS = 500;

const defaultAnsiState: AnsiState = {
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

class OutputState {
  lines = $state<OutputLine[]>([]);
  maxLines = $state(DEFAULT_MAX_OUTPUT_LINES);
  scrollLocked = $state(true); // true = auto-scroll to bottom
  pendingAnnouncementText = $state<string[]>([]);

  private nextLineId = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private onNewMessage: ((text: string) => void) | null = null;
  private onAssertive: ((text: string) => void) | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /** Register a callback invoked for each non-empty text line added to output. */
  registerMessageCallback(callback: (text: string) => void): void {
    this.onNewMessage = callback;
  }

  addLines(newLines: OutputLine[]): void {
    // Re-ID incoming lines to avoid collisions with restored lines
    for (const line of newLines) {
      line.id = this.nextLineId++;
    }
    this.lines = [...this.lines, ...newLines];
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }
    // Collect plain text for screen reader announcements, TTS, and channel history
    for (const line of newLines) {
      const text = line.spans.map((s) => s.text).join('');
      if (text.length > 0) {
        if (!ttsState.suppressed) {
          this.pendingAnnouncementText = [...this.pendingAnnouncementText, text];
          ttsEngine.speakLine(text);
        }
        this.onNewMessage?.(text);
      }
    }
    this.debouncedSave();
  }

  addSystemLine(text: string): void {
    const line: OutputLine = {
      id: this.nextLineId++,
      spans: [
        {
          text: `#${text}`,
          style: { ...defaultAnsiState, dim: true, italic: true },
        },
      ],
      timestamp: Date.now(),
      isSystem: true,
    };
    this.lines = [...this.lines, line];
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }
    if (!ttsState.suppressed) {
      this.pendingAnnouncementText = [...this.pendingAnnouncementText, text];
      ttsEngine.speakLine(text);
    }
    this.debouncedSave();
  }

  addHtmlLine(html: string, caption?: string, contentId?: string): void {
    let text: string;
    if (caption) {
      text = caption;
    } else {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      text = tmp.textContent || '';
    }
    const line: OutputLine = {
      id: this.nextLineId++,
      spans: [],
      timestamp: Date.now(),
      html,
      contentId,
    };
    this.lines = [...this.lines, line];
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }
    if (!ttsState.suppressed) {
      this.pendingAnnouncementText = [...this.pendingAnnouncementText, text];
      ttsEngine.speakLine(text);
    }
    this.onNewMessage?.(text);
    this.debouncedSave();
  }

  /** Push a message to the screen reader live region without adding an output line.
   *  Uses assertive priority so it interrupts current speech immediately. */
  announce(text: string): void {
    this.onAssertive?.(text);
  }

  registerAssertiveCallback(callback: ((text: string) => void) | null): void {
    this.onAssertive = callback;
  }

  consumeAnnouncements(): string[] {
    const texts = this.pendingAnnouncementText;
    this.pendingAnnouncementText = [];
    return texts;
  }

  clear(): void {
    this.lines = [];
    this.pendingAnnouncementText = [];
    this.save();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OUTPUT);
      if (stored) {
        const parsed: OutputLine[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.lines = parsed;
          // Set nextLineId above any restored IDs
          let maxId = 0;
          for (const line of parsed) {
            if (line.id >= maxId) maxId = line.id + 1;
          }
          this.nextLineId = maxId;
        }
      }
    } catch {
      // Corrupted storage — start fresh
    }
  }

  private save(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.OUTPUT, JSON.stringify(this.lines));
    } catch {
      // Quota exceeded — ignore
    }
  }

  private debouncedSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, SAVE_DEBOUNCE_MS);
  }
}

export const outputState = new OutputState();
