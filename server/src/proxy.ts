import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import * as tls from "tls";
import * as net from "net";
import type {
  Session,
  ProxyConfig,
  BufferedMessage,
  ProxyMessage,
  ClientMessage,
  SessionConfig,
  UpstreamSocket,
} from "./types.js";
import { MAX_BUFFER_SIZE_BYTES } from "./types.js";

// Configuration limits (same as in index.ts)
const CONFIG_LIMITS = {
  PERSISTENCE_TIMEOUT: { MIN: 0, MAX: 43200000, DEFAULT: 300000 },
  BUFFER_LINES: { MIN: 10, MAX: 10000, DEFAULT: 1000 },
};

// Telnet protocol constants
const enum Telnet {
  IAC = 255,   // Interpret As Command
  DONT = 254,
  DO = 253,
  WONT = 252,
  WILL = 251,
  SB = 250,    // Subnegotiation Begin
  SE = 240,    // Subnegotiation End
  NEW_ENVIRON = 39,  // RFC 1572
}

// NEW-ENVIRON subnegotiation commands (RFC 1572)
const enum NewEnviron {
  IS = 0,      // Response to SEND
  SEND = 1,    // Request variables
  INFO = 2,    // Unsolicited update
  VAR = 0,     // Well-known variable
  VALUE = 1,   // Variable value follows
  ESC = 2,     // Escape character
  USERVAR = 3, // User-defined variable
}

/**
 * Generate a random session ID
 */
function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate and clamp a config value to its limits
 */
function validateConfigValue(
  value: number | undefined,
  limits: { MIN: number; MAX: number; DEFAULT: number }
): number {
  if (value === undefined || isNaN(value)) {
    return limits.DEFAULT;
  }
  return Math.max(limits.MIN, Math.min(limits.MAX, value));
}

/**
 * Parse and validate session config from URL parameters or defaults
 */
function parseSessionConfig(
  params: URLSearchParams,
  defaultConfig: ProxyConfig
): SessionConfig {
  const persistenceTimeout = params.has("persistenceTimeout")
    ? parseInt(params.get("persistenceTimeout")!, 10)
    : defaultConfig.persistenceTimeout;

  const maxBufferLines = params.has("maxBufferLines")
    ? parseInt(params.get("maxBufferLines")!, 10)
    : defaultConfig.maxBufferLines;

  return {
    persistenceTimeout: validateConfigValue(
      persistenceTimeout,
      CONFIG_LIMITS.PERSISTENCE_TIMEOUT
    ),
    maxBufferLines: validateConfigValue(
      maxBufferLines,
      CONFIG_LIMITS.BUFFER_LINES
    ),
  };
}

/**
 * Escape special bytes in NEW-ENVIRON data per RFC 1572
 * - IAC (255) -> IAC IAC
 * - VAR (0) -> ESC VAR
 * - VALUE (1) -> ESC VALUE
 * - ESC (2) -> ESC ESC
 * - USERVAR (3) -> ESC USERVAR
 */
function escapeEnvironData(data: Buffer): Buffer {
  const escaped: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const byte = data[i];

    if (byte === 255) {  // IAC
      escaped.push(255, 255);
    } else if (byte === NewEnviron.VAR) {
      escaped.push(NewEnviron.ESC, NewEnviron.VAR);
    } else if (byte === NewEnviron.VALUE) {
      escaped.push(NewEnviron.ESC, NewEnviron.VALUE);
    } else if (byte === NewEnviron.ESC) {
      escaped.push(NewEnviron.ESC, NewEnviron.ESC);
    } else if (byte === NewEnviron.USERVAR) {
      escaped.push(NewEnviron.ESC, NewEnviron.USERVAR);
    } else {
      escaped.push(byte);
    }
  }

  return Buffer.from(escaped);
}

/**
 * Build a telnet NEW-ENVIRON IS response for IPADDRESS
 * Format: IAC SB NEW-ENVIRON IS VAR "IPADDRESS" VALUE "<ip>" IAC SE
 * Data is escaped per RFC 1572
 */
