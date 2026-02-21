/**
 * Main MCP (Mud Client Protocol) service.
 *
 * Processes text lines for MCP protocol messages per the MCP/2.1 specification.
 * Handles the initial handshake, key-value parsing, multiline continuation,
 * and dispatches parsed messages to registered package handlers.
 *
 * MCP line formats:
 *   #$#mcp version: <v> to: <v>           - Handshake from server
 *   #$#<name> <authKey> <key>: <value> ... - Normal message
 *   #$"<text>                              - Quoted text (strip prefix, display)
 *   #$#* <tag> <key>: <value>              - Multiline continuation
 *   #$#: <tag>                             - Multiline end
 */

import {
  MCP_PREFIX,
  MCP_QUOTE_PREFIX,
  MCP_MULTILINE_PREFIX,
  MCP_MULTILINE_END_PREFIX,
} from '../constants';
import type { McpParsedMessage, McpLineResult, MultilineMessage } from '../types/mcp';
import { mcpState } from '../state/mcp.svelte';
import { generateId } from '../utils/generate-id';

/** Client packages we advertise during negotiation. */
const CLIENT_PACKAGES = [
  { name: 'mcp-negotiate', minVersion: '1.0', maxVersion: '2.0' },
  { name: 'dns-org-mud-moo-simpleedit', minVersion: '1.0', maxVersion: '1.0' },
  { name: 'dns-com-awns-status', minVersion: '1.0', maxVersion: '1.0' },
  { name: 'dns-com-awns-ping', minVersion: '1.0', maxVersion: '1.0' },
  { name: 'dns-com-awns-displayurl', minVersion: '1.0', maxVersion: '1.0' },
  { name: 'dns-com-awns-serverinfo', minVersion: '1.0', maxVersion: '1.0' },
  { name: 'dns-com-vmoo-userlist', minVersion: '1.0', maxVersion: '1.1' },
  { name: 'dns-com-vmoo-client', minVersion: '1.0', maxVersion: '1.0' },
];

class McpService {
  private messageHandlers = new Map<string, (msg: McpParsedMessage) => void>();
  private sendRaw: ((data: Uint8Array) => void) | null = null;

  /**
   * Set the raw send function used to transmit bytes to the server.
   * Typically bound to the WebSocket service's sendRaw method.
   */
  setSendRaw(fn: (data: Uint8Array) => void): void {
    this.sendRaw = fn;
  }

  /**
   * Register a handler for a specific MCP message name.
   * Package registration modules call this during initialization.
   */
  registerHandler(messageName: string, handler: (msg: McpParsedMessage) => void): void {
    this.messageHandlers.set(messageName, handler);
  }

  /**
   * Main entry point: process a single text line received from the server.
   *
   * Returns either:
   * - { type: 'display', text } for lines that should be shown to the user
   * - { type: 'mcp', handled: true } for lines consumed by the MCP layer
   */
  processLine(line: string): McpLineResult {
    // MCP quote prefix: #$" - strip it and display the rest
    if (line.startsWith(MCP_QUOTE_PREFIX)) {
      return { type: 'display', text: line.slice(MCP_QUOTE_PREFIX.length) };
    }

    // Multiline continuation: #$#* <tag> <key>: <value>
    if (line.startsWith(MCP_MULTILINE_PREFIX)) {
      this.handleMultilineContinuation(line);
      return { type: 'mcp', handled: true };
    }

    // Multiline end: #$#: <tag>
    if (line.startsWith(MCP_MULTILINE_END_PREFIX)) {
      this.handleMultilineEnd(line);
      return { type: 'mcp', handled: true };
    }

    // MCP message: #$#<name> ...
    if (line.startsWith(MCP_PREFIX)) {
      // Check for the initial handshake (no auth key yet)
      if (line.startsWith('#$#mcp ')) {
        this.handleHandshake(line);
        return { type: 'mcp', handled: true };
      }

      const parsed = this.parseMcpMessage(line);
      if (parsed) {
        this.dispatch(parsed);
      }
      return { type: 'mcp', handled: true };
    }

    // Not an MCP line - pass through for display
    return { type: 'display', text: line };
  }

