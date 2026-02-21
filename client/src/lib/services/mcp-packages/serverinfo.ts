/**
 * MCP server info package handler.
 *
 * Handles dns-com-awns-serverinfo messages from the server, which provide
 * informational URLs (help pages, policy documents, etc.).
 */

import { mcpService } from '../mcp-service';
import { statusState } from '../../state/status.svelte';

export function registerServerInfoPackage(): void {
  mcpService.registerHandler('dns-com-awns-serverinfo', (msg) => {
    // Server sends us info URLs as key-value pairs.
    // Store all of them except internal MCP keys.
    for (const [key, value] of msg.keyValues) {
      if (key !== '_data-tag') {
        statusState.serverInfoUrls = new Map([...statusState.serverInfoUrls, [key, value]]);
      }
    }
  });
}

/**
 * Request server info URLs from the server.
 */
export function requestServerInfo(): void {
  mcpService.sendMessage('dns-com-awns-serverinfo-get', new Map());
}
