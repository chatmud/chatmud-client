import { TelnetParser } from './telnet-parser';

// Const enum values are inlined at compile time, so we define them here for clarity.
const IAC = 255;
const WILL = 251;
const WONT = 252;
const DO = 253;
const DONT = 254;
const SB = 250;
const SE = 240;
const GA = 249;
const NOP = 241;

const GMCP = 201;
const SGA = 3;
const ECHO = 1;

/** Helper to create a Uint8Array from byte values */
function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/** Helper to decode a text event's data to a string */
function textToString(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

describe('TelnetParser', () => {
  let parser: TelnetParser;

  beforeEach(() => {
    parser = new TelnetParser();
  });

  // --- Plain text ---

  it('should pass through plain text as a text event', () => {
    const events = parser.processData(bytes(72, 101, 108, 108, 111)); // "Hello"
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('text');
    if (events[0].type === 'text') {
      expect(textToString(events[0].data)).toBe('Hello');
    }
  });

  // --- Empty input ---

  it('should return empty array for empty input', () => {
    const events = parser.processData(bytes());
    expect(events).toHaveLength(0);
  });

  // --- IAC IAC -> literal 0xFF ---

  it('should convert IAC IAC to literal 0xFF in text', () => {
    const events = parser.processData(bytes(IAC, IAC));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('text');
    if (events[0].type === 'text') {
      expect(events[0].data).toEqual(new Uint8Array([0xff]));
    }
  });

  it('should embed literal 0xFF in surrounding text', () => {
    // "A" + IAC IAC + "B" -> text with [65, 255, 66]
    const events = parser.processData(bytes(65, IAC, IAC, 66));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('text');
    if (events[0].type === 'text') {
      expect(events[0].data).toEqual(new Uint8Array([65, 0xff, 66]));
    }
  });

  // --- IAC GA ---

  it('should emit command event for IAC GA and flush pending text', () => {
    // "Hello" followed by IAC GA
    const events = parser.processData(bytes(72, 101, 108, 108, 111, IAC, GA));
    expect(events).toHaveLength(2);

    expect(events[0].type).toBe('text');
    if (events[0].type === 'text') {
      expect(textToString(events[0].data)).toBe('Hello');
    }

    expect(events[1].type).toBe('command');
    if (events[1].type === 'command') {
      expect(events[1].command).toBe(GA);
    }
  });

  it('should emit GA command without preceding text', () => {
    const events = parser.processData(bytes(IAC, GA));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('command');
    if (events[0].type === 'command') {
      expect(events[0].command).toBe(GA);
    }
  });

  // --- IAC NOP and other 2-byte commands ---

  it('should emit command events for IAC NOP', () => {
    const events = parser.processData(bytes(IAC, NOP));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('command');
    if (events[0].type === 'command') {
      expect(events[0].command).toBe(NOP);
    }
  });

  it('should flush text before a NOP command', () => {
    const events = parser.processData(bytes(65, 66, IAC, NOP, 67));
    expect(events).toHaveLength(3);

    expect(events[0].type).toBe('text');
    if (events[0].type === 'text') {
      expect(textToString(events[0].data)).toBe('AB');
    }

    expect(events[1].type).toBe('command');
    if (events[1].type === 'command') {
      expect(events[1].command).toBe(NOP);
    }

    expect(events[2].type).toBe('text');
    if (events[2].type === 'text') {
      expect(textToString(events[2].data)).toBe('C');
    }
  });

  // --- WILL/WONT/DO/DONT negotiation ---

  it('should parse WILL negotiation', () => {
    const events = parser.processData(bytes(IAC, WILL, GMCP));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('negotiate');
    if (events[0].type === 'negotiate') {
      expect(events[0].command).toBe(WILL);
      expect(events[0].option).toBe(GMCP);
    }
  });

  it('should parse WONT negotiation', () => {
    const events = parser.processData(bytes(IAC, WONT, ECHO));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('negotiate');
    if (events[0].type === 'negotiate') {
      expect(events[0].command).toBe(WONT);
      expect(events[0].option).toBe(ECHO);
    }
  });

  it('should parse DO negotiation', () => {
    const events = parser.processData(bytes(IAC, DO, SGA));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('negotiate');
    if (events[0].type === 'negotiate') {
      expect(events[0].command).toBe(DO);
      expect(events[0].option).toBe(SGA);
    }
  });

  it('should parse DONT negotiation', () => {
    const events = parser.processData(bytes(IAC, DONT, ECHO));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('negotiate');
    if (events[0].type === 'negotiate') {
      expect(events[0].command).toBe(DONT);
      expect(events[0].option).toBe(ECHO);
    }
  });

  it('should flush text before negotiation events', () => {
    // "Hi" then IAC WILL GMCP
    const events = parser.processData(bytes(72, 105, IAC, WILL, GMCP));
    expect(events).toHaveLength(2);

    expect(events[0].type).toBe('text');
    if (events[0].type === 'text') {
      expect(textToString(events[0].data)).toBe('Hi');
    }

    expect(events[1].type).toBe('negotiate');
    if (events[1].type === 'negotiate') {
      expect(events[1].command).toBe(WILL);
      expect(events[1].option).toBe(GMCP);
    }
  });

  // --- Subnegotiation ---

  it('should extract subnegotiation data', () => {
    // IAC SB GMCP <payload "AB"> IAC SE
    const events = parser.processData(bytes(IAC, SB, GMCP, 65, 66, IAC, SE));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('subnegotiate');
    if (events[0].type === 'subnegotiate') {
      expect(events[0].option).toBe(GMCP);
      expect(events[0].data).toEqual(new Uint8Array([65, 66]));
    }
  });

  it('should handle empty subnegotiation data', () => {
    const events = parser.processData(bytes(IAC, SB, GMCP, IAC, SE));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('subnegotiate');
    if (events[0].type === 'subnegotiate') {
      expect(events[0].option).toBe(GMCP);
      expect(events[0].data).toEqual(new Uint8Array([]));
    }
  });

  it('should handle IAC IAC inside subnegotiation', () => {
    // IAC SB GMCP 'A' IAC IAC 'B' IAC SE
    // Escaped IAC inside SB data: [65, 255, 66]
    const events = parser.processData(bytes(IAC, SB, GMCP, 65, IAC, IAC, 66, IAC, SE));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('subnegotiate');
    if (events[0].type === 'subnegotiate') {
      expect(events[0].option).toBe(GMCP);
      expect(events[0].data).toEqual(new Uint8Array([65, 0xff, 66]));
    }
  });

  it('should flush text before subnegotiation', () => {
    const events = parser.processData(bytes(65, 66, IAC, SB, GMCP, 67, IAC, SE));
    expect(events).toHaveLength(2);

    expect(events[0].type).toBe('text');
    if (events[0].type === 'text') {
      expect(textToString(events[0].data)).toBe('AB');
    }

    expect(events[1].type).toBe('subnegotiate');
    if (events[1].type === 'subnegotiate') {
      expect(events[1].option).toBe(GMCP);
      expect(events[1].data).toEqual(new Uint8Array([67]));
    }
  });

  // --- Split packets ---

  it('should handle split packets across processData calls', () => {
    // First call: just IAC
    const events1 = parser.processData(bytes(IAC));
    expect(events1).toHaveLength(0);

    // Second call: WILL GMCP
    const events2 = parser.processData(bytes(WILL, GMCP));
    expect(events2).toHaveLength(1);
    expect(events2[0].type).toBe('negotiate');
    if (events2[0].type === 'negotiate') {
      expect(events2[0].command).toBe(WILL);
      expect(events2[0].option).toBe(GMCP);
    }
  });

  it('should handle IAC WILL split across two calls', () => {
    // First call: IAC WILL
    const events1 = parser.processData(bytes(IAC, WILL));
    expect(events1).toHaveLength(0);

    // Second call: option byte
    const events2 = parser.processData(bytes(GMCP));
    expect(events2).toHaveLength(1);
    expect(events2[0].type).toBe('negotiate');
    if (events2[0].type === 'negotiate') {
      expect(events2[0].command).toBe(WILL);
      expect(events2[0].option).toBe(GMCP);
    }
  });

  it('should handle split subnegotiation across calls', () => {
    // First call: IAC SB GMCP 65
    const events1 = parser.processData(bytes(IAC, SB, GMCP, 65));
    expect(events1).toHaveLength(0);

    // Second call: 66 IAC SE
    const events2 = parser.processData(bytes(66, IAC, SE));
    expect(events2).toHaveLength(1);
    expect(events2[0].type).toBe('subnegotiate');
    if (events2[0].type === 'subnegotiate') {
      expect(events2[0].option).toBe(GMCP);
      expect(events2[0].data).toEqual(new Uint8Array([65, 66]));
    }
  });

  it('should handle split IAC SE at boundary of subnegotiation', () => {
    // First call: IAC SB GMCP 65 IAC
    const events1 = parser.processData(bytes(IAC, SB, GMCP, 65, IAC));
    expect(events1).toHaveLength(0);

    // Second call: SE
    const events2 = parser.processData(bytes(SE));
    expect(events2).toHaveLength(1);
    expect(events2[0].type).toBe('subnegotiate');
    if (events2[0].type === 'subnegotiate') {
      expect(events2[0].option).toBe(GMCP);
      expect(events2[0].data).toEqual(new Uint8Array([65]));
    }
  });

  it('should preserve text across split calls with no telnet sequences', () => {
    // First call produces text
    const events1 = parser.processData(bytes(72, 101));
    expect(events1).toHaveLength(1);
    if (events1[0].type === 'text') {
      expect(textToString(events1[0].data)).toBe('He');
    }

    // Second call produces more text
    const events2 = parser.processData(bytes(108, 108, 111));
    expect(events2).toHaveLength(1);
    if (events2[0].type === 'text') {
      expect(textToString(events2[0].data)).toBe('llo');
    }
  });

  // --- Mixed content ---

  it('should handle interleaved text and telnet commands', () => {
    // "Hi" IAC WILL GMCP "Ok" IAC SB GMCP 'X' IAC SE
    const data = bytes(
      72, 105,           // "Hi"
      IAC, WILL, GMCP,   // WILL GMCP
      79, 107,           // "Ok"
      IAC, SB, GMCP, 88, IAC, SE, // SB GMCP 'X' SE
    );
    const events = parser.processData(data);
    expect(events).toHaveLength(4);

    expect(events[0].type).toBe('text');
    if (events[0].type === 'text') {
      expect(textToString(events[0].data)).toBe('Hi');
    }

    expect(events[1].type).toBe('negotiate');
    if (events[1].type === 'negotiate') {
      expect(events[1].command).toBe(WILL);
      expect(events[1].option).toBe(GMCP);
    }

    expect(events[2].type).toBe('text');
    if (events[2].type === 'text') {
      expect(textToString(events[2].data)).toBe('Ok');
    }

    expect(events[3].type).toBe('subnegotiate');
    if (events[3].type === 'subnegotiate') {
      expect(events[3].option).toBe(GMCP);
      expect(events[3].data).toEqual(new Uint8Array([88]));
    }
  });

  // --- Multiple events in one packet ---

  it('should handle multiple negotiations in one packet', () => {
    const data = bytes(
      IAC, WILL, GMCP,
      IAC, WILL, SGA,
      IAC, DO, ECHO,
    );
    const events = parser.processData(data);
    expect(events).toHaveLength(3);

    expect(events[0].type).toBe('negotiate');
    if (events[0].type === 'negotiate') {
      expect(events[0].command).toBe(WILL);
      expect(events[0].option).toBe(GMCP);
    }

    expect(events[1].type).toBe('negotiate');
    if (events[1].type === 'negotiate') {
      expect(events[1].command).toBe(WILL);
      expect(events[1].option).toBe(SGA);
    }

    expect(events[2].type).toBe('negotiate');
    if (events[2].type === 'negotiate') {
      expect(events[2].command).toBe(DO);
      expect(events[2].option).toBe(ECHO);
    }
  });

  it('should handle multiple commands interspersed with text', () => {
    const data = bytes(
      IAC, GA,
      65,        // 'A'
      IAC, NOP,
      66,        // 'B'
      IAC, GA,
    );
    const events = parser.processData(data);
    expect(events).toHaveLength(5);

    expect(events[0]).toEqual({ type: 'command', command: GA });
    expect(events[1].type).toBe('text');
    if (events[1].type === 'text') {
      expect(textToString(events[1].data)).toBe('A');
    }
    expect(events[2]).toEqual({ type: 'command', command: NOP });
    expect(events[3].type).toBe('text');
    if (events[3].type === 'text') {
      expect(textToString(events[3].data)).toBe('B');
    }
    expect(events[4]).toEqual({ type: 'command', command: GA });
  });

  // --- Large subnegotiation payload ---

  it('should handle large subnegotiation payload', () => {
    const payload = Array.from({ length: 500 }, (_, i) => i % 254); // Avoid 255 to keep it simple
    const data = bytes(IAC, SB, GMCP, ...payload, IAC, SE);
    const events = parser.processData(data);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('subnegotiate');
    if (events[0].type === 'subnegotiate') {
      expect(events[0].option).toBe(GMCP);
      expect(events[0].data.length).toBe(500);
      expect(Array.from(events[0].data)).toEqual(payload);
    }
  });

  // --- Multiple IAC IAC in sequence ---

  it('should handle multiple IAC IAC sequences in a row', () => {
    // IAC IAC IAC IAC -> two literal 0xFF bytes
    const events = parser.processData(bytes(IAC, IAC, IAC, IAC));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('text');
    if (events[0].type === 'text') {
      expect(events[0].data).toEqual(new Uint8Array([0xff, 0xff]));
    }
  });

  // --- Text only after a command ---

  it('should emit text that follows a command', () => {
    const events = parser.processData(bytes(IAC, GA, 72, 105)); // GA then "Hi"
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'command', command: GA });
    expect(events[1].type).toBe('text');
    if (events[1].type === 'text') {
      expect(textToString(events[1].data)).toBe('Hi');
    }
  });
});