function buildNewEnvironResponse(varName: string, value: string): Buffer {
  const varNameBytes = escapeEnvironData(Buffer.from(varName, "ascii"));
  const valueBytes = escapeEnvironData(Buffer.from(value, "ascii"));

  // IAC SB NEW-ENVIRON IS VAR <name> VALUE <value> IAC SE
  const buffer = Buffer.alloc(6 + varNameBytes.length + 1 + valueBytes.length + 2);
  let offset = 0;

  buffer[offset++] = Telnet.IAC;
  buffer[offset++] = Telnet.SB;
  buffer[offset++] = Telnet.NEW_ENVIRON;
  buffer[offset++] = NewEnviron.IS;
  buffer[offset++] = NewEnviron.VAR;
  varNameBytes.copy(buffer, offset);
  offset += varNameBytes.length;
  buffer[offset++] = NewEnviron.VALUE;
  valueBytes.copy(buffer, offset);
  offset += valueBytes.length;
  buffer[offset++] = Telnet.IAC;
  buffer[offset++] = Telnet.SE;

  return buffer;
}

/**
 * Build a telnet NEW-ENVIRON INFO (unsolicited update)
 * Format: IAC SB NEW-ENVIRON INFO VAR "IPADDRESS" VALUE "<ip>" IAC SE
 * Data is escaped per RFC 1572
 */
function buildNewEnvironInfo(varName: string, value: string): Buffer {
  const varNameBytes = escapeEnvironData(Buffer.from(varName, "ascii"));
  const valueBytes = escapeEnvironData(Buffer.from(value, "ascii"));

  const buffer = Buffer.alloc(6 + varNameBytes.length + 1 + valueBytes.length + 2);
  let offset = 0;

  buffer[offset++] = Telnet.IAC;
  buffer[offset++] = Telnet.SB;
  buffer[offset++] = Telnet.NEW_ENVIRON;
  buffer[offset++] = NewEnviron.INFO;
  buffer[offset++] = NewEnviron.VAR;
  varNameBytes.copy(buffer, offset);
  offset += varNameBytes.length;
  buffer[offset++] = NewEnviron.VALUE;
  valueBytes.copy(buffer, offset);
  offset += valueBytes.length;
  buffer[offset++] = Telnet.IAC;
  buffer[offset++] = Telnet.SE;

  return buffer;
}

/**
 * Build IAC WILL NEW-ENVIRON
 */
function buildWillNewEnviron(): Buffer {
  return Buffer.from([Telnet.IAC, Telnet.WILL, Telnet.NEW_ENVIRON]);
}

/**
 * Build HAProxy PROXY protocol v1 header
 * Format: PROXY TCP4 <source_ip> <dest_ip> <source_port> <dest_port>\r\n
 *
 * This passes the original client connection info through the proxy.
 * The upstream server can then see the real client IP instead of the proxy IP.
 */
function buildProxyProtocolHeader(
  sourceIp: string,
  destIp: string,
  sourcePort: number,
  destPort: number
): Buffer {
  // Determine if IPv4 or IPv6
  const protocol = sourceIp.includes(":") ? "TCP6" : "TCP4";
  const header = `PROXY ${protocol} ${sourceIp} ${destIp} ${sourcePort} ${destPort}\r\n`;
  return Buffer.from(header, "ascii");
}

/**
 * Handles telnet NEW-ENVIRON negotiation for passing client IP to upstream
 */
class TelnetEnvironHandler {
  private clientIp: string;
  private newEnvironNegotiated: boolean = false;
  private parseBuffer: Buffer = Buffer.alloc(0);

  constructor(clientIp: string) {
    this.clientIp = clientIp;
  }

  /**
   * Update the client IP (e.g., on reconnection)
   */
  setClientIp(ip: string): void {
    this.clientIp = ip;
  }

  /**
   * Check if NEW-ENVIRON has been negotiated
   */
  isNegotiated(): boolean {
    return this.newEnvironNegotiated;
  }

