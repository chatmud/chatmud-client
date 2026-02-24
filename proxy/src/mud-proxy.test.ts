import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createServer, type Server } from "http";
import * as net from "net";
import { WebSocket } from "ws";
import { MudProxy } from "./proxy.js";
import type { ProxyConfig } from "./types.js";

// Suppress proxy console output during tests
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Helper: create a TCP server that the proxy can connect to as "upstream"
 */
function createMockUpstream(): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      resolve({ server, port: addr.port });
    });
  });
}

/**
 * Helper: wait for a socket connection on the upstream server
 */
function waitForUpstreamConnection(
  upstream: net.Server
): Promise<net.Socket> {
  return new Promise((resolve) => {
    upstream.once("connection", resolve);
  });
}

/**
 * Parse a proxy control message from raw WebSocket data.
 * Returns null if it's not a control message.
 */
function parseProxyMessage(
  data: Buffer | ArrayBuffer | Buffer[]
): Record<string, unknown> | null {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
  if (buf[0] === 0x00) {
    return JSON.parse(buf.slice(1).toString());
  }
  return null;
}

/**
 * Helper: connect a WebSocket client to the proxy and wait for the initial
 * proxy message (session or reconnected). Registers the message handler
 * BEFORE the connection opens so the first message is never missed.
 */
