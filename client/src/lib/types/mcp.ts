/** Parsed key-value pair from an MCP message */
export interface McpKeyValue {
  key: string;
  value: string;
}

/** Parsed MCP message */
export interface McpParsedMessage {
  name: string;
  authKey: string;
  keyValues: Map<string, string>;
  /** Keys ending with * that expect multiline data */
  multilineKeys: string[];
  /** The _data-tag value if present */
  dataTag?: string;
}

/** Server or client package definition from mcp-negotiate-can */
export interface McpPackageDefinition {
  name: string;
  minVersion: string;
  maxVersion: string;
}

/** Active multiline message being assembled */
export interface MultilineMessage {
  tag: string;
  /** The original message that started this multiline */
  message: McpParsedMessage;
  /** Accumulated multiline data keyed by field name */
  data: Map<string, string[]>;
}

/** Result of processing a line through MCP */
export type McpLineResult =
  | { type: 'display'; text: string }
  | { type: 'mcp'; handled: true };
