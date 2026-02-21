import { mcpService } from './mcp-service';
import { mcpState } from '../state/mcp.svelte';

/**
 * Tests for McpService.processLine() -- the main entry point that determines
 * whether a line is an MCP protocol message or normal display text.
 *
 * Note: mcpState uses Svelte 5 runes ($state) which are compiled by the
 * Svelte vite plugin. The vitest config includes the Svelte plugin so
 * .svelte.ts files are preprocessed correctly.
 */

describe('McpService', () => {
  // Reset MCP state before each test to avoid cross-contamination
  beforeEach(() => {
    mcpState.reset();
  });

  // -------------------------------------------------------------------------
  // Non-MCP lines (display pass-through)
  // -------------------------------------------------------------------------
  describe('non-MCP lines', () => {
    it('should pass through regular text as display', () => {
      const result = mcpService.processLine('Hello world');
      expect(result).toEqual({ type: 'display', text: 'Hello world' });
    });

    it('should pass through empty lines as display', () => {
      const result = mcpService.processLine('');
      expect(result).toEqual({ type: 'display', text: '' });
    });

    it('should pass through lines that start with #$ but not #$# or #$"', () => {
      const result = mcpService.processLine('#$ not mcp');
      expect(result).toEqual({ type: 'display', text: '#$ not mcp' });
    });

    it('should pass through lines starting with # but not #$#', () => {
      const result = mcpService.processLine('#100 some object ref');
      expect(result).toEqual({ type: 'display', text: '#100 some object ref' });
    });

    it('should pass through lines with partial MCP prefix', () => {
      const result = mcpService.processLine('#$');
      expect(result).toEqual({ type: 'display', text: '#$' });
    });
  });

  // -------------------------------------------------------------------------
  // MCP quote prefix (#$")
  // -------------------------------------------------------------------------
  describe('MCP quote prefix', () => {
    it('should strip #$" prefix and return text as display', () => {
      const result = mcpService.processLine('#$"#$#not-really-mcp');
      expect(result).toEqual({ type: 'display', text: '#$#not-really-mcp' });
    });

    it('should handle #$" with regular text', () => {
      const result = mcpService.processLine('#$"just some text');
      expect(result).toEqual({ type: 'display', text: 'just some text' });
    });

    it('should handle #$" with empty remainder', () => {
      const result = mcpService.processLine('#$"');
      expect(result).toEqual({ type: 'display', text: '' });
    });

    it('should handle #$" with multiline prefix in text', () => {
      const result = mcpService.processLine('#$"#$#* tag key: value');
      expect(result).toEqual({ type: 'display', text: '#$#* tag key: value' });
    });
  });

  // -------------------------------------------------------------------------
  // MCP handshake (#$#mcp)
  // -------------------------------------------------------------------------
  describe('MCP handshake', () => {
    it('should handle MCP handshake line as MCP', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));

      const result = mcpService.processLine('#$#mcp version: 2.1 to: 2.1');
      expect(result).toEqual({ type: 'mcp', handled: true });
    });

    it('should send responses after handshake', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));

      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      // Should have sent: auth response + negotiate-can for each package + negotiate-end
      // At minimum: 1 (auth) + 8 (packages) + 1 (negotiate-end) = 10
      expect(sent.length).toBeGreaterThanOrEqual(10);
    });

    it('should set auth key in state after handshake', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));

      expect(mcpState.authKey).toBeNull();
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');
      expect(mcpState.authKey).not.toBeNull();
      expect(typeof mcpState.authKey).toBe('string');
    });

    it('should set server version in state after handshake', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));

      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');
      expect(mcpState.serverVersion).toBe('2.1');
    });

    it('should send authentication key in response', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));

      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      const decoder = new TextDecoder();
      const firstResponse = decoder.decode(sent[0]);
      expect(firstResponse).toContain('#$#mcp authentication-key:');
      expect(firstResponse).toContain('version: 2.1 to: 2.1');
    });

    it('should send negotiate-can for each client package', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));

      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      const decoder = new TextDecoder();
      const messages = sent.map((d) => decoder.decode(d));

      // Check for negotiate-can messages
      const negotiateCans = messages.filter((m) => m.includes('mcp-negotiate-can'));
      expect(negotiateCans.length).toBe(8); // 8 client packages

      // Verify some specific packages are advertised
      const allCans = negotiateCans.join('\n');
      expect(allCans).toContain('dns-org-mud-moo-simpleedit');
      expect(allCans).toContain('dns-com-awns-status');
      expect(allCans).toContain('dns-com-awns-ping');
      expect(allCans).toContain('dns-com-vmoo-userlist');
    });

    it('should send negotiate-end as last message', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));

      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      const decoder = new TextDecoder();
      const lastMessage = decoder.decode(sent[sent.length - 1]);
      expect(lastMessage).toContain('mcp-negotiate-end');
    });

    it('should populate client packages in state', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));

      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      expect(mcpState.clientPackages.size).toBe(8);
      expect(mcpState.clientPackages.has('mcp-negotiate')).toBe(true);
      expect(mcpState.clientPackages.has('dns-com-vmoo-userlist')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Regular MCP messages (#$#<name> <authkey> ...)
  // -------------------------------------------------------------------------
  describe('regular MCP messages', () => {
    it('should handle MCP message lines as MCP', () => {
      const result = mcpService.processLine('#$#some-message authkey123 key: value');
      expect(result).toEqual({ type: 'mcp', handled: true });
    });

    it('should handle MCP message with no key-value pairs', () => {
      const result = mcpService.processLine('#$#some-message authkey123');
      expect(result).toEqual({ type: 'mcp', handled: true });
    });

    it('should dispatch messages to registered handlers', () => {
      // First do handshake to set auth key
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      const authKey = mcpState.authKey!;
      const receivedMessages: Array<{ name: string; keyValues: Map<string, string> }> = [];

      mcpService.registerHandler('dns-com-awns-ping', (msg) => {
        receivedMessages.push({ name: msg.name, keyValues: msg.keyValues });
      });

      mcpService.processLine(`#$#dns-com-awns-ping ${authKey} id: 12345`);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].name).toBe('dns-com-awns-ping');
      expect(receivedMessages[0].keyValues.get('id')).toBe('12345');
    });

    it('should parse quoted values in MCP messages', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      const authKey = mcpState.authKey!;
      let receivedMsg: { keyValues: Map<string, string> } | null = null;

      mcpService.registerHandler('dns-com-awns-status', (msg) => {
        receivedMsg = { keyValues: msg.keyValues };
      });

      mcpService.processLine(
        `#$#dns-com-awns-status ${authKey} text: "You are in the Living Room"`,
      );

      expect(receivedMsg).not.toBeNull();
      expect(receivedMsg!.keyValues.get('text')).toBe('You are in the Living Room');
    });

    it('should parse multiple key-value pairs', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      const authKey = mcpState.authKey!;
      let receivedMsg: { keyValues: Map<string, string> } | null = null;

      mcpService.registerHandler('test-msg', (msg) => {
        receivedMsg = { keyValues: msg.keyValues };
      });

      mcpService.processLine(`#$#test-msg ${authKey} key1: val1 key2: "val 2" key3: val3`);

      expect(receivedMsg).not.toBeNull();
      expect(receivedMsg!.keyValues.get('key1')).toBe('val1');
      expect(receivedMsg!.keyValues.get('key2')).toBe('val 2');
      expect(receivedMsg!.keyValues.get('key3')).toBe('val3');
    });

    it('should not dispatch if auth key mismatches', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      let handlerCalled = false;
      mcpService.registerHandler('test-msg', () => {
        handlerCalled = true;
      });

      mcpService.processLine('#$#test-msg wrong-auth-key key1: val1');

      expect(handlerCalled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Multiline messages (#$#* and #$#:)
  // -------------------------------------------------------------------------
  describe('multiline messages', () => {
    it('should handle multiline continuation as MCP', () => {
      const result = mcpService.processLine('#$#* tag123 key: value');
      expect(result).toEqual({ type: 'mcp', handled: true });
    });

    it('should handle multiline end as MCP', () => {
      const result = mcpService.processLine('#$#: tag123');
      expect(result).toEqual({ type: 'mcp', handled: true });
    });

    it('should accumulate multiline data and dispatch per line', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      const authKey = mcpState.authKey!;
      const receivedMessages: Array<{ keyValues: Map<string, string> }> = [];

      mcpService.registerHandler('dns-org-mud-moo-simpleedit-content', (msg) => {
        receivedMessages.push({ keyValues: new Map(msg.keyValues) });
      });

      // Start a multiline message with content* key
      mcpService.processLine(
        `#$#dns-org-mud-moo-simpleedit-content ${authKey} reference: 1 name: "test" type: "moo-code" content*: "" _data-tag: edit1`,
      );

      // The initial message should NOT dispatch (has data tag + multiline keys)
      expect(receivedMessages).toHaveLength(0);

      // Send continuation lines
      mcpService.processLine('#$#* edit1 content: @program #123:test');
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].keyValues.get('content')).toBe('@program #123:test');

      mcpService.processLine('#$#* edit1 content: player:tell("hello");');
      expect(receivedMessages).toHaveLength(2);

      // End multiline
      mcpService.processLine('#$#: edit1');

      // After end, the multiline should be cleaned up from active tracking
      expect(mcpState.activeMultilines.has('edit1')).toBe(false);
    });

    it('should track active multilines in state', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      const authKey = mcpState.authKey!;

      mcpService.processLine(
        `#$#test-msg ${authKey} data*: "" _data-tag: ml1`,
      );

      expect(mcpState.activeMultilines.has('ml1')).toBe(true);

      mcpService.processLine('#$#: ml1');

      expect(mcpState.activeMultilines.has('ml1')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // sendMessage
  // -------------------------------------------------------------------------
  describe('sendMessage', () => {
    it('should send simple key-value messages', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');

      // Clear the handshake messages
      sent.length = 0;

      const authKey = mcpState.authKey!;
      mcpService.sendMessage('dns-com-awns-ping', new Map([['id', '12345']]));

      expect(sent).toHaveLength(1);
      const decoder = new TextDecoder();
      const message = decoder.decode(sent[0]);
      expect(message).toContain(`#$#dns-com-awns-ping ${authKey}`);
      expect(message).toContain('id: 12345');
      expect(message.endsWith('\r\n')).toBe(true);
    });

    it('should quote values containing spaces', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');
      sent.length = 0;

      mcpService.sendMessage(
        'test-msg',
        new Map([['text', 'hello world']]),
      );

      const decoder = new TextDecoder();
      const message = decoder.decode(sent[0]);
      expect(message).toContain('text: "hello world"');
    });

    it('should escape quotes and backslashes in values', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');
      sent.length = 0;

      mcpService.sendMessage(
        'test-msg',
        new Map([['text', 'say "hi" with \\ path']]),
      );

      const decoder = new TextDecoder();
      const message = decoder.decode(sent[0]);
      expect(message).toContain('text: "say \\"hi\\" with \\\\ path"');
    });

    it('should not send if no auth key is set', () => {
      mcpState.reset();
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));

      mcpService.sendMessage('test-msg', new Map([['key', 'value']]));
      expect(sent).toHaveLength(0);
    });

    it('should send multiline data with data tag and continuation lines', () => {
      const sent: Uint8Array[] = [];
      mcpService.setSendRaw((data) => sent.push(data));
      mcpService.processLine('#$#mcp version: 2.1 to: 2.1');
      sent.length = 0;

      const decoder = new TextDecoder();

      mcpService.sendMessage(
        'dns-org-mud-moo-simpleedit-set',
        new Map([['reference', '1'], ['type', 'moo-code']]),
        new Map([['content', ['line1', 'line2', 'line3']]]),
      );

      // Should send: 1 initial message + 3 continuation lines + 1 end marker = 5
      expect(sent).toHaveLength(5);

      const initialMsg = decoder.decode(sent[0]);
      expect(initialMsg).toContain('dns-org-mud-moo-simpleedit-set');
      expect(initialMsg).toContain('reference: 1');
      expect(initialMsg).toContain('type: moo-code');
      expect(initialMsg).toContain('_data-tag:');
      expect(initialMsg).toContain('content*: ""');

      // Continuation lines
      const cont1 = decoder.decode(sent[1]);
      expect(cont1).toContain('#$#*');
      expect(cont1).toContain('content: line1');

      const cont2 = decoder.decode(sent[2]);
      expect(cont2).toContain('content: line2');

      const cont3 = decoder.decode(sent[3]);
      expect(cont3).toContain('content: line3');

      // End marker
      const endMsg = decoder.decode(sent[4]);
      expect(endMsg).toContain('#$#:');
    });
  });
});
