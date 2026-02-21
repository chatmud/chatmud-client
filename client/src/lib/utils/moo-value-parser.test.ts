import { parseMooValue, parseMooList } from './moo-value-parser';

describe('parseMooValue', () => {
  // -------------------------------------------------------------------------
  // Integers
  // -------------------------------------------------------------------------
  describe('integers', () => {
    it('should parse positive integers', () => {
      const [val, rest] = parseMooValue('42');
      expect(val).toBe(42);
      expect(rest).toBe('');
    });

    it('should parse negative integers', () => {
      const [val, rest] = parseMooValue('-7');
      expect(val).toBe(-7);
      expect(rest).toBe('');
    });

    it('should parse zero', () => {
      const [val, rest] = parseMooValue('0');
      expect(val).toBe(0);
      expect(rest).toBe('');
    });

    it('should parse large integers', () => {
      const [val] = parseMooValue('941903426');
      expect(val).toBe(941903426);
    });

    it('should return remaining string after integer', () => {
      const [val, rest] = parseMooValue('42, "next"');
      expect(val).toBe(42);
      expect(rest).toBe(', "next"');
    });
  });

  // -------------------------------------------------------------------------
  // Floats
  // -------------------------------------------------------------------------
  describe('floats', () => {
    it('should parse floats', () => {
      const [val] = parseMooValue('3.14');
      expect(val).toBeCloseTo(3.14);
    });

    it('should parse negative floats', () => {
      const [val] = parseMooValue('-0.5');
      expect(val).toBeCloseTo(-0.5);
    });

    it('should parse scientific notation with lowercase e', () => {
      const [val] = parseMooValue('1.5e10');
      expect(val).toBe(1.5e10);
    });

    it('should parse scientific notation with uppercase E', () => {
      const [val] = parseMooValue('2E3');
      expect(val).toBe(2e3);
    });

    it('should parse scientific notation with negative exponent', () => {
      const [val] = parseMooValue('5e-2');
      expect(val).toBeCloseTo(0.05);
    });

    it('should parse scientific notation with positive exponent sign', () => {
      const [val] = parseMooValue('1e+3');
      expect(val).toBe(1000);
    });

    it('should parse float with trailing data', () => {
      const [val, rest] = parseMooValue('3.14}');
      expect(val).toBeCloseTo(3.14);
      expect(rest).toBe('}');
    });
  });

  // -------------------------------------------------------------------------
  // Strings
  // -------------------------------------------------------------------------
  describe('strings', () => {
    it('should parse simple strings', () => {
      const [val] = parseMooValue('"hello"');
      expect(val).toBe('hello');
    });

    it('should parse empty strings', () => {
      const [val, rest] = parseMooValue('""');
      expect(val).toBe('');
      expect(rest).toBe('');
    });

    it('should parse strings with spaces', () => {
      const [val] = parseMooValue('"hello world"');
      expect(val).toBe('hello world');
    });

    it('should parse strings with escaped quotes', () => {
      const [val] = parseMooValue('"say \\"hi\\""');
      expect(val).toBe('say "hi"');
    });

    it('should parse strings with escaped backslashes', () => {
      const [val] = parseMooValue('"path\\\\dir"');
      expect(val).toBe('path\\dir');
    });

    it('should parse strings with mixed escapes', () => {
      const [val] = parseMooValue('"a\\\\\\"b"');
      expect(val).toBe('a\\"b');
    });

    it('should return remaining string after quoted string', () => {
      const [val, rest] = parseMooValue('"hello", 42');
      expect(val).toBe('hello');
      expect(rest).toBe(', 42');
    });

    it('should handle unrecognized escape sequences by passing through', () => {
      const [val] = parseMooValue('"hello\\nworld"');
      expect(val).toBe('hellonworld');
    });

    it('should throw on unterminated string', () => {
      expect(() => parseMooValue('"unclosed')).toThrow('Unterminated string literal');
    });
  });

  // -------------------------------------------------------------------------
  // Object numbers
  // -------------------------------------------------------------------------
  describe('object numbers', () => {
    it('should parse object numbers', () => {
      const [val, rest] = parseMooValue('#200');
      expect(val).toBe('#200');
      expect(rest).toBe('');
    });

    it('should parse negative object numbers', () => {
      const [val] = parseMooValue('#-1');
      expect(val).toBe('#-1');
    });

    it('should parse object number zero', () => {
      const [val] = parseMooValue('#0');
      expect(val).toBe('#0');
    });

    it('should return remaining string after object number', () => {
      const [val, rest] = parseMooValue('#200, "next"');
      expect(val).toBe('#200');
      expect(rest).toBe(', "next"');
    });

    it('should throw on # without digits', () => {
      expect(() => parseMooValue('#abc')).toThrow('Expected digits');
    });
  });

  // -------------------------------------------------------------------------
  // Lists
  // -------------------------------------------------------------------------
  describe('lists', () => {
    it('should parse empty lists', () => {
      const [val, rest] = parseMooValue('{}');
      expect(val).toEqual([]);
      expect(rest).toBe('');
    });

    it('should parse single-element lists', () => {
      const [val] = parseMooValue('{42}');
      expect(val).toEqual([42]);
    });

    it('should parse lists with integers', () => {
      const [val] = parseMooValue('{1, 2, 3}');
      expect(val).toEqual([1, 2, 3]);
    });

    it('should parse lists with mixed types', () => {
      const [val] = parseMooValue('{1, "two", #3}');
      expect(val).toEqual([1, 'two', '#3']);
    });

    it('should parse nested lists', () => {
      const [val] = parseMooValue('{1, {2, 3}, 4}');
      expect(val).toEqual([1, [2, 3], 4]);
    });

    it('should parse deeply nested lists', () => {
      const [val] = parseMooValue('{{1}, {{2}}}');
      expect(val).toEqual([[1], [[2]]]);
    });

    it('should parse lists with strings containing special characters', () => {
      const [val] = parseMooValue('{"hello world", "say \\"hi\\""}');
      expect(val).toEqual(['hello world', 'say "hi"']);
    });

    it('should return remaining after list', () => {
      const [val, rest] = parseMooValue('{1, 2}, extra');
      expect(val).toEqual([1, 2]);
      expect(rest).toBe(', extra');
    });

    it('should throw on unterminated list', () => {
      expect(() => parseMooValue('{1, 2')).toThrow("Expected '}'");
    });
  });

  // -------------------------------------------------------------------------
  // Whitespace handling
  // -------------------------------------------------------------------------
  describe('whitespace', () => {
    it('should skip leading whitespace', () => {
      const [val] = parseMooValue('  42');
      expect(val).toBe(42);
    });

    it('should skip leading tabs', () => {
      const [val] = parseMooValue('\t"hello"');
      expect(val).toBe('hello');
    });
  });

  // -------------------------------------------------------------------------
  // Error cases
  // -------------------------------------------------------------------------
  describe('errors', () => {
    it('should throw on empty input', () => {
      expect(() => parseMooValue('')).toThrow('Unexpected end of input');
    });

    it('should throw on whitespace-only input', () => {
      expect(() => parseMooValue('   ')).toThrow('Unexpected end of input');
    });

    it('should throw on unexpected character', () => {
      expect(() => parseMooValue('abc')).toThrow('Unexpected character');
    });

    it('should throw on bare @ symbol', () => {
      expect(() => parseMooValue('@')).toThrow('Unexpected character');
    });
  });
});

