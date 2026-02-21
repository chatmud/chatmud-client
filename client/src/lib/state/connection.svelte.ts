import type { SessionConfig, ProxyMessage } from '../types/proxy';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

const STORAGE_KEY = 'chatmud-sessionId';

class ConnectionState {
  status = $state<ConnectionStatus>('disconnected');
  sessionId = $state<string | null>(null);
  sessionConfig = $state<SessionConfig | null>(null);
  reconnectAttempt = $state(0);
  lastError = $state<string | null>(null);
  readonly isConnected = $derived(this.status === 'connected');

  handleProxyMessage(msg: ProxyMessage): void {
    switch (msg.type) {
      case 'session':
        this.sessionId = msg.sessionId ?? null;
        this.sessionConfig = msg.config ?? null;
        if (this.sessionId) {
          localStorage.setItem(STORAGE_KEY, this.sessionId);
        }
        break;
      case 'reconnected':
        this.status = 'connected';
        this.reconnectAttempt = 0;
        break;
      case 'configUpdated':
        if (msg.config) this.sessionConfig = msg.config;
        break;
      case 'error':
        this.lastError = msg.error ?? null;
        localStorage.removeItem(STORAGE_KEY);
        break;
      case 'bufferReplayComplete':
        break;
    }
  }

  loadSessionId(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      this.sessionId = saved;
    }
  }

  reset(): void {
    this.status = 'disconnected';
    this.sessionId = null;
    this.sessionConfig = null;
    this.reconnectAttempt = 0;
    this.lastError = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const connectionState = new ConnectionState();
