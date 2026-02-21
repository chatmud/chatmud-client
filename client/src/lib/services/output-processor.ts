/**
 * Combines telnet text with ANSI parsing, line splitting, and MCP interception.
 *
 * Takes decoded text (already telnet-stripped), splits it into lines,
 * optionally routes lines through an MCP handler, and parses ANSI
 * escape sequences into styled OutputLine objects.
 */

import type { OutputLine } from '../types/output';
import { AnsiParser } from './ansi-parser';

export class OutputProcessor {
  private ansiParser: AnsiParser;
  private lineBuffer = '';
  private nextLineId = 0;
  private mcpHandler:
    | ((line: string) => { type: 'display'; text: string } | { type: 'mcp'; handled: true })
    | null = null;

  constructor() {
    this.ansiParser = new AnsiParser();
  }

  /**
   * Register an MCP handler that intercepts lines before display processing.
   * The handler returns either { type: 'display', text } for normal lines
   * or { type: 'mcp', handled: true } for intercepted MCP lines.
   */
  setMcpHandler(
    handler: (line: string) => { type: 'display'; text: string } | { type: 'mcp'; handled: true },
  ): void {
    this.mcpHandler = handler;
  }

  /**
   * Process decoded text (already telnet-stripped), split into lines,
   * handle MCP interception, and parse ANSI into OutputLine[].
   *
   * Text is split on \r\n or \n. Partial lines are accumulated in the
   * internal line buffer until a line terminator is received.
   */
  processText(text: string): OutputLine[] {
    const lines: OutputLine[] = [];

    // Prepend any buffered partial line
    const fullText = this.lineBuffer + text;
    this.lineBuffer = '';

    // Split on \r\n or \n
    const parts = fullText.split(/\r?\n/);

    // The last element is either empty (if text ended with \n) or a partial line
    const lastPart = parts.pop();
    if (lastPart !== undefined && lastPart !== '') {
      // Partial line - buffer it for next call
      this.lineBuffer = lastPart;
    }

    // Process each complete line
    for (const rawLine of parts) {
      const outputLine = this.processCompleteLine(rawLine);
      if (outputLine !== null) {
        lines.push(outputLine);
      }
    }

    return lines;
  }

  /**
   * Flush the current partial line buffer as a prompt line.
   * Returns null if the buffer is empty.
   */
  flushPrompt(): OutputLine | null {
    if (this.lineBuffer.length === 0) {
      return null;
    }

    const text = this.lineBuffer;
    this.lineBuffer = '';

    // Run through MCP handler if set
    if (this.mcpHandler) {
      const result = this.mcpHandler(text);
      if (result.type === 'mcp') {
        return null;
      }
      // Use the possibly-transformed text
      const spans = this.ansiParser.parseLine(result.text);
      return {
        id: this.nextLineId++,
        spans,
        timestamp: Date.now(),
        isPrompt: true,
      };
    }

    const spans = this.ansiParser.parseLine(text);
    return {
      id: this.nextLineId++,
      spans,
      timestamp: Date.now(),
      isPrompt: true,
    };
  }

  /**
   * Process a single complete line. Returns null if MCP handled it.
   */
  private processCompleteLine(rawLine: string): OutputLine | null {
    // Strip trailing \r if present (for \r\n handling edge cases)
    const line = rawLine.replace(/\r$/, '');

    // Run through MCP handler if set
    if (this.mcpHandler) {
      const result = this.mcpHandler(line);
      if (result.type === 'mcp') {
        return null;
      }
      // Use the possibly-transformed text
      const spans = this.ansiParser.parseLine(result.text);
      return {
        id: this.nextLineId++,
        spans,
        timestamp: Date.now(),
      };
    }

    const spans = this.ansiParser.parseLine(line);
    return {
      id: this.nextLineId++,
      spans,
      timestamp: Date.now(),
    };
  }
}
