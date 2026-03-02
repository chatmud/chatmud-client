import { STORAGE_KEYS } from '../constants';
const HISTORY_KEY = STORAGE_KEYS.COMMAND_HISTORY;
const MAX_HISTORY = 10000;

function loadHistory(): string[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore corrupt data
  }
  return [];
}

function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore storage errors
  }
}

class InputState {
  currentInput = $state('');
  history = $state<string[]>(loadHistory());
  historyIndex = $state(-1);
  echoMode = $state(true); // false = password mode
  autosayMode = $state(false);

  private savedInput = '';

  /** Scan history for an entry matching `prefix`, returning its index or -1. */
  private findMatch(prefix: string, from: number, step: 1 | -1): number {
    for (let i = from; i >= 0 && i < this.history.length; i += step) {
      if (this.history[i].startsWith(prefix)) return i;
    }
    return -1;
  }

  addToHistory(command: string): void {
    if (command.trim() && (this.history.length === 0 || this.history[this.history.length - 1] !== command)) {
      this.history = [...this.history, command];
      if (this.history.length > MAX_HISTORY) {
        this.history = this.history.slice(-MAX_HISTORY);
      }
      saveHistory(this.history);
    }
    this.historyIndex = -1;
    this.savedInput = '';
  }

  navigateHistory(direction: 'up' | 'down'): string {
    if (this.history.length === 0) return this.currentInput;

    if (direction === 'up') {
      if (this.historyIndex === -1) {
        this.savedInput = this.currentInput;
        const start = this.history.length - 1;
        if (this.savedInput) {
          const idx = this.findMatch(this.savedInput, start, -1);
          if (idx === -1) return this.currentInput;
          this.historyIndex = idx;
          return this.history[idx];
        }
        this.historyIndex = start;
      } else if (this.historyIndex > 0) {
        if (this.savedInput) {
          const idx = this.findMatch(this.savedInput, this.historyIndex - 1, -1);
          if (idx === -1) return this.history[this.historyIndex];
          this.historyIndex = idx;
          return this.history[idx];
        }
        this.historyIndex--;
      }
      return this.history[this.historyIndex];
    } else {
      if (this.historyIndex === -1) return this.currentInput;
      if (this.savedInput) {
        const idx = this.findMatch(this.savedInput, this.historyIndex + 1, 1);
        if (idx === -1) {
          this.historyIndex = -1;
          return this.savedInput;
        }
        this.historyIndex = idx;
        return this.history[idx];
      }
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        return this.history[this.historyIndex];
      } else {
        this.historyIndex = -1;
        return this.savedInput;
      }
    }
  }
}

export const inputState = new InputState();
