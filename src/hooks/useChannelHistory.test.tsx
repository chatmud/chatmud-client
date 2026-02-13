import { renderHook, act } from '@testing-library/react';
import { useChannelHistory } from './useChannelHistory';

// Mock the announce function
jest.mock('@react-aria/live-announcer', () => ({
  announce: jest.fn(),
}));

// Create a mock client
const createMockClient = () => {
  const listeners: Record<string, Function[]> = {};

  return {
    on: jest.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeListener: jest.fn((event: string, handler: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    }),
    emit: (event: string, data: any) => {
      if (listeners[event]) {
        listeners[event].forEach(handler => handler(data));
      }
    },
  };
};

describe('useChannelHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('initializes with "all" buffer', () => {
    const mockClient = createMockClient() as any;
    const { result } = renderHook(() => useChannelHistory(mockClient));

    expect(result.current.bufferOrder).toContain('all');
    expect(result.current.buffers.has('all')).toBe(true);
  });

  test('creates new buffer when channel message received', () => {
    const mockClient = createMockClient() as any;
    const { result } = renderHook(() => useChannelHistory(mockClient));

    // Simulate a channel message
    act(() => {
      mockClient.emit('channelText', {
        channel: 'newbie',
        talker: 'TestUser',
        text: 'Hello world!',
      });
    });

    // Wait for state update
    setTimeout(() => {
      expect(result.current.bufferOrder).toContain('newbie');
      expect(result.current.buffers.has('newbie')).toBe(true);
    }, 100);
  });

  test('adds messages to all buffer', () => {
    const mockClient = createMockClient() as any;
    const { result } = renderHook(() => useChannelHistory(mockClient));

    act(() => {
      mockClient.emit('message', 'Test message');
    });

    const allBuffer = result.current.buffers.get('all');
    expect(allBuffer?.messages.length).toBeGreaterThan(0);
  });

  test('persists to localStorage', () => {
    const mockClient = createMockClient() as any;
    const { result } = renderHook(() => useChannelHistory(mockClient));

    act(() => {
      mockClient.emit('message', 'Test message');
    });

    const saved = localStorage.getItem('channelHistory');
    expect(saved).toBeTruthy();

    if (saved) {
      const parsed = JSON.parse(saved);
      expect(parsed.bufferOrder).toContain('all');
    }
  });
});