describe('parseMooList', () => {
  it('should parse a simple integer list', () => {
    expect(parseMooList('{1, 2, 3}')).toEqual([1, 2, 3]);
  });

  it('should parse empty list', () => {
    expect(parseMooList('{}')).toEqual([]);
  });

  it('should handle empty string input', () => {
    expect(parseMooList('')).toEqual([]);
  });

  it('should handle whitespace-only input', () => {
    expect(parseMooList('   ')).toEqual([]);
  });

  it('should handle leading whitespace around list', () => {
    expect(parseMooList('  { 1 , 2 , 3 }  ')).toEqual([1, 2, 3]);
  });

  it('should parse list of strings', () => {
    expect(parseMooList('{"Object", "Name", "Icon", "Connect Time"}')).toEqual([
      'Object',
      'Name',
      'Icon',
      'Connect Time',
    ]);
  });

  it('should parse list of object numbers', () => {
    expect(parseMooList('{#200}')).toEqual(['#200']);
    expect(parseMooList('{#200, #300}')).toEqual(['#200', '#300']);
  });

  it('should parse userlist data format (list of lists)', () => {
    const result = parseMooList('{{#200, "Capi", 7, 941903426, 923400345}}');
    expect(result).toEqual([['#200', 'Capi', 7, 941903426, 923400345]]);
  });

  it('should parse multiple user entries', () => {
    const result = parseMooList(
      '{{#200, "Capi", 7, 941903426, 923400345}, {#300, "Guest", 0, 0, 0}}',
    );
    expect(result).toEqual([
      ['#200', 'Capi', 7, 941903426, 923400345],
      ['#300', 'Guest', 0, 0, 0],
    ]);
  });

  it('should parse menu format with mixed nested lists and scalars', () => {
    const result = parseMooList(
      '{{"&Look $(2)", "look $(1)"}, 0, {"&Info $(2)", "info $(1)"}}',
    );
    expect(result).toEqual([
      ['&Look $(2)', 'look $(1)'],
      0,
      ['&Info $(2)', 'info $(1)'],
    ]);
  });

  it('should treat non-list input as single value wrapped in array', () => {
    // If input is not a list, parseMooList wraps the single value
    expect(parseMooList('42')).toEqual([42]);
  });

  it('should treat non-list string input as single value wrapped in array', () => {
    expect(parseMooList('"hello"')).toEqual(['hello']);
  });
});
