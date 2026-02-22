import type { NavigationKeyScheme } from '../types/preferences';
import { preferencesState } from './preferences.svelte';
import { outputState } from './output.svelte';

// --- Types ---

export interface ChannelMessage {
  id: number;
  message: string;
  timestamp: number;
  channel?: string;
  talker?: string;
}

export interface ChannelBuffer {
  name: string;
  messages: ChannelMessage[];
  currentIndex: number;
}

// --- Navigation key maps ---

export const navigationKeyMaps: Record<
  NavigationKeyScheme,
  { up: string; down: string; left: string; right: string }
> = {
  jkli: { up: 'i', down: 'k', left: 'j', right: 'l' },
  wasd: { up: 'w', down: 's', left: 'a', right: 'd' },
  'dvorak-rh': { up: 'c', down: 't', left: 'h', right: 'n' },
  'dvorak-lh': { up: ',', down: 'o', left: 'a', right: 'e' },
};

/** Match a key event against a navigation key, using e.code as fallback for macOS Option+letter */
export function matchesNavKey(e: KeyboardEvent, navKey: string): boolean {
  if (e.key.toLowerCase() === navKey) return true;
  if (navKey === ',') return e.code === 'Comma';
  if (navKey.length === 1) return e.code === `Key${navKey.toUpperCase()}`;
  return false;
}

/** Extract digit 0-9 from a key event, using e.code as fallback for macOS Option+number */
export function getDigit(e: KeyboardEvent): number | null {
  const fromKey = parseInt(e.key);
  if (!isNaN(fromKey) && fromKey >= 0 && fromKey <= 9) return fromKey;
  const match = e.code.match(/^Digit(\d)$/);
  if (match) return parseInt(match[1]);
  return null;
}

// --- Constants ---

const STORAGE_KEY = 'channelHistory';
const MAX_MESSAGES_PER_BUFFER = 100000;

// --- State ---

class ChannelHistoryState {
  buffers = $state<Map<string, ChannelBuffer>>(
    new Map([['all', { name: 'all', messages: [], currentIndex: 0 }]])
  );
  bufferOrder = $state<string[]>(['all']);
  currentBufferIndex = $state(0);
  timestampsEnabled = $state(true);

  private messageIdCounter = 0;
  private lastKeyPress: { key: string; time: number; count: number } | null = null;
  private cleanupKeyboard: (() => void) | null = null;

  constructor() {
    this.loadFromStorage();
  }

