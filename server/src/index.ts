import express from "express";
import { createServer } from "http";
import path from "path";
import { MudProxy } from "./proxy.js";
import type { ProxyConfig } from "./types.js";

// Configuration limits
const LIMITS = {
  PERSISTENCE_TIMEOUT: {
    MIN: 0,        // 0 = disconnect immediately
    MAX: 43200000, // 12 hours in milliseconds
    DEFAULT: 300000 // 5 minutes
  },
  BUFFER_LINES: {
    MIN: 10,
    MAX: 10000,
    DEFAULT: 1000
  }
};

/**
 * Validate and clamp a numeric config value to its limits
 */
function validateConfig(
  value: number,
  limits: { MIN: number; MAX: number; DEFAULT: number },
  name: string
): number {
  if (isNaN(value)) {
    console.warn(`[Config] Invalid ${name}, using default: ${limits.DEFAULT}`);
    return limits.DEFAULT;
  }

  if (value < limits.MIN) {
    console.warn(
      `[Config] ${name} (${value}) below minimum (${limits.MIN}), clamping to minimum`
    );
    return limits.MIN;
  }

  if (value > limits.MAX) {
    console.warn(
      `[Config] ${name} (${value}) above maximum (${limits.MAX}), clamping to maximum`
    );
    return limits.MAX;
  }

  return value;
}

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
};

// Create Express app
const app = express();

// Serve static files from the public directory (React client build)
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));

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
      activeSessions: stats.active,
      persistedSessions: stats.persisted,
      config: {
        upstreamUrl: config.upstreamUrl,
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

// Catch-all route to serve React app for client-side routing
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket proxy
proxy = new MudProxy(server, config);

// Start server
server.listen(config.port, () => {
  console.log(`[Server] ChatMUD Proxy Server running on port ${config.port}`);
  console.log(`[Server] Static files served from: ${publicPath}`);
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