  /**
   * Build an INFO message to send updated IP (for reconnection)
   */
  buildIpInfoMessage(): Buffer {
    return buildNewEnvironInfo("IPADDRESS", this.clientIp);
  }

  /**
   * Process data from upstream, intercept NEW-ENVIRON negotiation
   * Returns: { response: Buffer | null, passThrough: Buffer }
   * - response: telnet response to send back to upstream
   * - passThrough: data to forward to client
   */
  processUpstreamData(data: Buffer): { response: Buffer | null; passThrough: Buffer } {
    // Accumulate data for parsing
    this.parseBuffer = Buffer.concat([this.parseBuffer, data]);

    const responses: Buffer[] = [];
    const passThrough: Buffer[] = [];
    let i = 0;

    while (i < this.parseBuffer.length) {
      // Look for IAC
      if (this.parseBuffer[i] === Telnet.IAC) {
        // Need at least 2 bytes for a command
        if (i + 1 >= this.parseBuffer.length) {
          break; // Wait for more data
        }

        const cmd = this.parseBuffer[i + 1];

        // Handle IAC IAC (escaped 255)
        if (cmd === Telnet.IAC) {
          passThrough.push(Buffer.from([Telnet.IAC, Telnet.IAC]));
          i += 2;
          continue;
        }

        // Handle IAC DO/DONT/WILL/WONT (3-byte sequences)
        if (cmd === Telnet.DO || cmd === Telnet.DONT || cmd === Telnet.WILL || cmd === Telnet.WONT) {
          if (i + 2 >= this.parseBuffer.length) {
            break; // Wait for more data
          }

          const opt = this.parseBuffer[i + 2];

          // Intercept DO NEW-ENVIRON
          if (cmd === Telnet.DO && opt === Telnet.NEW_ENVIRON) {
            console.log("[TelnetEnv] Received DO NEW-ENVIRON, responding with WILL");
            responses.push(buildWillNewEnviron());
            this.newEnvironNegotiated = true;
            i += 3;
            continue;
          }

          // Pass through other negotiation to client
          passThrough.push(this.parseBuffer.slice(i, i + 3));
          i += 3;
          continue;
        }

        // Handle IAC SB ... IAC SE (subnegotiation)
        if (cmd === Telnet.SB) {
          if (i + 2 >= this.parseBuffer.length) {
            break; // Wait for more data
          }

          const opt = this.parseBuffer[i + 2];

          // Find IAC SE to get full subnegotiation
          const seIndex = this.findSubnegotiationEnd(i + 3);
          if (seIndex === -1) {
            break; // Wait for more data
          }

          // Intercept NEW-ENVIRON subnegotiation
          if (opt === Telnet.NEW_ENVIRON) {
            const subData = this.parseBuffer.slice(i + 3, seIndex);
            const subResponse = this.handleSubnegotiation(subData);
            if (subResponse) {
              responses.push(subResponse);
            }
            i = seIndex + 2; // Skip past IAC SE
            continue;
          }

          // Pass through other subnegotiations to client
          passThrough.push(this.parseBuffer.slice(i, seIndex + 2));
          i = seIndex + 2;
          continue;
        }

        // Other 2-byte IAC commands (NOP, etc.) - pass through
        passThrough.push(this.parseBuffer.slice(i, i + 2));
        i += 2;
        continue;
      }

      // Not an IAC - find next IAC or end of buffer
      let nextIac = i + 1;
      while (nextIac < this.parseBuffer.length && this.parseBuffer[nextIac] !== Telnet.IAC) {
        nextIac++;
      }

      // Pass through data up to next IAC
      passThrough.push(this.parseBuffer.slice(i, nextIac));
      i = nextIac;
    }

    // Keep unprocessed data in buffer
    this.parseBuffer = this.parseBuffer.slice(i);

    return {
      response: responses.length > 0 ? Buffer.concat(responses) : null,
      passThrough: passThrough.length > 0 ? Buffer.concat(passThrough) : Buffer.alloc(0),
    };
  }

