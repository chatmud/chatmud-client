/**
 * MCP client package handler (dns-com-vmoo-client).
 *
 * Handles the client-info exchange with the server and the
 * disconnect notification message.
 */

import { mcpService } from '../mcp-service';
import { CLIENT_NAME, CLIENT_VERSION } from '../../constants';

export function registerClientPackage(): void {
  mcpService.registerHandler('dns-com-vmoo-client-disconnect', (msg) => {
    // The server is about to disconnect us and is telling us not to auto-reconnect.
    // The actual disconnection handling is done by the connection manager.
  });
}

/**
 * Send client identification info to the server.
 *
 * This tells the server what client we are, enabling it to adjust behavior
 * for client-specific capabilities or work around known bugs.
 */
export function sendClientInfo(): void {
  const kv = new Map<string, string>();
  kv.set('name', CLIENT_NAME);
  kv.set('text-version', CLIENT_VERSION);
  kv.set('internal-version', '1');
  kv.set('reg-id', '0');
  kv.set('flags', 'p');
  mcpService.sendMessage('dns-com-vmoo-client-info', kv);
}

/**
 * Send the current screen size to the server.
 *
 * Should be sent after connection and whenever the main text area
 * dimensions change significantly.
 */
export function sendScreenSize(cols: number, rows: number): void {
  const kv = new Map<string, string>();
  kv.set('cols', String(cols));
  kv.set('rows', String(rows));
  mcpService.sendMessage('dns-com-vmoo-client-screensize', kv);
}
