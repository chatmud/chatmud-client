/**
 * MCP negotiate package handler.
 *
 * Handles mcp-negotiate-can and mcp-negotiate-end messages from the server.
 * The server sends negotiate-can for each package it supports, allowing
 * us to track which packages are available for use.
 */

import { mcpService } from '../mcp-service';
import { mcpState } from '../../state/mcp.svelte';
import type { McpParsedMessage, McpPackageDefinition } from '../../types/mcp';

const negotiationCompleteCallbacks: (() => void)[] = [];

/** Register a callback to be invoked when MCP negotiation completes. */
export function onNegotiationComplete(cb: () => void): void {
  negotiationCompleteCallbacks.push(cb);
}

export function registerNegotiatePackage(): void {
  mcpService.registerHandler('mcp-negotiate-can', (msg: McpParsedMessage) => {
    const pkg: McpPackageDefinition = {
      name: msg.keyValues.get('package') ?? '',
      minVersion: msg.keyValues.get('min-version') ?? '1.0',
      maxVersion: msg.keyValues.get('max-version') ?? '1.0',
    };

    if (pkg.name) {
      mcpState.serverPackages = new Map([...mcpState.serverPackages, [pkg.name, pkg]]);
    }
  });

  mcpService.registerHandler('mcp-negotiate-end', () => {
    mcpState.negotiationComplete = true;
    for (const cb of negotiationCompleteCallbacks) cb();
  });
}