function connectClient(
  port: number,
  params?: Record<string, string>
): Promise<{
  ws: WebSocket;
  message: Record<string, unknown>;
}> {
  return new Promise((resolve, reject) => {
    const query = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws${query}`);

    // Register message handler immediately so it's in place before "open" fires
    ws.on("message", function handler(data: Buffer) {
      const msg = parseProxyMessage(data);
      if (msg && (msg.type === "session" || msg.type === "reconnected")) {
        ws.removeListener("message", handler);
        resolve({ ws, message: msg });
      }
    });

    ws.once("error", reject);
  });
}

/**
 * Helper: wait for the next proxy control message of a given type
 */
function waitForProxyMessage(
  ws: WebSocket,
  type: string,
  timeoutMs = 3000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener("message", handler);
      reject(new Error(`Timed out waiting for "${type}" proxy message after ${timeoutMs}ms`));
    }, timeoutMs);
    const handler = (data: Buffer) => {
      const msg = parseProxyMessage(data);
      if (msg && msg.type === type) {
        clearTimeout(timer);
        ws.removeListener("message", handler);
        resolve(msg);
      }
    };
    ws.on("message", handler);
  });
}

/**
 * Helper: wait for the next raw (non-control) message
 */
function waitForRawMessage(ws: WebSocket, timeoutMs = 3000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener("message", handler);
      reject(new Error(`Timed out waiting for raw message after ${timeoutMs}ms`));
    }, timeoutMs);
    const handler = (data: Buffer) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as unknown as ArrayBuffer);
      if (buf[0] !== 0x00) {
        clearTimeout(timer);
        ws.removeListener("message", handler);
        resolve(buf);
      }
    };
    ws.on("message", handler);
  });
}

/**
 * Helper: send a proxy control message from the client
 */
function sendControlMessage(
  ws: WebSocket,
  message: Record<string, unknown>
): void {
  const payload = JSON.stringify(message);
  const buf = Buffer.alloc(1 + payload.length);
  buf[0] = 0x00;
  buf.write(payload, 1);
  ws.send(buf);
}

/**
 * Helper: close websocket and wait for it to fully close
 */
function closeWs(ws: WebSocket, code?: number): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.once("close", () => resolve());
    ws.close(code);
  });
}

/**
 * Helper: poll a condition until it's true, with timeout
 */
async function waitUntil(
  fn: () => boolean,
  timeoutMs = 2000,
  intervalMs = 10
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!fn()) {
    if (Date.now() > deadline) {
      throw new Error(`waitUntil timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// ─────────────────────────────────────────────────────────────────────

describe("MudProxy integration", () => {
  let httpServer: Server;
  let proxy: MudProxy;
  let upstream: net.Server;
  let upstreamPort: number;
  let proxyPort: number;

  beforeEach(async () => {
    // Create mock upstream TCP server
    const mock = await createMockUpstream();
    upstream = mock.server;
    upstreamPort = mock.port;

    // Create HTTP server + proxy
    httpServer = createServer();

    const config: ProxyConfig = {
      port: 0,
      upstreamUrl: `tcp://127.0.0.1:${upstreamPort}`,
      persistenceTimeout: 5000,
      maxBufferLines: 100,
      useProxyProtocol: false,
      rejectUnauthorizedUpstream: false,
    };

    proxy = new MudProxy(httpServer, config);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    proxyPort = (httpServer.address() as net.AddressInfo).port;
  });

  afterEach(async () => {
    proxy.shutdown();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  // ── getStats ────────────────────────────────────────────────────

  describe("getStats", () => {
    it("returns zero counts initially", () => {
      const stats = proxy.getStats();
      expect(stats.active).toBe(0);
      expect(stats.persisted).toBe(0);
    });

    it("counts active sessions", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      await connPromise;

      const stats = proxy.getStats();
      expect(stats.active).toBe(1);
      expect(stats.persisted).toBe(0);

      await closeWs(ws, 1000);
    });
  });

  // ── Session creation ────────────────────────────────────────────

  describe("session creation", () => {
    it("sends session message with ID on connect", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws, message: msg } = await connectClient(proxyPort);
      await connPromise;

      expect(msg.type).toBe("session");
      expect(msg.sessionId).toBeDefined();
      expect(typeof msg.sessionId).toBe("string");
      expect((msg.sessionId as string).length).toBe(24);

      await closeWs(ws, 1000);
    });

    it("includes config in session message", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws, message: msg } = await connectClient(proxyPort);
      await connPromise;

      expect(msg.config).toBeDefined();
      const config = msg.config as Record<string, number>;
      expect(config.persistenceTimeout).toBe(5000);
      expect(config.maxBufferLines).toBe(100);

      await closeWs(ws, 1000);
    });
  });

  // ── Data forwarding ─────────────────────────────────────────────

  describe("data forwarding", () => {
    it("forwards upstream data to client", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      const upstreamSocket = await connPromise;

      const rawPromise = waitForRawMessage(ws);
      upstreamSocket.write("Hello from upstream\r\n");
      const data = await rawPromise;
      expect(data.toString()).toBe("Hello from upstream\r\n");

      await closeWs(ws, 1000);
    });

    it("forwards client data to upstream", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      const upstreamSocket = await connPromise;

      const dataPromise = new Promise<Buffer>((resolve) => {
        upstreamSocket.once("data", resolve);
      });

      ws.send("Hello from client\r\n");
      const data = await dataPromise;
      expect(data.toString()).toBe("Hello from client\r\n");

      await closeWs(ws, 1000);
    });
  });

  // ── Session reconnection ────────────────────────────────────────

  describe("session reconnection", () => {
    it("reconnects to existing session with sessionId", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws: ws1, message: sessionMsg } = await connectClient(proxyPort);
      await connPromise;
      const sessionId = sessionMsg.sessionId as string;

      // Disconnect abnormally (not code 1000) to preserve session
      await closeWs(ws1, 4001);
      await waitUntil(() => proxy.getStats().persisted === 1);

      // Reconnect with sessionId
      const { ws: ws2, message: reconnMsg } = await connectClient(proxyPort, {
        sessionId,
      });

      expect(reconnMsg.type).toBe("reconnected");
      expect(reconnMsg.sessionId).toBe(sessionId);

      await closeWs(ws2, 1000);
    });
  });

  // ── Buffer replay ──────────────────────────────────────────────

  describe("buffer replay", () => {
    it("buffers messages during disconnect and replays on reconnect", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws: ws1, message: sessionMsg } = await connectClient(proxyPort);
      const upstreamSocket = await connPromise;
      const sessionId = sessionMsg.sessionId as string;

      // Disconnect abnormally to preserve session
      await closeWs(ws1, 4001);
      await waitUntil(() => proxy.getStats().persisted === 1);

      // Send data from upstream while client is disconnected
      // Use separate ticks to avoid TCP coalescing into one buffer entry
      upstreamSocket.write("buffered line 1\r\n");
      await new Promise((r) => setTimeout(r, 20));
      upstreamSocket.write("buffered line 2\r\n");
      await new Promise((r) => setTimeout(r, 20));

      // Reconnect — register all handlers BEFORE connecting to avoid race
      const query = new URLSearchParams({ sessionId }).toString();
      const ws2 = new WebSocket(
        `ws://127.0.0.1:${proxyPort}/ws?${query}`
      );

      const rawMessages: Buffer[] = [];
      const result = await new Promise<{
        reconnMsg: Record<string, unknown>;
        replayCount: number;
      }>((resolve) => {
        let reconnMsg: Record<string, unknown> | null = null;
        ws2.on("message", function handler(data: Buffer) {
          const msg = parseProxyMessage(data);
          if (msg) {
            if (msg.type === "reconnected") {
              reconnMsg = msg;
            } else if (msg.type === "bufferReplayComplete") {
              ws2.removeListener("message", handler);
              resolve({
                reconnMsg: reconnMsg!,
                replayCount: msg.count as number,
              });
            }
          } else {
            const buf = Buffer.isBuffer(data)
              ? data
              : Buffer.from(data as unknown as ArrayBuffer);
            rawMessages.push(buf);
          }
        });
      });

      expect(result.reconnMsg.bufferedCount).toBe(2);
      expect(result.replayCount).toBe(2);
      expect(rawMessages.length).toBe(2);
      expect(rawMessages[0].toString()).toBe("buffered line 1\r\n");
      expect(rawMessages[1].toString()).toBe("buffered line 2\r\n");

      await closeWs(ws2, 1000);
    });
  });

  // ── Config update ──────────────────────────────────────────────

  describe("config update", () => {
    it("accepts updateConfig and sends configUpdated", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      await connPromise;

      const configPromise = waitForProxyMessage(ws, "configUpdated");
      sendControlMessage(ws, {
        type: "updateConfig",
        persistenceTimeout: 30000,
        maxBufferLines: 200,
      });

      const msg = await configPromise;
      expect(msg.type).toBe("configUpdated");
      const config = msg.config as Record<string, number>;
      expect(config.persistenceTimeout).toBe(30000);
      expect(config.maxBufferLines).toBe(200);

      await closeWs(ws, 1000);
    });

    it("clamps out-of-range config values", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      await connPromise;

      const configPromise = waitForProxyMessage(ws, "configUpdated");
      sendControlMessage(ws, {
        type: "updateConfig",
        persistenceTimeout: 999999999,
        maxBufferLines: 1,
      });

      const msg = await configPromise;
      const config = msg.config as Record<string, number>;
      expect(config.persistenceTimeout).toBe(43200000); // MAX
      expect(config.maxBufferLines).toBe(10); // MIN

      await closeWs(ws, 1000);
    });
  });

  // ── Client disconnect behavior ─────────────────────────────────

  describe("client disconnect behavior", () => {
    it("cleans up immediately on code 1000 (intentional)", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      await connPromise;

      await closeWs(ws, 1000);
      await waitUntil(() => {
        const s = proxy.getStats();
        return s.active === 0 && s.persisted === 0;
      });

      const stats = proxy.getStats();
      expect(stats.active).toBe(0);
      expect(stats.persisted).toBe(0);
    });

    it("starts persistence on abnormal close", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      await connPromise;

      await closeWs(ws, 4001);
      await waitUntil(() => proxy.getStats().persisted === 1);

      const stats = proxy.getStats();
      expect(stats.persisted).toBe(1);
    });

    it("cleans up immediately when persistenceTimeout is 0", async () => {
      // Need a new proxy with persistenceTimeout: 0
      proxy.shutdown();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));

      httpServer = createServer();
      const config: ProxyConfig = {
        port: 0,
        upstreamUrl: `tcp://127.0.0.1:${upstreamPort}`,
        persistenceTimeout: 0,
        maxBufferLines: 100,
        useProxyProtocol: false,
        rejectUnauthorizedUpstream: false,
      };
      proxy = new MudProxy(httpServer, config);
      await new Promise<void>((resolve) => {
        httpServer.listen(0, "127.0.0.1", () => resolve());
      });
      proxyPort = (httpServer.address() as net.AddressInfo).port;

      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      await connPromise;

      // Abnormal close — but persistence is 0, so should clean up immediately
      await closeWs(ws, 4001);
      await waitUntil(() => {
        const s = proxy.getStats();
        return s.active === 0 && s.persisted === 0;
      });

      const stats = proxy.getStats();
      expect(stats.active).toBe(0);
      expect(stats.persisted).toBe(0);
    });
  });

  // ── Buffer eviction ─────────────────────────────────────────

  describe("buffer eviction", () => {
    it("evicts oldest messages when maxBufferLines is exceeded", async () => {
      // Create proxy with minimum buffer limit (LIMITS.BUFFER_LINES.MIN = 10)
      proxy.shutdown();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));

      httpServer = createServer();
      const config: ProxyConfig = {
        port: 0,
        upstreamUrl: `tcp://127.0.0.1:${upstreamPort}`,
        persistenceTimeout: 5000,
        maxBufferLines: 10, // minimum allowed
        useProxyProtocol: false,
        rejectUnauthorizedUpstream: false,
      };
      proxy = new MudProxy(httpServer, config);
      await new Promise<void>((resolve) => {
        httpServer.listen(0, "127.0.0.1", () => resolve());
      });
      proxyPort = (httpServer.address() as net.AddressInfo).port;

      const connPromise = waitForUpstreamConnection(upstream);
      const { ws: ws1, message: sessionMsg } = await connectClient(proxyPort);
      const upstreamSocket = await connPromise;
      const sessionId = sessionMsg.sessionId as string;

      // Disconnect to start buffering
      await closeWs(ws1, 4001);
      await waitUntil(() => proxy.getStats().persisted === 1);

      // Send 14 messages (exceeds maxBufferLines of 10)
      const totalMessages = 14;
      for (let i = 1; i <= totalMessages; i++) {
        upstreamSocket.write(`line ${i}\r\n`);
        await new Promise((r) => setTimeout(r, 15));
      }

      // Reconnect and collect messages
      const query = new URLSearchParams({ sessionId }).toString();
      const ws2 = new WebSocket(`ws://127.0.0.1:${proxyPort}/ws?${query}`);

      const rawMessages: Buffer[] = [];
      const result = await new Promise<{
        reconnMsg: Record<string, unknown>;
      }>((resolve) => {
        let reconnMsg: Record<string, unknown> | null = null;
        ws2.on("message", function handler(data: Buffer) {
          const msg = parseProxyMessage(data);
          if (msg) {
            if (msg.type === "reconnected") {
              reconnMsg = msg;
            } else if (msg.type === "bufferReplayComplete") {
              ws2.removeListener("message", handler);
              resolve({ reconnMsg: reconnMsg! });
            }
          } else {
            rawMessages.push(
              Buffer.isBuffer(data)
                ? data
                : Buffer.from(data as unknown as ArrayBuffer)
            );
          }
        });
      });

      // Only the last 10 messages should remain (oldest 4 evicted)
      expect(result.reconnMsg.bufferedCount).toBe(10);
      expect(rawMessages.length).toBe(10);
      // First replayed message should be "line 5" (lines 1-4 evicted)
      expect(rawMessages[0].toString()).toBe("line 5\r\n");
      expect(rawMessages[9].toString()).toBe("line 14\r\n");

      await closeWs(ws2, 1000);
    });
  });

  // ── Upstream disconnection ────────────────────────────────────

  describe("upstream disconnection", () => {
    it("cleans up session when upstream closes", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      const upstreamSocket = await connPromise;

      // Close the upstream connection
      upstreamSocket.destroy();

      // Wait for the client WS to close (proxy should close it)
      await new Promise<void>((resolve) => {
        ws.once("close", () => resolve());
      });

      await waitUntil(() => {
        const s = proxy.getStats();
        return s.active === 0 && s.persisted === 0;
      });

      const stats = proxy.getStats();
      expect(stats.active).toBe(0);
      expect(stats.persisted).toBe(0);
    });

    it("notifies client with close code 1000 when upstream closes", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      const upstreamSocket = await connPromise;

      const closePromise = new Promise<{ code: number; reason: string }>(
        (resolve) => {
          ws.once("close", (code, reason) => {
            resolve({ code, reason: reason?.toString() || "" });
          });
        }
      );

      upstreamSocket.destroy();
      const { code } = await closePromise;
      expect(code).toBe(1000);
    });
  });

  // ── shutdown ──────────────────────────────────────────────────

  describe("shutdown", () => {
    it("cleans up all sessions", async () => {
      const connPromise = waitForUpstreamConnection(upstream);
      const { ws } = await connectClient(proxyPort);
      await connPromise;

      proxy.shutdown();
      await waitUntil(() => {
        const s = proxy.getStats();
        return s.active === 0 && s.persisted === 0;
      });

      const stats = proxy.getStats();
      expect(stats.active).toBe(0);
      expect(stats.persisted).toBe(0);
    });
  });
});
