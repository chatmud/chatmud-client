/**
 * WebSocket service singleton for communicating with the ChatMUD proxy.
 *
 * Handles binary data (telnet) and proxy control messages (JSON prefixed
 * with PROXY_MARKER byte). Provides automatic reconnection with exponential
 * backoff.
 */

import type { ProxyMessage, ClientMessage } from '../types/proxy';
import { PROXY_MARKER, RECONNECT_DELAYS, STORAGE_KEYS } from '../constants';

export type WsDataHandler = (data: Uint8Array) => void;
export type WsProxyHandler = (msg: ProxyMessage) => void;
export type WsStatusHandler = (status: 'connecting' | 'connected' | 'disconnected') => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private onData: WsDataHandler | null = null;
  private onProxy: WsProxyHandler | null = null;
  private onStatus: WsStatusHandler | null = null;
  private sessionId: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  /**
   * Register handlers for incoming data, proxy messages, and connection status changes.
   */
  setHandlers(onData: WsDataHandler, onProxy: WsProxyHandler, onStatus: WsStatusHandler): void {
    this.onData = onData;
    this.onProxy = onProxy;
    this.onStatus = onStatus;
  }

  /**
   * Open a WebSocket connection to the proxy. If a sessionId is provided,
   * it is sent as a query parameter for session resumption.
   */
  connect(sessionId?: string): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.intentionalClose = false;
    if (sessionId) {
      this.sessionId = sessionId;
    }

    const url = this.buildWsUrl(sessionId ?? this.sessionId ?? undefined);
    this.onStatus?.('connecting');

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';

    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
      }
    }, 15000);

    ws.onopen = () => {
      if (this.ws !== ws) return;
      clearTimeout(connectionTimeout);
      this.reconnectAttempt = 0;
      this.onStatus?.('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws) return;
      if (event.data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(event.data);
        if (bytes.length > 0 && bytes[0] === PROXY_MARKER) {
          // Proxy control message: skip the marker byte, parse JSON
          const jsonStr = new TextDecoder().decode(bytes.subarray(1));
          try {
            const msg = JSON.parse(jsonStr) as ProxyMessage;
            // Capture session ID from session messages
            if (msg.type === 'session' && msg.sessionId) {
              this.sessionId = msg.sessionId;
            }
            this.onProxy?.(msg);
          } catch (err) {
            console.warn('[WS] Malformed proxy message:', err);
          }
        } else {
          // Raw telnet data
          this.onData?.(bytes);
        }
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.onStatus?.('disconnected');
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // The onclose handler will fire after onerror, so we just let it handle reconnect
    };

    this.ws = ws;
  }

  /**
   * Send a text command to the MUD. Appends \r\n and sends as binary UTF-8.
   */
  sendCommand(text: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text + '\r\n');
    this.sendRaw(bytes);
  }

  /**
   * Send raw bytes over the WebSocket.
   */
  sendRaw(data: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /**
   * Send a proxy control message. Prepends the PROXY_MARKER byte
   * to the JSON-encoded message.
   */
  sendProxyMessage(msg: ClientMessage): void {
    const encoder = new TextEncoder();
    const jsonBytes = encoder.encode(JSON.stringify(msg));
    const packet = new Uint8Array(1 + jsonBytes.length);
    packet[0] = PROXY_MARKER;
    packet.set(jsonBytes, 1);
    this.sendRaw(packet);
  }

  /**
   * Intentionally disconnect from the server. Does not trigger reconnect.
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.sessionId = null;
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
      // onclose guard (this.ws !== ws) will return early since this.ws is now null,
      // so we must explicitly fire the status callback here.
      this.onStatus?.('disconnected');
    }
  }

  /**
   * Force an immediate reconnect, resetting backoff. Used when a zombie
   * connection is detected (e.g. ping timeout).
   */
  forceReconnect(): void {
    this.reconnectAttempt = 0;
    this.connect(this.sessionId ?? undefined);
  }

  /**
   * Whether the WebSocket is currently open.
   */
  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Whether the most recent close was intentional (i.e. disconnect() was called).
   * False when the connection dropped unexpectedly and a reconnect will be attempted.
   */
  get lastCloseWasIntentional(): boolean {
    return this.intentionalClose;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  private scheduleReconnect(): void {
    const delayIndex = Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1);
    const base = RECONNECT_DELAYS[delayIndex];
    const jitter = base * 0.2 * Math.random();
    const delay = base + jitter;
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.sessionId ?? undefined);
    }, delay);
  }

  /**
   * Build the WebSocket URL based on the current page location.
   */
  private buildWsUrl(sessionId?: string): string {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let url = `${protocol}//${location.host}/ws`;
    if (sessionId) {
      url += `?sessionId=${encodeURIComponent(sessionId)}`;
    }
    return url;
  }
}

export const wsService = new WebSocketService();