  /**
   * Find IAC SE in buffer starting from offset
   */
  private findSubnegotiationEnd(start: number): number {
    for (let i = start; i < this.parseBuffer.length - 1; i++) {
      if (this.parseBuffer[i] === Telnet.IAC && this.parseBuffer[i + 1] === Telnet.SE) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Handle NEW-ENVIRON subnegotiation
   */
  private handleSubnegotiation(data: Buffer): Buffer | null {
    if (data.length === 0) return null;

    const subCmd = data[0];

    // Handle SEND command
    if (subCmd === NewEnviron.SEND) {
      console.log("[TelnetEnv] Received NEW-ENVIRON SEND");
      return this.handleSendRequest(data.slice(1));
    }

    return null;
  }

  /**
   * Handle NEW-ENVIRON SEND request
   * Format: SEND [VAR <name>]* [USERVAR <name>]*
   * Handles ESC sequences per RFC 1572
   */
  private handleSendRequest(data: Buffer): Buffer | null {
    // Parse requested variables
    const requestedVars: string[] = [];
    let i = 0;

    while (i < data.length) {
      const type = data[i];
      if (type === NewEnviron.VAR || type === NewEnviron.USERVAR) {
        i++;
        const nameBytes: number[] = [];

        // Read variable name until next VAR/USERVAR/end, handling ESC
        while (i < data.length) {
          if (data[i] === NewEnviron.ESC && i + 1 < data.length) {
            // ESC escapes the next byte - take it literally
            i++;
            nameBytes.push(data[i]);
            i++;
          } else if (data[i] === NewEnviron.VAR || data[i] === NewEnviron.USERVAR) {
            // End of this variable name
            break;
          } else {
            nameBytes.push(data[i]);
            i++;
          }
        }

        const varName = Buffer.from(nameBytes).toString("ascii");
        if (varName.length > 0) {
          requestedVars.push(varName);
        }
      } else {
        i++;
      }
    }

    console.log("[TelnetEnv] Server requested variables:", requestedVars);

    // If IPADDRESS is requested, or no specific variables requested (send all), respond with it
    if (requestedVars.includes("IPADDRESS") || requestedVars.length === 0) {
      console.log(`[TelnetEnv] Responding with IPADDRESS=${this.clientIp}`);
      return buildNewEnvironResponse("IPADDRESS", this.clientIp);
    }

    return null;
  }
}

/**
 * WebSocket proxy with connection persistence
 */
export class MudProxy {
  private wss: WebSocketServer;
  private sessions: Map<string, Session> = new Map();
  private config: ProxyConfig;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(server: Server, config: ProxyConfig) {
    this.config = config;
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start ping interval to keep connections alive
    this.startPingInterval();

    console.log(`[Proxy] WebSocket proxy initialized on /ws`);
    console.log(`[Proxy] Upstream: ${config.upstreamUrl}`);
    console.log(`[Proxy] PROXY protocol: ${config.useProxyProtocol ? "enabled" : "disabled"}`);
    if (config.persistenceTimeout === 0) {
      console.log(`[Proxy] Persistence: disabled (disconnect immediately)`);
    } else {
      console.log(
        `[Proxy] Persistence timeout: ${config.persistenceTimeout / 1000}s (${config.persistenceTimeout / 3600000}h)`
      );
    }
    console.log(`[Proxy] Max buffer lines: ${config.maxBufferLines}`);
    console.log(`[Proxy] Max buffer size: ${MAX_BUFFER_SIZE_BYTES / 1048576}MB (hard limit)`);
  }

  /**
   * Start periodic ping to keep connections alive
   */
  private startPingInterval(): void {
    // Ping every 30 seconds
    this.pingInterval = setInterval(() => {
      for (const session of this.sessions.values()) {
        // Ping client WebSocket if connected
        if (session.client && session.client.readyState === WebSocket.OPEN) {
          session.client.ping();
        }
        // No ping needed for raw TCP upstream - TCP keepalive handles it
      }
    }, 30000);
  }

  /**
   * Extract real client IP from request, checking X-Forwarded-For header
   */
  private getClientInfo(req: IncomingMessage): { ip: string; port: number } {
    // Check X-Forwarded-For header first (for clients behind load balancer)
    const forwardedFor = req.headers["x-forwarded-for"];
    let clientIp: string;

    if (forwardedFor) {
      // X-Forwarded-For can be comma-separated list, take first (original client)
      const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      clientIp = forwarded.split(",")[0].trim();
    } else {
      // Fall back to socket remote address
      clientIp = req.socket.remoteAddress || "127.0.0.1";
    }

    // Handle IPv6-mapped IPv4 addresses (::ffff:192.168.1.1)
    if (clientIp.startsWith("::ffff:")) {
      clientIp = clientIp.substring(7);
    }

    // Get port from X-Forwarded-Port or socket
    const forwardedPort = req.headers["x-forwarded-port"];
    const clientPort = forwardedPort
      ? parseInt(Array.isArray(forwardedPort) ? forwardedPort[0] : forwardedPort, 10)
      : req.socket.remotePort || 0;

    return { ip: clientIp, port: clientPort };
  }

  /**
   * Handle new WebSocket connection from client
   */
  private handleConnection(clientWs: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const sessionId = url.searchParams.get("sessionId");
    const clientInfo = this.getClientInfo(req);

    console.log(
      `[Proxy] New connection from ${clientInfo.ip}:${clientInfo.port}${sessionId ? ` with sessionId: ${sessionId}` : ""}`
    );

    if (sessionId && this.sessions.has(sessionId)) {
      this.handleReconnection(clientWs, sessionId, clientInfo.ip);
    } else {
      // Parse session config from URL parameters
      const sessionConfig = parseSessionConfig(url.searchParams, this.config);
      this.createNewSession(clientWs, clientInfo.ip, clientInfo.port, sessionConfig);
    }
  }

  /**
   * Create a new session for a client
   */
  private createNewSession(
    clientWs: WebSocket,
    clientIp: string,
    clientPort: number,
    sessionConfig: SessionConfig
  ): void {
    const sessionId = generateSessionId();

    const session: Session = {
      id: sessionId,
      upstream: null,
      client: clientWs,
      buffer: [],
      bufferSize: 0,
      disconnectedAt: null,
      cleanupTimeout: null,
      upstreamConnected: false,
      createdAt: Date.now(),
      clientIp,
      clientPort,
      config: sessionConfig,
    };

    this.sessions.set(sessionId, session);

    // Send session ID and config to client
    this.sendProxyMessage(clientWs, {
      type: "session",
      sessionId,
      config: sessionConfig,
    });

    // Connect to upstream - client IP will be sent via NEW-ENVIRON
    this.connectUpstream(session, clientIp);

    // Set up client event handlers
    this.setupClientHandlers(session, clientWs);

    console.log(
      `[Proxy] Created new session: ${sessionId} (persistence: ${sessionConfig.persistenceTimeout}ms, buffer: ${sessionConfig.maxBufferLines} lines)`
    );
  }

  /**
   * Handle client reconnection to existing session
   */
  private handleReconnection(clientWs: WebSocket, sessionId: string, newClientIp: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendProxyMessage(clientWs, {
        type: "error",
        error: "Session not found",
      });
      clientWs.close();
      return;
    }

    // Cancel cleanup timeout
    if (session.cleanupTimeout) {
      clearTimeout(session.cleanupTimeout);
      session.cleanupTimeout = null;
    }

    // Check if client IP changed
    const ipChanged = session.clientIp !== newClientIp;
    if (ipChanged) {
      console.log(`[Proxy] Client IP changed from ${session.clientIp} to ${newClientIp}`);
      session.clientIp = newClientIp;

      // Update telnet handler and send INFO to upstream if negotiated
      if (session.telnetEnvHandler) {
        session.telnetEnvHandler.setClientIp(newClientIp);

        if (session.telnetEnvHandler.isNegotiated() && this.isUpstreamAlive(session)) {
          // Send NEW-ENVIRON INFO with updated IP
          const infoMsg = session.telnetEnvHandler.buildIpInfoMessage();
          console.log(`[Proxy] Sending NEW-ENVIRON INFO with updated IP: ${newClientIp}`);
          session.upstream!.write(infoMsg);
        }
      }
    }

    // Update session with new client
    session.client = clientWs;
    session.disconnectedAt = null;

    console.log(
      `[Proxy] Client reconnected to session: ${sessionId}, buffered messages: ${session.buffer.length}`
    );

    // Send reconnection confirmation with buffer info
    this.sendProxyMessage(clientWs, {
      type: "reconnected",
      sessionId,
      bufferedCount: session.buffer.length,
    });

    // Replay buffered messages
    for (const msg of session.buffer) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(msg.data);
      }
    }