  /**
   * Send an MCP message to the server.
   *
   * Format: #$#<name> <authKey> <key>: <value> ...
   *
   * For multiline data: sends the initial message with a _data-tag and
   * empty multiline key placeholders, then sends continuation lines
   * for each data line, followed by an end marker.
   */
  sendMessage(
    name: string,
    keyValues: Map<string, string>,
    multilineData?: Map<string, string[]>,
  ): void {
    if (!mcpState.authKey) {
      console.warn('[MCP] Cannot send message: no auth key');
      return;
    }

    let line = `${MCP_PREFIX}${name} ${mcpState.authKey}`;

    // Append simple key-value pairs
    for (const [key, value] of keyValues) {
      line += ` ${key}: ${this.quoteValue(value)}`;
    }

    // Handle multiline data
    if (multilineData && multilineData.size > 0) {
      const tag = generateId();
      line += ` _data-tag: ${tag}`;

      // Declare multiline keys with empty placeholder values
      for (const key of multilineData.keys()) {
        line += ` ${key}*: ""`;
      }

      // Send the initial message
      this.sendLine(line);

      // Send continuation lines for each multiline key
      for (const [key, lines] of multilineData) {
        for (const dataLine of lines) {
          this.sendLine(`${MCP_MULTILINE_PREFIX} ${tag} ${key}: ${dataLine}`);
        }
      }

      // Send end marker
      this.sendLine(`${MCP_MULTILINE_END_PREFIX} ${tag}`);
    } else {
      this.sendLine(line);
    }
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  /**
   * Handle the initial MCP handshake line from the server.
   *
   * Format: #$#mcp version: <v> to: <v>
   *
   * Generates an auth key, stores it in state, and responds with
   * mcp-negotiate-can for each client package, then mcp-negotiate-end.
   */
  private handleHandshake(line: string): void {
    // Parse the handshake key-values (no auth key in handshake)
    const afterPrefix = line.slice('#$#mcp '.length);
    const kvs = this.parseKeyValues(afterPrefix);

    const version = kvs.get('version') ?? '2.1';
    const toVersion = kvs.get('to') ?? version;
    mcpState.serverVersion = toVersion;

    // Generate our auth key
    const authKey = generateId();
    mcpState.authKey = authKey;

    // Store our client packages
    const clientPkgs = new Map(
      CLIENT_PACKAGES.map((p) => [p.name, p]),
    );
    mcpState.clientPackages = clientPkgs;

    // Respond with our authentication key
    this.sendLine(`${MCP_PREFIX}mcp authentication-key: ${authKey} version: 2.1 to: 2.1`);

    // Advertise our packages via mcp-negotiate-can
    for (const pkg of CLIENT_PACKAGES) {
      // mcp-negotiate-can does not require auth key per spec (it uses the key we just sent)
      this.sendLine(
        `${MCP_PREFIX}mcp-negotiate-can ${authKey} package: ${pkg.name} min-version: ${pkg.minVersion} max-version: ${pkg.maxVersion}`,
      );
    }

    // Send negotiate-end
    this.sendLine(`${MCP_PREFIX}mcp-negotiate-end ${authKey}`);
  }

  /**
   * Parse a full MCP message line into an McpParsedMessage.
   *
   * Format after #$#: <messageName> <authKey> <key>: <value> <key>: <value> ...
   *
   * Values can be quoted: key: "value with \"escapes\""
   * Keys ending with * are multiline keys.
   * _data-tag: <tag> marks multiline message start.
   */
  private parseMcpMessage(line: string): McpParsedMessage | null {
    const content = line.slice(MCP_PREFIX.length);

    // Tokenize: first token is message name
    let pos = 0;
    const messageName = this.readToken(content, pos);
    if (!messageName) return null;
    pos += messageName.length;

    // Skip whitespace
    while (pos < content.length && content[pos] === ' ') pos++;

    // Second token is auth key
    const authKey = this.readToken(content, pos);
    if (!authKey) return null;
    pos += authKey.length;

    // Parse remaining key-value pairs
    const remaining = content.slice(pos);
    const keyValues = this.parseKeyValues(remaining);

    // Identify multiline keys (those ending with *)
    const multilineKeys: string[] = [];
    for (const key of keyValues.keys()) {
      if (key.endsWith('*')) {
        multilineKeys.push(key.slice(0, -1)); // store without the *
      }
    }

    // Extract data tag
    const dataTag = keyValues.get('_data-tag');

    const msg: McpParsedMessage = {
      name: messageName,
      authKey,
      keyValues,
      multilineKeys,
      dataTag,
    };

    // If this message has a data tag, start tracking multiline data
    if (dataTag && multilineKeys.length > 0) {
      const multiline: MultilineMessage = {
        tag: dataTag,
        message: msg,
        data: new Map(),
      };
      // Initialize empty arrays for each multiline key
      for (const key of multilineKeys) {
        multiline.data.set(key, []);
      }
      mcpState.activeMultilines = new Map([
        ...mcpState.activeMultilines,
        [dataTag, multiline],
      ]);
    }

    return msg;
  }

  /**
   * Handle a multiline continuation line.
   *
   * Format: #$#* <tag> <key>: <value>
   *
   * Appends the value to the matching multiline message's data.
   */
  private handleMultilineContinuation(line: string): void {
    // After "#$#* " parse tag and key: value
    const content = line.slice(MCP_MULTILINE_PREFIX.length).trimStart();

    // Read the tag
    const spaceIdx = content.indexOf(' ');
    if (spaceIdx === -1) return;

    const tag = content.slice(0, spaceIdx);
    const rest = content.slice(spaceIdx + 1);

    // Find the multiline message
    const multiline = mcpState.activeMultilines.get(tag);
    if (!multiline) return;

    // Parse key: value
    const colonIdx = rest.indexOf(':');
    if (colonIdx === -1) return;

    const key = rest.slice(0, colonIdx).trim();
    const value = rest.slice(colonIdx + 1).trimStart();

    // Append to the multiline data
    const existing = multiline.data.get(key);
    if (existing) {
      existing.push(value);
    } else {
      multiline.data.set(key, [value]);
    }

    // For userlist d-lines and similar, dispatch each continuation line
    // immediately to the handler so real-time updates work.
    // The handler gets the original message with the current line's data
    // merged into keyValues for immediate processing.
    const handler = this.messageHandlers.get(multiline.message.name);
    if (handler) {
      // Create a shallow copy of the message with this continuation's data
      const immediateMsg: McpParsedMessage = {
        ...multiline.message,
        keyValues: new Map([[key, value]]),
      };
      handler(immediateMsg);
    }
  }

  /**
   * Handle a multiline end marker.
   *
   * Format: #$#: <tag>
   *
   * Completes the multiline assembly, merges accumulated data into
   * the original message's keyValues, and removes from active tracking.
   * Does NOT re-dispatch since continuation lines were dispatched in real-time.
   */
  private handleMultilineEnd(line: string): void {
    const content = line.slice(MCP_MULTILINE_END_PREFIX.length).trimStart();
    const tag = content.split(' ')[0];

    if (!tag) return;

    // Simply remove from active tracking.
    // Data was already dispatched line-by-line in handleMultilineContinuation.
    const newMultilines = new Map(mcpState.activeMultilines);
    newMultilines.delete(tag);
    mcpState.activeMultilines = newMultilines;
  }

  /**
   * Validate auth key and dispatch the message to its registered handler.
   */
  private dispatch(msg: McpParsedMessage): void {
    // mcp-negotiate-can and mcp-negotiate-end are dispatched even during negotiation
    // Auth key validation
    if (mcpState.authKey && msg.authKey !== mcpState.authKey) {
      // For handshake-related messages, the server may use our key
      // but for safety, skip messages with wrong auth keys
      console.warn(`[MCP] Auth key mismatch for ${msg.name}: expected ${mcpState.authKey}, got ${msg.authKey}`);
      return;
    }

    // If this is a multiline message (has data tag), don't dispatch yet -
    // wait for continuation lines. The message was already registered
    // in activeMultilines by parseMcpMessage.
    if (msg.dataTag && msg.multilineKeys.length > 0) {
      return;
    }

    const handler = this.messageHandlers.get(msg.name);
    if (handler) {
      handler(msg);
    } else {
      console.debug(`[MCP] No handler for message: ${msg.name}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Tokenizer / parser helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse key-value pairs from a string.
   *
   * Format: <key>: <value> <key>: <value> ...
   * Values can be:
   * - Unquoted: read until next space or end of string
   * - Quoted: "value with \"escapes\" and \\\\"
   */
  private parseKeyValues(input: string): Map<string, string> {
    const result = new Map<string, string>();
    let pos = 0;

    // Skip leading whitespace
    while (pos < input.length && input[pos] === ' ') pos++;

    while (pos < input.length) {
      // Read key (up to ':')
      const keyStart = pos;
      while (pos < input.length && input[pos] !== ':') pos++;
      if (pos >= input.length) break;

      const key = input.slice(keyStart, pos).trim();
      pos++; // skip ':'

      // Skip whitespace after colon
      while (pos < input.length && input[pos] === ' ') pos++;

      // Read value
      let value: string;
      if (pos < input.length && input[pos] === '"') {
        // Quoted value
        const [parsed, newPos] = this.readQuotedString(input, pos);
        value = parsed;
        pos = newPos;
      } else {
        // Unquoted value: read until next space or end
        const valueStart = pos;
        while (pos < input.length && input[pos] !== ' ') pos++;
        value = input.slice(valueStart, pos);
      }

      result.set(key, value);

      // Skip whitespace between pairs
      while (pos < input.length && input[pos] === ' ') pos++;
    }

    return result;
  }

  /**
   * Read a quoted string starting at the given position.
   * Handles \" and \\ escape sequences.
   * Returns [parsedString, positionAfterClosingQuote].
   */
  private readQuotedString(input: string, startPos: number): [string, number] {
    let pos = startPos + 1; // skip opening quote
    let result = '';

    while (pos < input.length) {
      const ch = input[pos];

      if (ch === '\\') {
        pos++;
        if (pos < input.length) {
          const escaped = input[pos];
          if (escaped === '"') {
            result += '"';
          } else if (escaped === '\\') {
            result += '\\';
          } else {
            result += escaped;
          }
          pos++;
        }
      } else if (ch === '"') {
        pos++; // skip closing quote
        return [result, pos];
      } else {
        result += ch;
        pos++;
      }
    }

    // Unterminated string - return what we have
    return [result, pos];
  }

  /**
   * Read a single unquoted token (word) starting at the given position.
   * Tokens are delimited by spaces.
   */
  private readToken(input: string, startPos: number): string | null {
    let pos = startPos;

    // Skip leading whitespace
    while (pos < input.length && input[pos] === ' ') pos++;

    if (pos >= input.length) return null;

    const tokenStart = pos;
    while (pos < input.length && input[pos] !== ' ') pos++;

    return input.slice(tokenStart, pos);
  }

  /**
   * Quote a value for inclusion in an outgoing MCP message.
   * Values containing spaces or special characters are wrapped in quotes
   * with proper escaping.
   */
  private quoteValue(value: string): string {
    // Always quote to be safe - MCP values with spaces must be quoted
    if (value.length === 0 || value.includes(' ') || value.includes('"') || value.includes('\\')) {
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return value;
  }

  /**
   * Send a line of text to the server. Appends \r\n and encodes as UTF-8.
   */
  private sendLine(line: string): void {
    if (!this.sendRaw) {
      console.warn('[MCP] Cannot send: no sendRaw function');
      return;
    }
    const encoder = new TextEncoder();
    this.sendRaw(encoder.encode(line + '\r\n'));
  }
}

export const mcpService = new McpService();
