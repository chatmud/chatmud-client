/**
 * MCP status package handler.
 *
 * Handles dns-com-awns-status messages from the server, which provide
 * a status text string for display in the client's status bar.
 */

import { mcpService } from '../mcp-service';
import { statusState } from '../../state/status.svelte';

export function registerStatusPackage(): void {
  mcpService.registerHandler('dns-com-awns-status', (msg) => {
    statusState.statusText = msg.keyValues.get('text') ?? '';
  });
}
