/**
 * MCP ping package handler.
 *
 * Handles dns-com-awns-ping for server-initiated pings (we reply immediately)
 * and dns-com-awns-ping-reply for measuring round-trip latency when we
 * initiate a ping.
 *
 * Periodically sends client-initiated pings for latency measurement.
 *
 * Zombie detection uses the proxy heartbeat rather than replies to
 * client-initiated MCP pings, so it works even when the MUD doesn't
 * support bidirectional pings.
 */

import { mcpService } from '../mcp-service';
import { wsService } from '../websocket';
import { statusState } from '../../state/status.svelte';
import { connectionState } from '../../state/connection.svelte';
import { mcpState } from '../../state/mcp.svelte';

const PING_INTERVAL = 30_000; // must match HEARTBEAT_INTERVAL_MS in proxy/src/proxy.ts
const PING_TIMEOUT = 15_000;

let pingTimer: ReturnType<typeof setInterval> | null = null;
let lastHeartbeatAt: number | null = null;

export function registerPingPackage(): void {
  mcpService.registerHandler('dns-com-awns-ping', () => {
    // Server pings us; reply immediately
    mcpService.sendMessage('dns-com-awns-ping-reply', new Map());
  });

  mcpService.registerHandler('dns-com-awns-ping-reply', () => {
    // Response to a ping we initiated - calculate latency
    if (statusState.lastPingSent != null) {
      const raw = performance.now() - statusState.lastPingSent;
      statusState.pingLatency = raw < 10 ? Math.round(raw * 10) / 10 : Math.round(raw);
      statusState.lastPingSent = null;
    }
  });
}

/**
 * Record a proxy heartbeat. Called by the onProxy handler whenever the
 * proxy sends a heartbeat message. Used for zombie detection.
 */
export function recordHeartbeat(): void {
  lastHeartbeatAt = performance.now();
}

/**
 * Send a ping to the server. Records the send time so we can calculate
 * latency when the reply arrives.
 */
export function sendPing(): void {
  if (!connectionState.isConnected) return;
  if (!mcpState.authKey) return; // MCP handshake not yet complete; ping would be dropped
  statusState.lastPingSent = performance.now();
  mcpService.sendMessage('dns-com-awns-ping', new Map());
}

/**
 * Start periodic pinging. Called when the connection is established.
 */
export function startPingTimer(): void {
  stopPingTimer();
  lastHeartbeatAt = null; // reset baseline; zombie check requires a fresh heartbeat
  sendPing();
  pingTimer = setInterval(() => {
    sendPing();
    // Zombie detection: if the proxy heartbeat has gone stale the connection
    // is dead. Only check once we have a baseline (first heartbeat received).
    if (lastHeartbeatAt !== null && performance.now() - lastHeartbeatAt > PING_INTERVAL + PING_TIMEOUT) {
      stopPingTimer();
      wsService.forceReconnect();
    }
  }, PING_INTERVAL);
}

/**
 * Stop periodic pinging. Called on disconnect.
 */
export function stopPingTimer(): void {
  if (pingTimer !== null) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  lastHeartbeatAt = null;
}
