/**
 * MCP ping package handler.
 *
 * Handles dns-com-awns-ping for server-initiated pings (we reply immediately)
 * and dns-com-awns-ping-reply for measuring round-trip latency when we
 * initiate a ping.
 *
 * Periodically sends client-initiated pings to keep latency displayed in
 * the status bar.
 */

import { mcpService } from '../mcp-service';
import { wsService } from '../websocket';
import { statusState } from '../../state/status.svelte';
import { connectionState } from '../../state/connection.svelte';
import { mcpState } from '../../state/mcp.svelte';

const PING_INTERVAL = 30_000;
const PING_TIMEOUT = 15_000;

let pingTimer: ReturnType<typeof setInterval> | null = null;
let pingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

export function registerPingPackage(): void {
  mcpService.registerHandler('dns-com-awns-ping', () => {
    // Server pings us; reply immediately
    mcpService.sendMessage('dns-com-awns-ping-reply', new Map());
  });

  mcpService.registerHandler('dns-com-awns-ping-reply', () => {
    // Pong received — cancel zombie detection timeout
    if (pingTimeoutTimer !== null) {
      clearTimeout(pingTimeoutTimer);
      pingTimeoutTimer = null;
    }
    // Response to a ping we initiated - calculate latency
    if (statusState.lastPingSent != null) {
      const raw = performance.now() - statusState.lastPingSent;
      statusState.pingLatency = raw < 10 ? Math.round(raw * 10) / 10 : Math.round(raw);
      statusState.lastPingSent = null;
    }
  });
}

/**
 * Send a ping to the server. Records the send time so we can calculate
 * latency when the reply arrives.
 */
export function sendPing(): void {
  if (!connectionState.isConnected) return;
  if (!mcpState.authKey) return; // MCP handshake not yet complete; ping would be dropped
  // Start zombie-detection timeout: if no pong within PING_TIMEOUT, force reconnect
  if (pingTimeoutTimer !== null) {
    clearTimeout(pingTimeoutTimer);
  }
  pingTimeoutTimer = setTimeout(() => {
    pingTimeoutTimer = null;
    wsService.forceReconnect();
  }, PING_TIMEOUT);
  statusState.lastPingSent = performance.now();
  mcpService.sendMessage('dns-com-awns-ping', new Map());
}

/**
 * Start periodic pinging. Called when the connection is established.
 */
export function startPingTimer(): void {
  stopPingTimer();
  sendPing();
  pingTimer = setInterval(sendPing, PING_INTERVAL);
}

/**
 * Stop periodic pinging. Called on disconnect.
 */
export function stopPingTimer(): void {
  if (pingTimer !== null) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (pingTimeoutTimer !== null) {
    clearTimeout(pingTimeoutTimer);
    pingTimeoutTimer = null;
  }
}
