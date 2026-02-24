import express from "express";
import { createServer } from "http";
import { readFileSync } from "fs";
import path from "path";
import { MudProxy } from "./proxy.js";
import { validateConfig, LIMITS } from "./config.js";
import type { ProxyConfig } from "./types.js";

// Read proxy version from package.json
const proxyPkg = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
const PROXY_VERSION = proxyPkg.version as string;
const COMMIT_SHA = process.env.COMMIT_SHA || "dev";

// Configuration from environment variables with defaults and validation
const rawConfig = {
  port: parseInt(process.env.PORT || "3001", 10),
  upstreamUrl: process.env.UPSTREAM_URL || "tls://chatmud.com:7443",
  persistenceTimeout: parseInt(
    process.env.PERSISTENCE_TIMEOUT_MS || String(LIMITS.PERSISTENCE_TIMEOUT.DEFAULT),
    10
  ),
  maxBufferLines: parseInt(
    process.env.MAX_BUFFER_LINES || String(LIMITS.BUFFER_LINES.DEFAULT),
    10
  ),
  useProxyProtocol: process.env.USE_PROXY_PROTOCOL === "true",
  rejectUnauthorizedUpstream: process.env.UPSTREAM_REJECT_UNAUTHORIZED === "true",
};

// Apply validation
const config: ProxyConfig = {
  port: rawConfig.port,
  upstreamUrl: rawConfig.upstreamUrl,
  persistenceTimeout: validateConfig(
    rawConfig.persistenceTimeout,
    LIMITS.PERSISTENCE_TIMEOUT,
    "PERSISTENCE_TIMEOUT_MS"
  ),
  maxBufferLines: validateConfig(
    rawConfig.maxBufferLines,
    LIMITS.BUFFER_LINES,
    "MAX_BUFFER_LINES"
  ),
  useProxyProtocol: rawConfig.useProxyProtocol,
  rejectUnauthorizedUpstream: rawConfig.rejectUnauthorizedUpstream,
};

// Create Express app
const app = express();

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Stats endpoint
let proxy: MudProxy | null = null;
app.get("/stats", (_req, res) => {
  if (proxy) {
    const stats = proxy.getStats();
    res.json({
      version: PROXY_VERSION,
      commit: COMMIT_SHA,
      activeSessions: stats.active,
      persistedSessions: stats.persisted,
      config: {
        upstreamUrl: config.upstreamUrl,
        useProxyProtocol: config.useProxyProtocol,
        persistenceTimeout: config.persistenceTimeout,
        persistenceTimeoutHuman: config.persistenceTimeout === 0
          ? "disconnect immediately"
          : `${config.persistenceTimeout / 1000}s`,
        maxBufferLines: config.maxBufferLines,
        maxBufferSizeBytes: 10485760, // Hard-coded 10MB limit
      },
    });
  } else {
    res.status(503).json({ error: "Proxy not initialized" });
  }
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket proxy
proxy = new MudProxy(server, config);

// Start server
server.listen(config.port, () => {
  console.log(`[Server] ChatMUD Proxy Server running on port ${config.port}`);
  console.log(`[Server] WebSocket proxy available at: ws://localhost:${config.port}/ws`);
  console.log(`[Server] Health check: http://localhost:${config.port}/health`);
  console.log(`[Server] Stats: http://localhost:${config.port}/stats`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("\n[Server] Received shutdown signal, closing gracefully...");

  if (proxy) {
    proxy.shutdown();
  }

  server.close(() => {
    console.log("[Server] HTTP server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error("[Server] Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
