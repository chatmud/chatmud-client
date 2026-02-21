/**
 * MCP display URL package handler.
 *
 * Handles dns-com-awns-displayurl messages from the server, which request
 * the client to open a URL (typically in a new browser tab).
 */

import { mcpService } from '../mcp-service';

export function registerDisplayUrlPackage(): void {
  mcpService.registerHandler('dns-com-awns-displayurl', (msg) => {
    const url = msg.keyValues.get('url');
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  });
}
