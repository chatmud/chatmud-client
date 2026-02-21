import type { McpPackageDefinition, MultilineMessage } from '../types/mcp';

class McpState {
  authKey = $state<string | null>(null);
  serverVersion = $state<string | null>(null);
  serverPackages = $state<Map<string, McpPackageDefinition>>(new Map());
  clientPackages = $state<Map<string, McpPackageDefinition>>(new Map());
  activeMultilines = $state<Map<string, MultilineMessage>>(new Map());
  negotiationComplete = $state(false);

  readonly hasPackage = $derived((name: string) => this.serverPackages.has(name));

  reset(): void {
    this.authKey = null;
    this.serverVersion = null;
    this.serverPackages = new Map();
    this.clientPackages = new Map();
    this.activeMultilines = new Map();
    this.negotiationComplete = false;
  }
}

export const mcpState = new McpState();
