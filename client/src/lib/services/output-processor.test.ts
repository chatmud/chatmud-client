import { OutputProcessor } from './output-processor';

describe('OutputProcessor', () => {
  // -------------------------------------------------------------------------
  // Basic line splitting
  // -------------------------------------------------------------------------
  describe('line splitting', () => {
    it('should split text into lines on newline', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('line1\nline2\n');
      expect(lines).toHaveLength(2);
      expect(lines[0].spans[0].text).toBe('line1');
      expect(lines[1].spans[0].text).toBe('line2');
    });

    it('should handle \\r\\n line endings', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('line1\r\nline2\r\n');
      expect(lines).toHaveLength(2);
      expect(lines[0].spans[0].text).toBe('line1');
      expect(lines[1].spans[0].text).toBe('line2');
    });

    it('should handle mixed \\n and \\r\\n endings', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('a\nb\r\nc\n');
      expect(lines).toHaveLength(3);
      expect(lines[0].spans[0].text).toBe('a');
      expect(lines[1].spans[0].text).toBe('b');
      expect(lines[2].spans[0].text).toBe('c');
    });

    it('should handle empty lines', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('\n\n');
      expect(lines).toHaveLength(2);
      // Empty lines produce spans with empty text
      expect(lines[0].spans[0].text).toBe('');
      expect(lines[1].spans[0].text).toBe('');
    });

    it('should handle a single complete line', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('hello\n');
      expect(lines).toHaveLength(1);
      expect(lines[0].spans[0].text).toBe('hello');
    });

    it('should handle multiple lines in one call', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('a\nb\nc\nd\n');
      expect(lines).toHaveLength(4);
      expect(lines[0].spans[0].text).toBe('a');
      expect(lines[1].spans[0].text).toBe('b');
      expect(lines[2].spans[0].text).toBe('c');
      expect(lines[3].spans[0].text).toBe('d');
    });
  });

  // -------------------------------------------------------------------------
  // Partial line buffering
  // -------------------------------------------------------------------------
  describe('partial line buffering', () => {
    it('should buffer partial lines until newline', () => {
      const proc = new OutputProcessor();
      const lines1 = proc.processText('partial');
      expect(lines1).toHaveLength(0);

      const lines2 = proc.processText(' line\n');
      expect(lines2).toHaveLength(1);
      expect(lines2[0].spans[0].text).toBe('partial line');
    });

    it('should buffer across multiple calls', () => {
      const proc = new OutputProcessor();
      expect(proc.processText('part')).toHaveLength(0);
      expect(proc.processText('ial ')).toHaveLength(0);

      const lines = proc.processText('complete\n');
      expect(lines).toHaveLength(1);
      expect(lines[0].spans[0].text).toBe('partial complete');
    });

    it('should emit complete lines and buffer the remainder', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('complete\npartial');
      expect(lines).toHaveLength(1);
      expect(lines[0].spans[0].text).toBe('complete');

      // The 'partial' is buffered; flush it as prompt
      const prompt = proc.flushPrompt();
      expect(prompt).not.toBeNull();
      expect(prompt!.spans[0].text).toBe('partial');
    });
  });

  // -------------------------------------------------------------------------
  // Prompt flushing
  // -------------------------------------------------------------------------
  describe('flushPrompt', () => {
    it('should flush buffered text as a prompt', () => {
      const proc = new OutputProcessor();
      proc.processText('prompt> ');
      const prompt = proc.flushPrompt();
      expect(prompt).not.toBeNull();
      expect(prompt!.spans[0].text).toBe('prompt> ');
      expect(prompt!.isPrompt).toBe(true);
    });

    it('should return null when buffer is empty', () => {
      const proc = new OutputProcessor();
      expect(proc.flushPrompt()).toBeNull();
    });

    it('should return null after buffer has been consumed by complete lines', () => {
      const proc = new OutputProcessor();
      proc.processText('complete\n');
      expect(proc.flushPrompt()).toBeNull();
    });

    it('should clear the buffer after flushing', () => {
      const proc = new OutputProcessor();
      proc.processText('prompt');
      proc.flushPrompt();
      // Second flush should be null since buffer was consumed
      expect(proc.flushPrompt()).toBeNull();
    });

    it('should have auto-incrementing id on prompt lines', () => {
      const proc = new OutputProcessor();
      proc.processText('line1\n');
      proc.processText('prompt');
      const prompt = proc.flushPrompt();
      expect(prompt!.id).toBe(1); // line1 was id 0, prompt is id 1
    });
  });

  // -------------------------------------------------------------------------
  // Line IDs
  // -------------------------------------------------------------------------
  describe('line IDs', () => {
    it('should auto-increment line IDs starting from 0', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('a\nb\nc\n');
      expect(lines[0].id).toBe(0);
      expect(lines[1].id).toBe(1);
      expect(lines[2].id).toBe(2);
    });

    it('should continue incrementing across multiple processText calls', () => {
      const proc = new OutputProcessor();
      const lines1 = proc.processText('a\nb\n');
      expect(lines1[0].id).toBe(0);
      expect(lines1[1].id).toBe(1);

      const lines2 = proc.processText('c\n');
      expect(lines2[0].id).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Timestamps
  // -------------------------------------------------------------------------
  describe('timestamps', () => {
    it('should include timestamps on output lines', () => {
      const proc = new OutputProcessor();
      const before = Date.now();
      const lines = proc.processText('test\n');
      const after = Date.now();
      expect(lines[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(lines[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should include timestamps on prompt lines', () => {
      const proc = new OutputProcessor();
      proc.processText('prompt');
      const before = Date.now();
      const prompt = proc.flushPrompt();
      const after = Date.now();
      expect(prompt!.timestamp).toBeGreaterThanOrEqual(before);
      expect(prompt!.timestamp).toBeLessThanOrEqual(after);
    });
  });

  // -------------------------------------------------------------------------
  // ANSI parsing
  // -------------------------------------------------------------------------
  describe('ANSI parsing', () => {
    it('should parse ANSI color codes in output', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('\x1b[31mred text\x1b[0m\n');
      expect(lines[0].spans[0].style.fg).toBe('var(--ansi-red)');
      expect(lines[0].spans[0].text).toBe('red text');
    });

    it('should handle bold ANSI attribute', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('\x1b[1mbold text\x1b[0m\n');
      expect(lines[0].spans[0].style.bold).toBe(true);
      expect(lines[0].spans[0].text).toBe('bold text');
    });

    it('should handle multiple ANSI spans in one line', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('\x1b[31mred\x1b[32mgreen\x1b[0m\n');
      expect(lines[0].spans).toHaveLength(2);
      expect(lines[0].spans[0].text).toBe('red');
      expect(lines[0].spans[0].style.fg).toBe('var(--ansi-red)');
      expect(lines[0].spans[1].text).toBe('green');
      expect(lines[0].spans[1].style.fg).toBe('var(--ansi-green)');
    });

    it('should carry ANSI state across lines', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('\x1b[31mred start\nstill red\x1b[0m\n');
      expect(lines[0].spans[0].style.fg).toBe('var(--ansi-red)');
      expect(lines[1].spans[0].style.fg).toBe('var(--ansi-red)');
    });

    it('should produce unstyled spans for plain text', () => {
      const proc = new OutputProcessor();
      const lines = proc.processText('plain text\n');
      expect(lines[0].spans[0].style.fg).toBeNull();
      expect(lines[0].spans[0].style.bg).toBeNull();
      expect(lines[0].spans[0].style.bold).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // MCP handler integration
  // -------------------------------------------------------------------------
  describe('MCP handler', () => {
    it('should intercept MCP lines via handler', () => {
      const proc = new OutputProcessor();
      proc.setMcpHandler((line) => {
        if (line.startsWith('#$#')) return { type: 'mcp', handled: true };
        return { type: 'display', text: line };
      });

      const lines = proc.processText('#$#mcp version: 2.1 to: 2.1\nhello\n');
      expect(lines).toHaveLength(1);
      expect(lines[0].spans[0].text).toBe('hello');
    });

    it('should handle MCP quote prefix via handler', () => {
      const proc = new OutputProcessor();
      proc.setMcpHandler((line) => {
        if (line.startsWith('#$"')) return { type: 'display', text: line.slice(3) };
        if (line.startsWith('#$#')) return { type: 'mcp', handled: true };
        return { type: 'display', text: line };
      });

      const lines = proc.processText('#$"#$#not-mcp\n');
      expect(lines).toHaveLength(1);
      expect(lines[0].spans[0].text).toBe('#$#not-mcp');
    });

    it('should pass all lines through handler when set', () => {
      const proc = new OutputProcessor();
      const handledLines: string[] = [];
      proc.setMcpHandler((line) => {
        handledLines.push(line);
        return { type: 'display', text: line };
      });

      proc.processText('a\nb\nc\n');
      expect(handledLines).toEqual(['a', 'b', 'c']);
    });

    it('should filter out all MCP lines and keep display lines', () => {
      const proc = new OutputProcessor();
      proc.setMcpHandler((line) => {
        if (line.startsWith('#$#')) return { type: 'mcp', handled: true };
        return { type: 'display', text: line };
      });

      const lines = proc.processText('#$#msg1\nvisible\n#$#msg2\nalso visible\n');
      expect(lines).toHaveLength(2);
      expect(lines[0].spans[0].text).toBe('visible');
      expect(lines[1].spans[0].text).toBe('also visible');
    });

    it('should allow handler to transform text before display', () => {
      const proc = new OutputProcessor();
      proc.setMcpHandler((line) => {
        return { type: 'display', text: line.toUpperCase() };
      });

      const lines = proc.processText('hello\n');
      expect(lines[0].spans[0].text).toBe('HELLO');
    });

    it('should handle MCP interception in prompt flush', () => {
      const proc = new OutputProcessor();
      proc.setMcpHandler((line) => {
        if (line.startsWith('#$#')) return { type: 'mcp', handled: true };
        return { type: 'display', text: line };
      });

      // Buffer an MCP line without newline
      proc.processText('#$#mcp-message');
      const prompt = proc.flushPrompt();
      expect(prompt).toBeNull(); // MCP line should be consumed, not displayed
    });

    it('should apply handler transformation in prompt flush', () => {
      const proc = new OutputProcessor();
      proc.setMcpHandler((line) => {
        return { type: 'display', text: `[${line}]` };
      });

      proc.processText('prompt');
      const prompt = proc.flushPrompt();
      expect(prompt).not.toBeNull();
      expect(prompt!.spans[0].text).toBe('[prompt]');
      expect(prompt!.isPrompt).toBe(true);
    });

    it('should not intercept lines when no handler is set', () => {
      const proc = new OutputProcessor();
      // No handler set - MCP prefixed lines go through as-is
      const lines = proc.processText('#$#mcp version: 2.1\n');
      expect(lines).toHaveLength(1);
      expect(lines[0].spans[0].text).toBe('#$#mcp version: 2.1');
    });

    it('should maintain correct IDs when some lines are filtered', () => {
      const proc = new OutputProcessor();
      proc.setMcpHandler((line) => {
        if (line.startsWith('#$#')) return { type: 'mcp', handled: true };
        return { type: 'display', text: line };
      });

      const lines = proc.processText('#$#hidden\nvisible1\n#$#hidden2\nvisible2\n');
      expect(lines).toHaveLength(2);
      // IDs should still increment (including for filtered lines they are not allocated)
      expect(lines[0].id).toBe(0);
      expect(lines[1].id).toBe(1);
    });
  });
});
