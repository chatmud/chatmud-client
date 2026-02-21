/**
 * Simple unique ID generator for MCP data tags and other identifiers.
 * Combines a timestamp with a monotonic counter to guarantee uniqueness.
 */

let counter = 0;

export function generateId(): string {
  return `t${Date.now().toString(36)}${(counter++).toString(36)}`;
}
