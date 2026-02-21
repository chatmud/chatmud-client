/**
 * MCP simpleedit package handler.
 *
 * Handles dns-org-mud-moo-simpleedit-content messages from the server,
 * which deliver editable text content (verb code, descriptions, etc.)
 * to the client for editing.
 *
 * Also provides sendEditSet() for uploading edited content back to the server.
 */

import { mcpService } from '../mcp-service';
import { editorState } from '../../state/editor.svelte';
import { uiState } from '../../state/ui.svelte';
import type { McpParsedMessage } from '../../types/mcp';
import type { EditContentType } from '../../types/editor';
import { generateId } from '../../utils/generate-id';

export function registerSimpleeditPackage(): void {
  mcpService.registerHandler('dns-org-mud-moo-simpleedit-content', (msg: McpParsedMessage) => {
    const reference = msg.keyValues.get('reference') ?? '';
    const name = msg.keyValues.get('name') ?? 'Untitled';
    const rawType = msg.keyValues.get('type') ?? 'string';

    // Normalize the content type to one of our supported types
    let type: EditContentType;
    if (rawType === 'moo-code' || rawType === 'string-list' || rawType === 'string') {
      type = rawType;
    } else {
      type = 'string';
    }

    // Content comes from multiline data, joined with newlines.
    // The multiline handler delivers each continuation line's data,
    // so by the time we get here the content key may have been
    // accumulated or may arrive as a single joined string.
    const contentRaw = msg.keyValues.get('content') ?? '';
    const content = contentRaw;

    editorState.openSession({
      id: generateId(),
      reference,
      name,
      type,
      content,
      originalContent: content,
      dirty: false,
    });

    uiState.editorOpen = true;
  });
}

/**
 * Send edited content back to the server.
 *
 * Sends a dns-org-mud-moo-simpleedit-set message with the reference,
 * type, and content (as multiline data).
 */
export function sendEditSet(reference: string, type: string, content: string): void {
  const lines = content.split('\n');
  const kv = new Map<string, string>();
  kv.set('reference', reference);
  kv.set('type', type);

  const multiline = new Map<string, string[]>();
  multiline.set('content', lines);

  mcpService.sendMessage('dns-org-mud-moo-simpleedit-set', kv, multiline);
}
