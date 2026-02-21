/**
 * Parser for MOO literal values as used in MCP userlist d-lines.
 *
 * MOO values can be:
 * - Integers: 42, -7
 * - Floats: 3.14, -0.5
 * - Strings: "hello", "say \"hi\""  (escaped quotes and backslashes)
 * - Object numbers: #200, #-1
 * - Lists: {1, "two", #3, {4, 5}}  (nested, comma-separated)
 */

export type MooValue = number | string | MooValue[];

/**
 * Skip leading whitespace characters (space, tab).
 */
function skipWhitespace(input: string): string {
  let i = 0;
  while (i < input.length && (input[i] === ' ' || input[i] === '\t')) {
    i++;
  }
  return input.slice(i);
}

/**
 * Parse a single MOO value from the beginning of the input string.
 * Returns a tuple of [parsedValue, remainingString].
 *
 * Throws if the input does not start with a valid MOO value.
 */
export function parseMooValue(input: string): [MooValue, string] {
  const trimmed = skipWhitespace(input);

  if (trimmed.length === 0) {
    throw new Error('Unexpected end of input');
  }

  const ch = trimmed[0];

  // String literal
  if (ch === '"') {
    return parseString(trimmed);
  }

  // List literal
  if (ch === '{') {
    return parseListValue(trimmed);
  }

  // Object number
  if (ch === '#') {
    return parseObjectNumber(trimmed);
  }

  // Number (integer or float), possibly negative
  if (ch === '-' || (ch >= '0' && ch <= '9')) {
    return parseNumber(trimmed);
  }

  throw new Error(`Unexpected character '${ch}' at: ${trimmed.slice(0, 20)}`);
}

/**
 * Parse a MOO string literal. Strings start with `"`, handle `\"` and `\\`
 * escapes, and end with an unescaped `"`.
 */
function parseString(input: string): [string, string] {
  // input[0] === '"'
  let i = 1;
  let result = '';

  while (i < input.length) {
    const ch = input[i];

    if (ch === '\\') {
      // Escape sequence
      i++;
      if (i >= input.length) {
        throw new Error('Unexpected end of input in string escape');
      }
      const escaped = input[i];
      if (escaped === '"') {
        result += '"';
      } else if (escaped === '\\') {
        result += '\\';
      } else {
        // Pass through unrecognized escapes
        result += escaped;
      }
      i++;
    } else if (ch === '"') {
      // End of string
      i++;
      return [result, input.slice(i)];
    } else {
      result += ch;
      i++;
    }
  }

  throw new Error('Unterminated string literal');
}

/**
 * Parse a MOO object number like `#200` or `#-1`.
 * Returns the object number as a string (e.g. "#200").
 */
function parseObjectNumber(input: string): [string, string] {
  // input[0] === '#'
  let i = 1;

  // Optional negative sign
  if (i < input.length && input[i] === '-') {
    i++;
  }

  // Read digits
  const digitStart = i;
  while (i < input.length && input[i] >= '0' && input[i] <= '9') {
    i++;
  }

  if (i === digitStart) {
    throw new Error('Expected digits after # in object number');
  }

  const objNum = input.slice(0, i);
  return [objNum, input.slice(i)];
}

/**
 * Parse a MOO number (integer or float).
 * Integers: optional `-` followed by digits (no decimal point).
 * Floats: optional `-` followed by digits with a decimal point.
 */
function parseNumber(input: string): [number, string] {
  let i = 0;

  // Optional negative sign
  if (i < input.length && input[i] === '-') {
    i++;
  }

  // Read digits before possible decimal point
  const digitStart = i;
  while (i < input.length && input[i] >= '0' && input[i] <= '9') {
    i++;
  }

  let isFloat = false;

  // Check for decimal point
  if (i < input.length && input[i] === '.') {
    isFloat = true;
    i++;
    // Read digits after decimal point
    while (i < input.length && input[i] >= '0' && input[i] <= '9') {
      i++;
    }
  }

  // Check for scientific notation (e.g. 1.5e10, 2E-3)
  if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
    isFloat = true;
    i++;
    if (i < input.length && (input[i] === '+' || input[i] === '-')) {
      i++;
    }
    while (i < input.length && input[i] >= '0' && input[i] <= '9') {
      i++;
    }
  }

  if (i === digitStart) {
    throw new Error('Expected digits in number');
  }

  const numStr = input.slice(0, i);
  const value = isFloat ? parseFloat(numStr) : parseInt(numStr, 10);
  return [value, input.slice(i)];
}

/**
 * Parse a MOO list literal like `{1, "two", #3}`.
 * Lists use `{` ... `}` with comma-separated values and can nest.
 */
function parseListValue(input: string): [MooValue[], string] {
  // input[0] === '{'
  let rest = input.slice(1); // skip opening brace
  const items: MooValue[] = [];

  rest = skipWhitespace(rest);

  // Handle empty list
  if (rest.length > 0 && rest[0] === '}') {
    return [items, rest.slice(1)];
  }

  // Parse first element
  const [firstValue, afterFirst] = parseMooValue(rest);
  items.push(firstValue);
  rest = skipWhitespace(afterFirst);

  // Parse remaining elements separated by commas
  while (rest.length > 0 && rest[0] === ',') {
    rest = rest.slice(1); // skip comma
    const [value, afterValue] = parseMooValue(rest);
    items.push(value);
    rest = skipWhitespace(afterValue);
  }

  // Expect closing brace
  if (rest.length === 0 || rest[0] !== '}') {
    throw new Error(`Expected '}' in list, got: ${rest.slice(0, 20)}`);
  }

  return [items, rest.slice(1)];
}

/**
 * Parse a MOO list literal string. The input should be a complete list
 * like `{1, "two", #3}` or `{{#200, "Name", 1}}`.
 *
 * Returns the parsed list of values.
 */
export function parseMooList(input: string): MooValue[] {
  const trimmed = skipWhitespace(input);
  if (trimmed.length === 0) {
    return [];
  }

  // If the input doesn't start with '{', treat it as a single value
  if (trimmed[0] !== '{') {
    const [value] = parseMooValue(trimmed);
    return [value];
  }

  const [list] = parseListValue(trimmed);
  return list;
}