    // Clear buffer after replay
    session.buffer = [];
    session.bufferSize = 0;

    // Set up client event handlers
    this.setupClientHandlers(session, clientWs);
  }

  /**
   * Parse upstream URL into host, port, and whether to use TLS
   */
  private parseUpstreamUrl(): { host: string; port: number; useTls: boolean } {
    const url = this.config.upstreamUrl;
    // Support formats: tls://host:port, tcp://host:port, host:port (defaults to TLS)
    let useTls = true;
    let hostPort = url;

    if (url.startsWith("tls://") || url.startsWith("wss://") || url.startsWith("ssl://")) {
      useTls = true;
      hostPort = url.replace(/^(tls|wss|ssl):\/\//, "");
    } else if (url.startsWith("tcp://") || url.startsWith("ws://") || url.startsWith("telnet://")) {
      useTls = false;
      hostPort = url.replace(/^(tcp|ws|telnet):\/\//, "");
    }

    const [host, portStr] = hostPort.split(":");
    const port = parseInt(portStr || (useTls ? "7443" : "7777"), 10);

    return { host, port, useTls };
  }

  /**
   * Check if upstream socket is writable
   */
  private isUpstreamAlive(session: Session): boolean {
    return !!(session.upstream && !session.upstream.destroyed && session.upstream.writable);
  }

  /**
   * Connect to upstream MUD server via TCP/TLS
   */
  private connectUpstream(session: Session, clientIp: string): void {
    const { host, port, useTls } = this.parseUpstreamUrl();
    console.log(`[Proxy] Connecting to upstream: ${host}:${port} (${useTls ? "TLS" : "plain"})`);

    // Create telnet handler for NEW-ENVIRON negotiation
    session.telnetEnvHandler = new TelnetEnvironHandler(clientIp);

    let upstream: UpstreamSocket;

    const onConnected = () => {
      console.log(`[Proxy] ${useTls ? "TLS" : "TCP"} upstream connected for session: ${session.id}`);
      session.upstreamConnected = true;

      // Send PROXY protocol header if enabled
      if (this.config.useProxyProtocol) {
        const localAddress = upstream.localAddress || "127.0.0.1";
        const localPort = upstream.localPort || 0;
        const proxyHeader = buildProxyProtocolHeader(
          clientIp,
          localAddress,
          session.clientPort || 0,
          port
        );
        console.log(`[Proxy] Sending PROXY protocol header for ${clientIp}:${session.clientPort}`);
        upstream.write(proxyHeader);
      }
    };

    if (useTls) {
      upstream = tls.connect({
        host,
        port,
        rejectUnauthorized: false, // MOO certs are often self-signed
      }, onConnected);
    } else {
      upstream = net.connect({ host, port }, onConnected);
    }

    // Enable TCP keepalive
    upstream.setKeepAlive(true, 30000);

    session.upstream = upstream;

    upstream.on("data", (data: Buffer) => {
      this.handleUpstreamMessage(session, data);
    });

    upstream.on("close", () => {
      console.log(`[Proxy] Upstream closed for session ${session.id}`);
      session.upstreamConnected = false;

      // Notify client if connected
      if (session.client && session.client.readyState === WebSocket.OPEN) {
        session.client.close(1000, "Upstream connection closed");
      }

      // Clean up session
      this.cleanupSession(session.id);
    });

    upstream.on("error", (error) => {
      console.error(`[Proxy] Upstream error for session ${session.id}:`, error);
    });
  }

  /**
   * Handle message from upstream MUD server
   */
  private handleUpstreamMessage(
    session: Session,
    data: Buffer | string
  ): void {
    // Convert to Buffer if string
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Process through telnet handler to intercept NEW-ENVIRON negotiation
    let dataToForward: Buffer = buffer;

    if (session.telnetEnvHandler) {
      const result = session.telnetEnvHandler.processUpstreamData(buffer);

      // Send any telnet responses back to upstream
      if (result.response && this.isUpstreamAlive(session)) {
        session.upstream!.write(result.response);
      }

      // Use filtered data for forwarding to client
      dataToForward = result.passThrough;
    }

    // Only forward if there's data to forward
    if (dataToForward.length === 0) {
      return;
    }

    if (session.client && session.client.readyState === WebSocket.OPEN) {
      // Client connected - forward directly
      session.client.send(dataToForward);
    } else if (session.disconnectedAt !== null) {
      // Client disconnected - buffer the message
      this.bufferMessage(session, dataToForward);
    }
  }

  /**
   * Buffer a message for later replay
   */
  private bufferMessage(session: Session, data: Buffer | string): void {
    const size = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);

    // Check if we'd exceed line limit
    if (session.buffer.length >= session.config.maxBufferLines) {
      // Remove oldest message
      const removed = session.buffer.shift();
      if (removed) {
        const removedSize = Buffer.isBuffer(removed.data)
          ? removed.data.length
          : Buffer.byteLength(removed.data);
        session.bufferSize -= removedSize;
      }
    }

    // If single message exceeds hard buffer size limit, skip it
    if (size > MAX_BUFFER_SIZE_BYTES) {
      console.warn(
        `[Proxy] Message too large to buffer (${size} bytes), skipping`
      );
      return;
    }

    // Remove old messages if we'd exceed hard size limit (10MB)
    while (
      session.bufferSize + size > MAX_BUFFER_SIZE_BYTES &&
      session.buffer.length > 0
    ) {
      const removed = session.buffer.shift();
      if (removed) {
        const removedSize = Buffer.isBuffer(removed.data)
          ? removed.data.length
          : Buffer.byteLength(removed.data);
        session.bufferSize -= removedSize;
      }
    }

    const message: BufferedMessage = {
      data,
      timestamp: Date.now(),
    };

    session.buffer.push(message);
    session.bufferSize += size;
  }

  /**
   * Set up event handlers for client WebSocket
   */
  private setupClientHandlers(session: Session, clientWs: WebSocket): void {
    clientWs.on("message", (data: Buffer | string) => {
      // Check if this is a proxy control message (starts with 0x00)
      if (Buffer.isBuffer(data) && data.length > 0 && data[0] === 0x00) {
        try {
          const payload = data.slice(1).toString();
          const message: ClientMessage = JSON.parse(payload);
          this.handleClientMessage(session, message);
        } catch (error) {
          console.error(`[Proxy] Failed to parse client message:`, error);
        }
        return;
      }

      // Forward normal messages to upstream if connected
      if (this.isUpstreamAlive(session)) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as string);
        session.upstream!.write(buf);
      }
    });

    clientWs.on("close", (code, reason) => {
      console.log(
        `[Proxy] Client disconnected from session ${session.id}: ${code} ${reason}`
      );
      // Check if this is an intentional disconnect (code 1000 = normal closure)
      // Intentional disconnects should always clean up immediately
      const isIntentionalDisconnect = code === 1000;
      this.handleClientDisconnect(session, isIntentionalDisconnect);
    });

    clientWs.on("error", (error) => {
      console.error(`[Proxy] Client error for session ${session.id}:`, error);
    });
  }

  /**
   * Handle control message from client (config updates, etc.)
   */
  private handleClientMessage(session: Session, message: ClientMessage): void {
    if (message.type === "updateConfig") {
      const newConfig: SessionConfig = {
        persistenceTimeout: validateConfigValue(
          message.persistenceTimeout,
          CONFIG_LIMITS.PERSISTENCE_TIMEOUT
        ),
        maxBufferLines: validateConfigValue(
          message.maxBufferLines,
          CONFIG_LIMITS.BUFFER_LINES
        ),
      };

      // Update session config
      session.config = newConfig;

      console.log(
        `[Proxy] Updated config for session ${session.id}: persistence=${newConfig.persistenceTimeout}ms, buffer=${newConfig.maxBufferLines} lines`
      );

      // Send confirmation to client
      if (session.client && session.client.readyState === WebSocket.OPEN) {
        this.sendProxyMessage(session.client, {
          type: "configUpdated",
          config: newConfig,
        });
      }
    }
  }

  /**
   * Handle client disconnect - start persistence timer or clean up immediately
   * @param session The session that disconnected
   * @param isIntentionalDisconnect True if user clicked disconnect (always clean up immediately)
   */
  private handleClientDisconnect(session: Session, isIntentionalDisconnect: boolean = false): void {
    session.client = null;
    session.disconnectedAt = Date.now();

    // Check if upstream is still alive
    if (!this.isUpstreamAlive(session)) {
      // Upstream already dead, clean up immediately
      this.cleanupSession(session.id);
      return;
    }

    // If user intentionally disconnected, always clean up immediately
    if (isIntentionalDisconnect) {
      console.log(
        `[Proxy] User intentionally disconnected from session ${session.id}, cleaning up immediately`
      );
      this.cleanupSession(session.id);
      return;
    }

    // If persistence timeout is 0, disconnect immediately
    if (session.config.persistenceTimeout === 0) {
      console.log(
        `[Proxy] Client disconnected from session ${session.id}, cleaning up immediately (persistence disabled)`
      );
      this.cleanupSession(session.id);
      return;
    }

    console.log(
      `[Proxy] Starting persistence timer for session ${session.id} (${session.config.persistenceTimeout / 1000}s)`
    );

    // Start cleanup timeout
    session.cleanupTimeout = setTimeout(() => {
      console.log(`[Proxy] Persistence timeout reached for session ${session.id}`);
      this.cleanupSession(session.id);
    }, session.config.persistenceTimeout);
  }

  /**
   * Clean up a session completely
   */
  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`[Proxy] Cleaning up session: ${sessionId}`);

    // Clear timeout if any
    if (session.cleanupTimeout) {
      clearTimeout(session.cleanupTimeout);
    }

    // Close upstream connection
    if (session.upstream) {
      try {
        session.upstream.destroy();
      } catch {
        // Ignore errors on close
      }
    }

    // Close client connection if still open
    if (session.client && session.client.readyState === WebSocket.OPEN) {
      try {
        session.client.close(1000, "Session ended");
      } catch {
        // Ignore errors on close
      }
    }

    // Remove from map
    this.sessions.delete(sessionId);
  }

  /**
   * Send a proxy control message to client
   */
  private sendProxyMessage(ws: WebSocket, message: ProxyMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      // Send as a special binary message with a marker prefix
      const payload = JSON.stringify(message);
      // Use a prefix byte 0x00 to distinguish proxy messages from MUD data
      const buffer = Buffer.alloc(1 + payload.length);
      buffer[0] = 0x00; // Proxy message marker
      buffer.write(payload, 1);
      ws.send(buffer);
    }
  }

  /**
   * Get current proxy statistics
   */
  public getStats(): { active: number; persisted: number } {
    let active = 0;
    let persisted = 0;

    for (const session of this.sessions.values()) {
      if (session.client && session.client.readyState === WebSocket.OPEN) {
        active++;
      } else if (session.disconnectedAt !== null) {
        persisted++;
      }
    }

    return { active, persisted };
  }

  /**
   * Shut down the proxy gracefully
   */
  public shutdown(): void {
    console.log("[Proxy] Shutting down...");

    // Stop ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Clean up all sessions
    for (const sessionId of this.sessions.keys()) {
      this.cleanupSession(sessionId);
    }

    // Close WebSocket server
    this.wss.close();
  }
}
