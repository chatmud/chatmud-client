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
import { statusState } from '../../state/status.svelte';
import { connectionState } from '../../state/connection.svelte';

const PING_INTERVAL = 30_000;

let pingTimer: ReturnType<typeof setInterval> | null = null;

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
 * Send a ping to the server. Records the send time so we can calculate
 * latency when the reply arrives.
 */
export function sendPing(): void {
  if (!connectionState.isConnected) return;
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
}
