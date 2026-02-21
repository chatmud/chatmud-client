/**
 * UTF-8 text decoder with Latin-1 fallback, and UTF-8 encoder.
 */

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const latin1Decoder = new TextDecoder('iso-8859-1');
const utf8Encoder = new TextEncoder();

/**
 * Decode a byte array to a string. Tries UTF-8 first; if that fails
 * (invalid byte sequences), falls back to Latin-1 which can decode
 * any byte value without errors.
 */
export function decodeBytes(data: Uint8Array): string {
  try {
    return utf8Decoder.decode(data);
  } catch {
    return latin1Decoder.decode(data);
  }
}

/**
 * Encode a string to a UTF-8 byte array.
 */
export function encodeString(text: string): Uint8Array {
  return utf8Encoder.encode(text);
}
