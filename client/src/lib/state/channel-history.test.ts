import { matchesNavKey, getDigit, navigationKeyMaps, channelHistoryState } from './channel-history.svelte';

// Mock localStorage
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock navigator.clipboard
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: vi.fn(() => Promise.resolve()) } },
  writable: true,
});

/** Helper to create a minimal KeyboardEvent-like object */
function fakeKey(opts: { key: string; code?: string; altKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean }): KeyboardEvent {
  return {
    key: opts.key,
    code: opts.code ?? '',
    altKey: opts.altKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: false,
  } as unknown as KeyboardEvent;
}

// --- Pure helper tests ---

describe('matchesNavKey', () => {
  it('matches by key directly', () => {
    expect(matchesNavKey(fakeKey({ key: 'j' }), 'j')).toBe(true);
    expect(matchesNavKey(fakeKey({ key: 'J' }), 'j')).toBe(true);
  });

  it('does not match different keys', () => {
    expect(matchesNavKey(fakeKey({ key: 'k' }), 'j')).toBe(false);
  });

  it('falls back to e.code for single letters', () => {
    // macOS Option+j produces a special char but code is still KeyJ
    expect(matchesNavKey(fakeKey({ key: '∆', code: 'KeyJ' }), 'j')).toBe(true);
  });

  it('handles comma key via code fallback', () => {
    expect(matchesNavKey(fakeKey({ key: '≤', code: 'Comma' }), ',')).toBe(true);
    expect(matchesNavKey(fakeKey({ key: ',', code: 'Comma' }), ',')).toBe(true);
  });

  it('does not match unrelated code', () => {
    expect(matchesNavKey(fakeKey({ key: '∆', code: 'KeyK' }), 'j')).toBe(false);
  });
});

describe('getDigit', () => {
  it('returns digit from key directly', () => {
    expect(getDigit(fakeKey({ key: '5' }))).toBe(5);
    expect(getDigit(fakeKey({ key: '0' }))).toBe(0);
  });

  it('falls back to code for macOS Option+number', () => {
    expect(getDigit(fakeKey({ key: '€', code: 'Digit3' }))).toBe(3);
  });

  it('returns null for non-digit', () => {
    expect(getDigit(fakeKey({ key: 'a', code: 'KeyA' }))).toBeNull();
  });

  it('returns null for empty key and code', () => {
    expect(getDigit(fakeKey({ key: '', code: '' }))).toBeNull();
  });
});

describe('navigationKeyMaps', () => {
  it('has all four schemes', () => {
    expect(Object.keys(navigationKeyMaps)).toEqual(['jkli', 'wasd', 'dvorak-rh', 'dvorak-lh']);
  });

  it('each scheme has up/down/left/right', () => {
    for (const scheme of Object.values(navigationKeyMaps)) {
      expect(scheme).toHaveProperty('up');
      expect(scheme).toHaveProperty('down');
      expect(scheme).toHaveProperty('left');
      expect(scheme).toHaveProperty('right');
    }
  });
});

// --- ChannelHistoryState tests ---

describe('calculateRelativeTime', () => {
  const calc = channelHistoryState.calculateRelativeTime.bind(channelHistoryState);

  it('returns "just now" for < 1 second', () => {
    expect(calc(500)).toBe('just now');
    expect(calc(0)).toBe('just now');
  });

  it('returns seconds for < 60 seconds', () => {
    expect(calc(30_000)).toBe('30 seconds ago');
  });

  it('returns minutes and seconds', () => {
    expect(calc(90_000)).toBe('1 minutes 30 seconds ago');
  });

  it('returns minutes only when seconds are 0', () => {
    expect(calc(120_000)).toBe('2 minutes ago');
  });

  it('returns hours and minutes', () => {
    expect(calc(3_660_000)).toBe('1 hours 1 minutes ago');
  });

  it('returns days, hours, and minutes', () => {
    expect(calc(90_060_000)).toBe('1 days, 1 hours, and 1 minutes ago');
  });
});

