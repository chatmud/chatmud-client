/** Per-session configuration */
export interface SessionConfig {
  persistenceTimeout: number;
  maxBufferLines: number;
}

/** Message from proxy to client (prefixed with 0x00) */
export interface ProxyMessage {
  type: 'session' | 'error' | 'reconnected' | 'configUpdated' | 'bufferReplayComplete' | 'heartbeat';
  sessionId?: string;
  bufferedCount?: number;
  count?: number;
  error?: string;
  config?: SessionConfig;
}

/** Message from client to proxy (prefixed with 0x00) */
export interface ClientMessage {
  type: 'updateConfig';
  persistenceTimeout?: number;
  maxBufferLines?: number;
}
