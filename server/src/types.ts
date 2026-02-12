import type { WebSocket } from "ws";
import type { TLSSocket } from "tls";
import type { Socket } from "net";

/**
 * Hard limit for buffer size - not configurable
 * 10MB maximum to prevent memory issues
 */
export const MAX_BUFFER_SIZE_BYTES = 10485760; // 10MB

/** Upstream connection can be a TLS or plain TCP socket */
export type UpstreamSocket = TLSSocket | Socket;

// Forward declaration for TelnetEnvironHandler (defined in proxy.ts)
export interface TelnetEnvironHandlerInterface {
  setClientIp(ip: string): void;
  isNegotiated(): boolean;
  buildIpInfoMessage(): Buffer;
  processUpstreamData(data: Buffer): { response: Buffer | null; passThrough: Buffer };
}

/**
 * Represents a buffered message to be replayed on reconnection
 */
export interface BufferedMessage {
  data: Buffer | string;
  timestamp: number;
}

/**
 * Per-session configuration that can be customized by the user
 */
export interface SessionConfig {
  /** How long to keep session alive after disconnect (ms) */
  persistenceTimeout: number;
  /** Maximum number of lines to buffer */
  maxBufferLines: number;
}

/**
 * Represents a client session with persistence support
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  /** TCP/TLS connection to the upstream MUD server */
  upstream: UpstreamSocket | null;
  /** WebSocket connection from the client browser */
  client: WebSocket | null;
  /** Messages buffered while client is disconnected */
  buffer: BufferedMessage[];
  /** Total size of buffered messages in bytes */
  bufferSize: number;
  /** Timestamp when client last disconnected */
  disconnectedAt: number | null;
  /** Timeout handle for session cleanup */
  cleanupTimeout: NodeJS.Timeout | null;
  /** Whether the upstream connection is established */
  upstreamConnected: boolean;
  /** Creation timestamp */
  createdAt: number;
  /** Original client IP address */
  clientIp?: string;
  /** Original client port */
  clientPort?: number;
  /** Telnet NEW-ENVIRON handler for IP forwarding */
  telnetEnvHandler?: TelnetEnvironHandlerInterface;
  /** Per-session configuration (user customizable) */
  config: SessionConfig;
}

/**
 * Configuration for the proxy server
 */
export interface ProxyConfig {
  /** Port for the proxy server to listen on */
  port: number;
  /** URL of the upstream MUD server */
  upstreamUrl: string;
  /**
   * How long to keep sessions alive after client disconnect (ms)
   * - 0 = disconnect immediately (close upstream connection right away)
   * - Max: 43200000 (12 hours)
   * - Default: 300000 (5 minutes)
   */
  persistenceTimeout: number;
  /**
   * Maximum number of lines/messages to buffer per session
   * Buffer size is hard-limited to 10MB regardless of line count
   * - Min: 10
   * - Max: 10000
   * - Default: 1000
   */
  maxBufferLines: number;
  /**
   * Enable HAProxy PROXY protocol v1 to send client IP/port
   * - Default: false
   */
  useProxyProtocol: boolean;
}

/**
 * Message sent from proxy to client for session management
 */
export interface ProxyMessage {
  type: "session" | "error" | "reconnected" | "configUpdated";
  sessionId?: string;
  bufferedCount?: number;
  error?: string;
  config?: SessionConfig;
}

/**
 * Message sent from client to proxy for configuration updates
 *
 * To send from client:
 * ```javascript
 * const message = {
 *   type: "updateConfig",
 *   persistenceTimeout: 600000,  // 10 minutes
 *   maxBufferLines: 500
 * };
 * const payload = new Uint8Array([0x00, ...new TextEncoder().encode(JSON.stringify(message))]);
 * ws.send(payload);
 * ```
 */
export interface ClientMessage {
  type: "updateConfig";
  persistenceTimeout?: number;
  maxBufferLines?: number;
}

/**
 * Statistics about current proxy state
 */
export interface ProxyStats {
  activeSessions: number;
  persistedSessions: number;
  totalConnections: number;
}