describe('ChannelHistoryState buffer management', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset state to defaults
    channelHistoryState.buffers = new Map([['all', { name: 'all', messages: [], currentIndex: 0 }]]);
    channelHistoryState.bufferOrder = ['all'];
    channelHistoryState.currentBufferIndex = 0;
    channelHistoryState.timestampsEnabled = true;
  });

  describe('addMessage', () => {
    it('adds a message to the "all" buffer', () => {
      channelHistoryState.addMessage('hello world');
      const allBuffer = channelHistoryState.buffers.get('all')!;
      expect(allBuffer.messages).toHaveLength(1);
      expect(allBuffer.messages[0].message).toBe('hello world');
    });

    it('ignores whitespace-only messages', () => {
      channelHistoryState.addMessage('   ');
      const allBuffer = channelHistoryState.buffers.get('all')!;
      expect(allBuffer.messages).toHaveLength(0);
    });

    it('assigns incrementing IDs', () => {
      channelHistoryState.addMessage('first');
      channelHistoryState.addMessage('second');
      const msgs = channelHistoryState.buffers.get('all')!.messages;
      expect(msgs[1].id).toBeGreaterThan(msgs[0].id);
    });

    it('records a timestamp', () => {
      const before = Date.now();
      channelHistoryState.addMessage('timed');
      const after = Date.now();
      const ts = channelHistoryState.buffers.get('all')!.messages[0].timestamp;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('addChannelMessage', () => {
    it('creates a new buffer for an unknown channel', () => {
      channelHistoryState.addChannelMessage('gossip', 'Alice', 'Hey all');
      expect(channelHistoryState.buffers.has('gossip')).toBe(true);
      expect(channelHistoryState.bufferOrder).toContain('gossip');
    });

    it('adds the message to the channel buffer', () => {
      channelHistoryState.addChannelMessage('gossip', 'Alice', 'Hey all');
      const buf = channelHistoryState.buffers.get('gossip')!;
      expect(buf.messages).toHaveLength(1);
      expect(buf.messages[0].channel).toBe('gossip');
      expect(buf.messages[0].talker).toBe('Alice');
      expect(buf.messages[0].message).toBe('Hey all');
    });

    it('appends to existing channel buffer', () => {
      channelHistoryState.addChannelMessage('gossip', 'Alice', 'first');
      channelHistoryState.addChannelMessage('gossip', 'Bob', 'second');
      const buf = channelHistoryState.buffers.get('gossip')!;
      expect(buf.messages).toHaveLength(2);
    });
  });

  describe('changeBuffer', () => {
    beforeEach(() => {
      channelHistoryState.addChannelMessage('gossip', 'A', 'msg1');
      channelHistoryState.addChannelMessage('chat', 'B', 'msg2');
    });

    it('moves forward through buffers', () => {
      channelHistoryState.changeBuffer(1);
      expect(channelHistoryState.currentBufferIndex).toBe(1);
    });

    it('wraps around at the end', () => {
      const total = channelHistoryState.bufferOrder.length;
      for (let i = 0; i < total; i++) {
        channelHistoryState.changeBuffer(1);
      }
      expect(channelHistoryState.currentBufferIndex).toBe(0);
    });

    it('moves backward and wraps', () => {
      channelHistoryState.changeBuffer(-1);
      expect(channelHistoryState.currentBufferIndex).toBe(channelHistoryState.bufferOrder.length - 1);
    });
  });

  describe('jumpToBuffer', () => {
    beforeEach(() => {
      channelHistoryState.addChannelMessage('gossip', 'A', 'msg1');
      channelHistoryState.addChannelMessage('chat', 'B', 'msg2');
    });

    it('jumps to valid index', () => {
      channelHistoryState.jumpToBuffer(2);
      expect(channelHistoryState.currentBufferIndex).toBe(2);
    });

    it('does not change index for out-of-range', () => {
      const before = channelHistoryState.currentBufferIndex;
      channelHistoryState.jumpToBuffer(99);
      expect(channelHistoryState.currentBufferIndex).toBe(before);
    });
  });

  describe('navigateMessage', () => {
    beforeEach(() => {
      channelHistoryState.addMessage('line 1');
      channelHistoryState.addMessage('line 2');
      channelHistoryState.addMessage('line 3');
    });

    it('starts at the bottom on first navigate', () => {
      channelHistoryState.navigateMessage(-1);
      const buf = channelHistoryState.buffers.get('all')!;
      // First nav from 0 goes to messages.length, then -1 offset is ignored
      // since currentIndex starts at 0, newIndex = messages.length = 3
      expect(buf.currentIndex).toBe(3);
    });

    it('navigates upward through messages', () => {
      channelHistoryState.navigateMessage(-1); // → 3 (bottom)
      channelHistoryState.navigateMessage(-1); // → 2
      const buf = channelHistoryState.buffers.get('all')!;
      expect(buf.currentIndex).toBe(2);
    });

    it('clamps at top', () => {
      channelHistoryState.navigateMessage(-1); // → 3
      channelHistoryState.navigateMessage(-1); // → 2
      channelHistoryState.navigateMessage(-1); // → 1
      channelHistoryState.navigateMessage(-1); // → 1 (clamped)
      const buf = channelHistoryState.buffers.get('all')!;
      expect(buf.currentIndex).toBe(1);
    });

    it('clamps at bottom', () => {
      channelHistoryState.navigateMessage(1); // → 3 (bottom)
      channelHistoryState.navigateMessage(1); // → 3 (clamped)
      const buf = channelHistoryState.buffers.get('all')!;
      expect(buf.currentIndex).toBe(3);
    });
  });

  describe('toggleTimestamps', () => {
    it('toggles from true to false', () => {
      channelHistoryState.timestampsEnabled = true;
      channelHistoryState.toggleTimestamps();
      expect(channelHistoryState.timestampsEnabled).toBe(false);
    });

    it('toggles from false to true', () => {
      channelHistoryState.timestampsEnabled = false;
      channelHistoryState.toggleTimestamps();
      expect(channelHistoryState.timestampsEnabled).toBe(true);
    });
  });

  describe('deleteCurrentBuffer', () => {
    beforeEach(() => {
      channelHistoryState.addChannelMessage('gossip', 'A', 'msg1');
    });

    it('cannot delete the "all" buffer', () => {
      channelHistoryState.currentBufferIndex = 0;
      channelHistoryState.deleteCurrentBuffer();
      expect(channelHistoryState.buffers.has('all')).toBe(true);
    });

    it('deletes a channel buffer', () => {
      channelHistoryState.changeBuffer(1); // move to gossip
      channelHistoryState.deleteCurrentBuffer();
      expect(channelHistoryState.buffers.has('gossip')).toBe(false);
      expect(channelHistoryState.bufferOrder).not.toContain('gossip');
    });

    it('adjusts currentBufferIndex after deletion', () => {
      channelHistoryState.changeBuffer(1);
      channelHistoryState.deleteCurrentBuffer();
      expect(channelHistoryState.currentBufferIndex).toBeLessThan(channelHistoryState.bufferOrder.length);
    });
  });

  describe('copyCurrentMessage', () => {
    it('copies the current message to clipboard', async () => {
      channelHistoryState.addMessage('copy me');
      channelHistoryState.navigateMessage(-1);
      channelHistoryState.copyCurrentMessage();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy me');
    });
  });
});
