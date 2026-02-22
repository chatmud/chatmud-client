import type { OutputLine, AnsiState } from '../types/output';
import { DEFAULT_MAX_OUTPUT_LINES } from '../constants';
import { ttsEngine } from '../services/tts-engine';
import { ttsState } from './tts.svelte';
// Lazy import to avoid circular dependency — channel-history imports outputState
let _channelHistoryState: typeof import('./channel-history.svelte').channelHistoryState | null = null;
function getChannelHistory() {
  if (!_channelHistoryState) {
    // Dynamic import resolved synchronously after first load
    import('./channel-history.svelte').then((m) => {
      _channelHistoryState = m.channelHistoryState;
    });
  }
  return _channelHistoryState;
}

const STORAGE_KEY = 'chatmud-output';
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

  constructor() {
    this.loadFromStorage();
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
    // Collect plain text for screen reader announcements and TTS
    // Skip during buffer replay to avoid flooding
    const ch = getChannelHistory();
    if (!ttsState.suppressed) {
      for (const line of newLines) {
        const text = line.spans.map((s) => s.text).join('');
        if (text.length > 0) {
          this.pendingAnnouncementText = [...this.pendingAnnouncementText, text];
          ttsEngine.speakLine(text);
          ch?.addMessage(text);
        }
      }
    } else if (ch) {
      for (const line of newLines) {
        const text = line.spans.map((s) => s.text).join('');
        if (text.length > 0) {
          ch.addMessage(text);
        }
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

  addHtmlLine(html: string, caption?: string): void {
    const text = caption || html.replace(/<[^>]*>/g, '');
    const line: OutputLine = {
      id: this.nextLineId++,
      spans: [],
      timestamp: Date.now(),
      html,
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

  /** Push a message to the screen reader live region without adding an output line. */
  announce(text: string): void {
    this.pendingAnnouncementText = [...this.pendingAnnouncementText, text];
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
      const stored = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lines));
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