  // --- Persistence ---

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const loadedBuffers = new Map<string, ChannelBuffer>(
          parsed.bufferOrder.map((name: string): [string, ChannelBuffer] => [
            name,
            parsed.buffers[name] || { name, messages: [], currentIndex: 0 },
          ])
        );
        this.buffers = loadedBuffers;
        this.bufferOrder = parsed.bufferOrder;
        this.currentBufferIndex = parsed.currentBufferIndex || 0;
        this.timestampsEnabled = parsed.timestampsEnabled ?? true;
      }
    } catch {
      // Corrupted storage — start fresh
    }
  }

  private saveToStorage(): void {
    try {
      const buffersObj: Record<string, ChannelBuffer> = {};
      this.buffers.forEach((buffer, name) => {
        buffersObj[name] = buffer;
      });
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          buffers: buffersObj,
          bufferOrder: this.bufferOrder,
          currentBufferIndex: this.currentBufferIndex,
          timestampsEnabled: this.timestampsEnabled,
        })
      );
    } catch {
      // Quota exceeded — ignore
    }
  }

  // --- Core methods ---

  private addMessageToBuffer(
    bufferName: string,
    message: string,
    channel?: string,
    talker?: string
  ): void {
    const newBuffers = new Map(this.buffers);
    const buffer = newBuffers.get(bufferName);
    if (!buffer) return;

    const newMessage: ChannelMessage = {
      id: this.messageIdCounter++,
      message,
      timestamp: Date.now(),
      channel,
      talker,
    };

    const updatedMessages = [...buffer.messages, newMessage];
    if (updatedMessages.length > MAX_MESSAGES_PER_BUFFER) {
      updatedMessages.shift();
      if (buffer.currentIndex > 0) {
        buffer.currentIndex--;
      }
    }

    newBuffers.set(bufferName, { ...buffer, messages: updatedMessages });
    this.buffers = newBuffers;
    this.saveToStorage();
  }

  addMessage(text: string): void {
    if (!text.trim()) return;
    this.addMessageToBuffer('all', text);
  }

  addChannelMessage(channel: string, talker: string, text: string): void {
    // Create channel buffer if it doesn't exist
    if (!this.buffers.has(channel)) {
      const newBuffers = new Map(this.buffers);
      newBuffers.set(channel, { name: channel, messages: [], currentIndex: 0 });
      this.buffers = newBuffers;
      this.bufferOrder = [...this.bufferOrder, channel];
    }
    this.addMessageToBuffer(channel, text, channel, talker);
  }

  private getCurrentBuffer(): ChannelBuffer | undefined {
    return this.buffers.get(this.bufferOrder[this.currentBufferIndex]);
  }

  changeBuffer(direction: number): void {
    const newIndex =
      (this.currentBufferIndex + direction + this.bufferOrder.length) % this.bufferOrder.length;
    this.currentBufferIndex = newIndex;

    const buffer = this.buffers.get(this.bufferOrder[newIndex]);
    if (buffer) {
      const messageCount = buffer.messages.length;
      const currentIdx = buffer.currentIndex;
      outputState.announce(
        `${buffer.name}: ${currentIdx > 0 ? currentIdx : messageCount > 0 ? messageCount : 0} of ${messageCount}`
      );
    }
    this.saveToStorage();
  }

  jumpToBuffer(bufferIndex: number): void {
    if (bufferIndex < 0 || bufferIndex >= this.bufferOrder.length) {
      outputState.announce("That buffer doesn't exist yet.");
      return;
    }
    this.currentBufferIndex = bufferIndex;
    const buffer = this.buffers.get(this.bufferOrder[bufferIndex]);
    if (buffer) {
      outputState.announce(
        `${buffer.name}: ${buffer.currentIndex || buffer.messages.length} of ${buffer.messages.length}`
      );
    }
    this.saveToStorage();
  }

  calculateRelativeTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 1) return 'just now';
    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      const remainingSeconds = seconds % 60;
      return `${minutes} minutes ${remainingSeconds > 0 ? remainingSeconds + ' seconds ' : ''}ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      const remainingMinutes = minutes % 60;
      return `${hours} hours ${remainingMinutes} minutes ago`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    return `${days} days, ${remainingHours} hours, and ${remainingMinutes} minutes ago`;
  }

  private announceMessage(message: ChannelMessage, prefix: string = ''): void {
    let announcement = prefix + message.message;

    if (this.timestampsEnabled) {
      const relativeTime = this.calculateRelativeTime(Date.now() - message.timestamp);
      const lastChar = message.message.slice(-1);
      if (/[a-zA-Z0-9]/.test(lastChar)) {
        announcement += '.';
      }
      announcement += ' ' + relativeTime;
    }

    outputState.announce(announcement);
  }

  readMessage(messageNumber: number, isFromAllBuffer: boolean = false): void {
    const bufferName = isFromAllBuffer ? 'all' : this.bufferOrder[this.currentBufferIndex];
    const buffer = this.buffers.get(bufferName);

    if (!buffer || buffer.messages.length === 0) {
      outputState.announce('No messages');
      return;
    }

    if (messageNumber > buffer.messages.length) {
      outputState.announce('No message');
      return;
    }

    const realIndex = buffer.messages.length - messageNumber;
    const message = buffer.messages[realIndex];

    if (!message) {
      outputState.announce('No message');
      return;
    }

    this.announceMessage(message);
  }

  navigateMessage(offset: number): void {
    const newBuffers = new Map(this.buffers);
    const currentBuffer = newBuffers.get(this.bufferOrder[this.currentBufferIndex]);

    if (!currentBuffer || currentBuffer.messages.length === 0) {
      outputState.announce('No messages');
      return;
    }

    let newIndex = currentBuffer.currentIndex + offset;
    let prefix = '';

    if (currentBuffer.currentIndex === 0) {
      newIndex = currentBuffer.messages.length;
    }

    if (newIndex < 1) {
      newIndex = 1;
      prefix = 'Top: ';
    } else if (newIndex > currentBuffer.messages.length) {
      newIndex = currentBuffer.messages.length;
      prefix = 'Bottom: ';
    }

    newBuffers.set(this.bufferOrder[this.currentBufferIndex], {
      ...currentBuffer,
      currentIndex: newIndex,
    });

    const message = currentBuffer.messages[newIndex - 1];
    if (message) {
      this.announceMessage(message, prefix);
    }

    this.buffers = newBuffers;
    this.saveToStorage();
  }

  copyCurrentMessage(): void {
    const buffer = this.getCurrentBuffer();
    if (!buffer || buffer.currentIndex === 0) {
      outputState.announce('No message selected');
      return;
    }

    const message = buffer.messages[buffer.currentIndex - 1];
    if (message) {
      navigator.clipboard.writeText(message.message).then(() => {
        outputState.announce('Copied');
      });
    }
  }

  toggleTimestamps(): void {
    this.timestampsEnabled = !this.timestampsEnabled;
    outputState.announce(
      this.timestampsEnabled
        ? 'You will now hear an approximate time after every message.'
        : 'Timestamps will no longer be spoken after messages.'
    );
    this.saveToStorage();
  }

  deleteCurrentBuffer(): void {
    const currentBufferName = this.bufferOrder[this.currentBufferIndex];

    if (currentBufferName === 'all') {
      outputState.announce('Cannot delete the all buffer');
      return;
    }

    if (this.bufferOrder.length === 1) {
      outputState.announce('Cannot delete the last buffer');
      return;
    }

    const newBuffers = new Map(this.buffers);
    newBuffers.delete(currentBufferName);
    this.buffers = newBuffers;

    const newOrder = this.bufferOrder.filter((name) => name !== currentBufferName);
    const newIndex = this.currentBufferIndex >= newOrder.length ? 0 : this.currentBufferIndex;
    this.bufferOrder = newOrder;
    this.currentBufferIndex = newIndex;

    const newBuffer = this.buffers.get(newOrder[newIndex]);
    if (newBuffer) {
      outputState.announce(newBuffer.name);
    }
    this.saveToStorage();
  }

  // --- Keyboard handler ---

  setupKeyboardHandler(): () => void {
    const handler = (e: KeyboardEvent) => {
      const now = Date.now();
      const key = `${e.altKey ? 'alt+' : ''}${e.ctrlKey ? 'ctrl+' : ''}${e.shiftKey ? 'shift+' : ''}${e.key}`;

      let pressCount = 1;
      if (this.lastKeyPress && this.lastKeyPress.key === key && now - this.lastKeyPress.time < 500) {
        pressCount = this.lastKeyPress.count + 1;
      }
      this.lastKeyPress = { key, time: now, count: pressCount };

      // Alt+Arrow keys: always work regardless of scheme
      if (e.key === 'ArrowLeft' && e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        this.changeBuffer(-1);
        return;
      }
      if (e.key === 'ArrowRight' && e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        this.changeBuffer(1);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateMessage(-1);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateMessage(1);
        return;
      }

      // Alt+letter: change buffers (using configured key scheme)
      const scheme = preferencesState.keyboard.navigationKeyScheme;
      const navKeys = navigationKeyMaps[scheme];

      if (matchesNavKey(e, navKeys.left) && e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        this.changeBuffer(-1);
        return;
      }
      if (matchesNavKey(e, navKeys.right) && e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        this.changeBuffer(1);
        return;
      }

      // Alt+1-0: Read from current buffer
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const digit = getDigit(e);
        if (digit !== null) {
          e.preventDefault();
          const messageNum = digit === 0 ? 10 : digit;
          if (pressCount >= 2) {
            // Double-press copies the message
            this.readMessage(messageNum, false);
            const buffer = this.getCurrentBuffer();
            if (buffer) {
              const realIndex = buffer.messages.length - messageNum;
              const message = buffer.messages[realIndex];
              if (message) {
                navigator.clipboard.writeText(message.message).then(() => {
                  outputState.announce('Copied');
                });
              }
            }
          } else {
            this.readMessage(messageNum, false);
          }
          return;
        }
      }

      // Alt+Shift+1-0: Jump to buffer
      if (e.altKey && e.shiftKey && !e.ctrlKey) {
        const digit = getDigit(e);
        if (digit !== null && digit >= 1 && digit <= 9) {
          e.preventDefault();
          this.jumpToBuffer(digit - 1);
          return;
        }
        if (digit === 0) {
          e.preventDefault();
          this.jumpToBuffer(9);
          return;
        }
      }

      // Alt+letter: Navigate within buffer (using configured key scheme)
      if (e.altKey && !e.ctrlKey && !e.shiftKey && matchesNavKey(e, navKeys.up)) {
        e.preventDefault();
        this.navigateMessage(-1);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.shiftKey && matchesNavKey(e, navKeys.down)) {
        e.preventDefault();
        this.navigateMessage(1);
        return;
      }

      // Alt+PageUp/PageDown: Navigate 10 messages
      if (e.altKey && e.key === 'PageUp') {
        e.preventDefault();
        this.navigateMessage(-10);
        return;
      }
      if (e.altKey && e.key === 'PageDown') {
        e.preventDefault();
        this.navigateMessage(10);
        return;
      }

      // Alt+Home/End: Navigate to start/end
      if (e.altKey && e.key === 'Home') {
        e.preventDefault();
        this.navigateMessage(-2000);
        return;
      }
      if (e.altKey && e.key === 'End') {
        e.preventDefault();
        this.navigateMessage(2000);
        return;
      }

      // Alt+Space: Repeat current message
      if (e.altKey && !e.shiftKey && e.key === ' ') {
        e.preventDefault();
        this.navigateMessage(0);
        return;
      }

      // Alt+Shift+Space: Copy current message
      if (e.altKey && e.shiftKey && e.key === ' ') {
        e.preventDefault();
        this.copyCurrentMessage();
        return;
      }

      // Alt+Shift+T: Toggle timestamps
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        this.toggleTimestamps();
        return;
      }

      // Alt+Shift+Delete: Delete current buffer
      if (e.altKey && e.shiftKey && e.key === 'Delete') {
        e.preventDefault();
        this.deleteCurrentBuffer();
        return;
      }
    };

    document.addEventListener('keydown', handler, true);
    this.cleanupKeyboard = () => document.removeEventListener('keydown', handler, true);
    return this.cleanupKeyboard;
  }
}

export const channelHistoryState = new ChannelHistoryState();

// Register with outputState to receive all incoming text lines
outputState.registerMessageCallback((text: string) => {
  channelHistoryState.addMessage(text);
});
