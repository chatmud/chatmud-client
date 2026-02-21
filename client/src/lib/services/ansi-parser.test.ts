import { AnsiParser, defaultAnsiState } from './ansi-parser';
import type { AnsiState, OutputSpan } from '../types/output';

/** Shorthand to build an expected default style object */
function defaults(overrides: Partial<AnsiState> = {}): AnsiState {
  return { ...defaultAnsiState(), ...overrides };
}

describe('defaultAnsiState', () => {
  it('should return a fresh default state with all styles off and no colors', () => {
    const state = defaultAnsiState();
    expect(state).toEqual({
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      blink: false,
      inverse: false,
      hidden: false,
      strikethrough: false,
      fg: null,
      bg: null,
    });
  });

  it('should return a new object each time', () => {
    const a = defaultAnsiState();
    const b = defaultAnsiState();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('AnsiParser', () => {
  let parser: AnsiParser;

  beforeEach(() => {
    parser = new AnsiParser();
  });

  // --- Plain text (no ANSI) ---

  it('should return plain text as a single span with default style', () => {
    const spans = parser.parseLine('Hello, World!');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Hello, World!');
    expect(spans[0].style).toEqual(defaults());
  });

  // --- Empty line ---

  it('should produce a single empty span for empty input', () => {
    const spans = parser.parseLine('');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('');
    expect(spans[0].style).toEqual(defaults());
  });

  // --- SGR Reset ---

  it('should handle ESC[0m reset', () => {
    // Set bold, then reset, then text
    const spans = parser.parseLine('\x1b[1mBold\x1b[0mNormal');
    expect(spans).toHaveLength(2);
    expect(spans[0].text).toBe('Bold');
    expect(spans[0].style.bold).toBe(true);
    expect(spans[1].text).toBe('Normal');
    expect(spans[1].style).toEqual(defaults());
  });

  it('should handle ESC[m as reset (empty params)', () => {
    const spans = parser.parseLine('\x1b[1mBold\x1b[mNormal');
    expect(spans).toHaveLength(2);
    expect(spans[0].text).toBe('Bold');
    expect(spans[0].style.bold).toBe(true);
    expect(spans[1].text).toBe('Normal');
    expect(spans[1].style).toEqual(defaults());
  });

  // --- Bold, italic, underline ---

  it('should set bold on ESC[1m', () => {
    const spans = parser.parseLine('\x1b[1mBold text');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Bold text');
    expect(spans[0].style.bold).toBe(true);
    expect(spans[0].style.italic).toBe(false);
  });

  it('should set italic on ESC[3m', () => {
    const spans = parser.parseLine('\x1b[3mItalic text');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Italic text');
    expect(spans[0].style.italic).toBe(true);
  });

  it('should set underline on ESC[4m', () => {
    const spans = parser.parseLine('\x1b[4mUnderlined text');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Underlined text');
    expect(spans[0].style.underline).toBe(true);
  });

  it('should set dim on ESC[2m', () => {
    const spans = parser.parseLine('\x1b[2mDim text');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Dim text');
    expect(spans[0].style.dim).toBe(true);
  });

  it('should set blink on ESC[5m', () => {
    const spans = parser.parseLine('\x1b[5mBlinky');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Blinky');
    expect(spans[0].style.blink).toBe(true);
  });

  // --- Standard foreground colors ---

  it('should set foreground red on ESC[31m', () => {
    const spans = parser.parseLine('\x1b[31mRed text');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Red text');
    expect(spans[0].style.fg).toBe('var(--ansi-red)');
  });

  it('should set foreground green on ESC[32m', () => {
    const spans = parser.parseLine('\x1b[32mGreen text');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Green text');
    expect(spans[0].style.fg).toBe('var(--ansi-green)');
  });

  it('should handle all standard foreground colors 30-37', () => {
    const expectedColors = [
      'var(--ansi-black)',
      'var(--ansi-red)',
      'var(--ansi-green)',
      'var(--ansi-yellow)',
      'var(--ansi-blue)',
      'var(--ansi-magenta)',
      'var(--ansi-cyan)',
      'var(--ansi-white)',
    ];

    for (let code = 30; code <= 37; code++) {
      const p = new AnsiParser();
      const spans = p.parseLine(`\x1b[${code}mText`);
      expect(spans).toHaveLength(1);
      expect(spans[0].style.fg).toBe(expectedColors[code - 30]);
    }
  });

  // --- Standard background colors ---

  it('should set background blue on ESC[44m', () => {
    const spans = parser.parseLine('\x1b[44mBlue bg');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Blue bg');
    expect(spans[0].style.bg).toBe('var(--ansi-blue)');
  });

  it('should handle all standard background colors 40-47', () => {
    const expectedColors = [
      'var(--ansi-black)',
      'var(--ansi-red)',
      'var(--ansi-green)',
      'var(--ansi-yellow)',
      'var(--ansi-blue)',
      'var(--ansi-magenta)',
      'var(--ansi-cyan)',
      'var(--ansi-white)',
    ];

    for (let code = 40; code <= 47; code++) {
      const p = new AnsiParser();
      const spans = p.parseLine(`\x1b[${code}mText`);
      expect(spans).toHaveLength(1);
      expect(spans[0].style.bg).toBe(expectedColors[code - 40]);
    }
  });

  // --- Bright foreground (90-97) ---

  it('should set bright foreground red on ESC[91m', () => {
    const spans = parser.parseLine('\x1b[91mBright red');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Bright red');
    expect(spans[0].style.fg).toBe('var(--ansi-bright-red)');
  });

  it('should handle all bright foreground colors 90-97', () => {
    const expectedColors = [
      'var(--ansi-bright-black)',
      'var(--ansi-bright-red)',
      'var(--ansi-bright-green)',
      'var(--ansi-bright-yellow)',
      'var(--ansi-bright-blue)',
      'var(--ansi-bright-magenta)',
      'var(--ansi-bright-cyan)',
      'var(--ansi-bright-white)',
    ];

    for (let code = 90; code <= 97; code++) {
      const p = new AnsiParser();
      const spans = p.parseLine(`\x1b[${code}mText`);
      expect(spans).toHaveLength(1);
      expect(spans[0].style.fg).toBe(expectedColors[code - 90]);
    }
  });

  // --- Bright background (100-107) ---

  it('should set bright background on ESC[100m', () => {
    const spans = parser.parseLine('\x1b[100mBright black bg');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Bright black bg');
    expect(spans[0].style.bg).toBe('var(--ansi-bright-black)');
  });

  it('should handle all bright background colors 100-107', () => {
    const expectedColors = [
      'var(--ansi-bright-black)',
      'var(--ansi-bright-red)',
      'var(--ansi-bright-green)',
      'var(--ansi-bright-yellow)',
      'var(--ansi-bright-blue)',
      'var(--ansi-bright-magenta)',
      'var(--ansi-bright-cyan)',
      'var(--ansi-bright-white)',
    ];

    for (let code = 100; code <= 107; code++) {
      const p = new AnsiParser();
      const spans = p.parseLine(`\x1b[${code}mText`);
      expect(spans).toHaveLength(1);
      expect(spans[0].style.bg).toBe(expectedColors[code - 100]);
    }
  });

  // --- Default fg/bg (39, 49) ---

  it('should reset foreground on ESC[39m', () => {
    const spans = parser.parseLine('\x1b[31mRed\x1b[39mDefault');
    expect(spans).toHaveLength(2);
    expect(spans[0].style.fg).toBe('var(--ansi-red)');
    expect(spans[1].style.fg).toBeNull();
  });

  it('should reset background on ESC[49m', () => {
    const spans = parser.parseLine('\x1b[44mBlueBg\x1b[49mDefault');
    expect(spans).toHaveLength(2);
    expect(spans[0].style.bg).toBe('var(--ansi-blue)');
    expect(spans[1].style.bg).toBeNull();
  });

  // --- 256-color ---

  it('should handle 256-color foreground ESC[38;5;196m', () => {
    // Color 196: (196-16)=180, r=180/36=5, g=(180%36)/6=0, b=0%6=0
    // r: 55+40*5=255, g: 0, b: 0 => rgb(255,0,0)
    const spans = parser.parseLine('\x1b[38;5;196mRed256');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Red256');
    expect(spans[0].style.fg).toBe('rgb(255,0,0)');
  });

  it('should handle 256-color background ESC[48;5;21m', () => {
    // Color 21: (21-16)=5, r=5/36=0, g=(5%36)/6=0, b=5%6=5
    // r: 0, g: 0, b: 55+40*5=255 => rgb(0,0,255)
    const spans = parser.parseLine('\x1b[48;5;21mBlueBg');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('BlueBg');
    expect(spans[0].style.bg).toBe('rgb(0,0,255)');
  });

  it('should handle 256-color using standard palette indices 0-7', () => {
    // Color 0 -> var(--ansi-black)
    const spans0 = parser.parseLine('\x1b[38;5;0mText');
    expect(spans0[0].style.fg).toBe('var(--ansi-black)');

    // Color 1 -> var(--ansi-red)
    const p1 = new AnsiParser();
    const spans1 = p1.parseLine('\x1b[38;5;1mText');
    expect(spans1[0].style.fg).toBe('var(--ansi-red)');

    // Color 7 -> var(--ansi-white)
    const p7 = new AnsiParser();
    const spans7 = p7.parseLine('\x1b[38;5;7mText');
    expect(spans7[0].style.fg).toBe('var(--ansi-white)');
  });

  it('should handle 256-color using bright palette indices 8-15', () => {
    // Color 8 -> var(--ansi-bright-black)
    const spans8 = parser.parseLine('\x1b[38;5;8mText');
    expect(spans8[0].style.fg).toBe('var(--ansi-bright-black)');

    // Color 9 -> var(--ansi-bright-red)
    const p9 = new AnsiParser();
    const spans9 = p9.parseLine('\x1b[38;5;9mText');
    expect(spans9[0].style.fg).toBe('var(--ansi-bright-red)');

    // Color 15 -> var(--ansi-bright-white)
    const p15 = new AnsiParser();
    const spans15 = p15.parseLine('\x1b[38;5;15mText');
    expect(spans15[0].style.fg).toBe('var(--ansi-bright-white)');
  });

  it('should handle 256-color grayscale 232-255', () => {
    // Color 232 -> rgb(8,8,8)   (8 + (232-232)*10 = 8)
    const spans232 = parser.parseLine('\x1b[38;5;232mText');
    expect(spans232[0].style.fg).toBe('rgb(8,8,8)');

    // Color 255 -> rgb(238,238,238)  (8 + (255-232)*10 = 8+230 = 238)
    const p255 = new AnsiParser();
    const spans255 = p255.parseLine('\x1b[38;5;255mText');
    expect(spans255[0].style.fg).toBe('rgb(238,238,238)');

    // Color 240 -> rgb(88,88,88)  (8 + (240-232)*10 = 8+80 = 88)
    const p240 = new AnsiParser();
    const spans240 = p240.parseLine('\x1b[38;5;240mText');
    expect(spans240[0].style.fg).toBe('rgb(88,88,88)');
  });

  it('should handle 256-color 6x6x6 cube correctly', () => {
    // Color 16: index=0, r=0,g=0,b=0 => rgb(0,0,0)
    const p16 = new AnsiParser();
    const spans16 = p16.parseLine('\x1b[38;5;16mText');
    expect(spans16[0].style.fg).toBe('rgb(0,0,0)');

    // Color 231: index=215, r=215/36=5, g=(215%36)/6=5, b=215%6=5
    // r: 255, g: 255, b: 255 => rgb(255,255,255)
    const p231 = new AnsiParser();
    const spans231 = p231.parseLine('\x1b[38;5;231mText');
    expect(spans231[0].style.fg).toBe('rgb(255,255,255)');

    // Color 82: index=66, r=66/36=1, g=(66%36)/6=5, b=66%6=0
    // r: 55+40=95, g: 55+200=255, b: 0 => rgb(95,255,0)
    const p82 = new AnsiParser();
    const spans82 = p82.parseLine('\x1b[38;5;82mText');
    expect(spans82[0].style.fg).toBe('rgb(95,255,0)');
  });

  // --- Truecolor ---

  it('should handle truecolor foreground ESC[38;2;100;200;50m', () => {
    const spans = parser.parseLine('\x1b[38;2;100;200;50mTruecolor');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Truecolor');
    expect(spans[0].style.fg).toBe('rgb(100,200,50)');
  });

  it('should handle truecolor background ESC[48;2;0;0;0m', () => {
    const spans = parser.parseLine('\x1b[48;2;0;0;0mBlackBg');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('BlackBg');
    expect(spans[0].style.bg).toBe('rgb(0,0,0)');
  });

  it('should handle truecolor with max values ESC[38;2;255;255;255m', () => {
    const spans = parser.parseLine('\x1b[38;2;255;255;255mWhite');
    expect(spans).toHaveLength(1);
    expect(spans[0].style.fg).toBe('rgb(255,255,255)');
  });

  // --- Combined SGR params ---

  it('should handle combined params ESC[1;31m for bold red', () => {
    const spans = parser.parseLine('\x1b[1;31mBold Red');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Bold Red');
    expect(spans[0].style.bold).toBe(true);
    expect(spans[0].style.fg).toBe('var(--ansi-red)');
  });

  it('should handle multiple combined attributes ESC[1;3;4;31m', () => {
    const spans = parser.parseLine('\x1b[1;3;4;31mStyled');
    expect(spans).toHaveLength(1);
    expect(spans[0].style.bold).toBe(true);
    expect(spans[0].style.italic).toBe(true);
    expect(spans[0].style.underline).toBe(true);
    expect(spans[0].style.fg).toBe('var(--ansi-red)');
  });

  it('should handle reset within combined params ESC[1;0;32m', () => {
    // 1=bold, 0=reset (clears bold), 32=green
    const spans = parser.parseLine('\x1b[1;0;32mGreen only');
    expect(spans).toHaveLength(1);
    expect(spans[0].style.bold).toBe(false);
    expect(spans[0].style.fg).toBe('var(--ansi-green)');
  });

  // --- State persistence across lines ---

  it('should carry state across parseLine calls', () => {
    // First line sets red foreground
    const spans1 = parser.parseLine('\x1b[31mRed start');
    expect(spans1).toHaveLength(1);
    expect(spans1[0].style.fg).toBe('var(--ansi-red)');

    // Second line has no ANSI codes but should inherit red
    const spans2 = parser.parseLine('Still red');
    expect(spans2).toHaveLength(1);
    expect(spans2[0].text).toBe('Still red');
    expect(spans2[0].style.fg).toBe('var(--ansi-red)');
  });

  it('should carry bold across lines until reset', () => {
    parser.parseLine('\x1b[1mBold');
    const spans = parser.parseLine('Also bold');
    expect(spans[0].style.bold).toBe(true);

    // Now reset
    parser.parseLine('\x1b[0m');
    const spansAfterReset = parser.parseLine('Not bold');
    expect(spansAfterReset[0].style.bold).toBe(false);
  });

  it('should carry multiple styles across lines', () => {
    parser.parseLine('\x1b[1;31;44mStyled');
    const spans = parser.parseLine('Continued');
    expect(spans[0].style.bold).toBe(true);
    expect(spans[0].style.fg).toBe('var(--ansi-red)');
    expect(spans[0].style.bg).toBe('var(--ansi-blue)');
  });

  // --- Reset clears everything ---

  it('should clear all styles on reset()', () => {
    // Set some styles
    parser.parseLine('\x1b[1;3;4;31;44mStyled');

    // Call reset method
    parser.reset();

    const spans = parser.parseLine('After reset');
    expect(spans).toHaveLength(1);
    expect(spans[0].style).toEqual(defaults());
  });

  // --- Attribute off codes ---

  it('should turn off bold/dim on ESC[22m', () => {
    const spans = parser.parseLine('\x1b[1;2mBoldDim\x1b[22mNeither');
    expect(spans).toHaveLength(2);
    expect(spans[0].style.bold).toBe(true);
    expect(spans[0].style.dim).toBe(true);
    expect(spans[1].text).toBe('Neither');
    expect(spans[1].style.bold).toBe(false);
    expect(spans[1].style.dim).toBe(false);
  });

  it('should turn off italic on ESC[23m', () => {
    const spans = parser.parseLine('\x1b[3mItalic\x1b[23mNot');
    expect(spans).toHaveLength(2);
    expect(spans[0].style.italic).toBe(true);
    expect(spans[1].style.italic).toBe(false);
  });

  it('should turn off underline on ESC[24m', () => {
    const spans = parser.parseLine('\x1b[4mUnderline\x1b[24mNot');
    expect(spans).toHaveLength(2);
    expect(spans[0].style.underline).toBe(true);
    expect(spans[1].style.underline).toBe(false);
  });

  it('should turn off blink on ESC[25m', () => {
    const spans = parser.parseLine('\x1b[5mBlink\x1b[25mNot');
    expect(spans).toHaveLength(2);
    expect(spans[0].style.blink).toBe(true);
    expect(spans[1].style.blink).toBe(false);
  });

  it('should turn off inverse on ESC[27m', () => {
    const spans = parser.parseLine('\x1b[7mInverse\x1b[27mNot');
    expect(spans).toHaveLength(2);
    expect(spans[0].style.inverse).toBe(true);
    expect(spans[1].style.inverse).toBe(false);
  });

  it('should turn off hidden on ESC[28m', () => {
    const spans = parser.parseLine('\x1b[8mHidden\x1b[28mNot');
    expect(spans).toHaveLength(2);
    expect(spans[0].style.hidden).toBe(true);
    expect(spans[1].style.hidden).toBe(false);
  });

  it('should turn off strikethrough on ESC[29m', () => {
    const spans = parser.parseLine('\x1b[9mStrike\x1b[29mNot');
    expect(spans).toHaveLength(2);
    expect(spans[0].style.strikethrough).toBe(true);
    expect(spans[1].style.strikethrough).toBe(false);
  });

  // --- Multiple spans ---

  it('should produce multiple spans for text with color changes', () => {
    const spans = parser.parseLine('Hello \x1b[31mWorld\x1b[0m end');
    expect(spans).toHaveLength(3);

    expect(spans[0].text).toBe('Hello ');
    expect(spans[0].style.fg).toBeNull();

    expect(spans[1].text).toBe('World');
    expect(spans[1].style.fg).toBe('var(--ansi-red)');

    expect(spans[2].text).toBe(' end');
    expect(spans[2].style).toEqual(defaults());
  });

  it('should handle multiple color changes producing many spans', () => {
    const spans = parser.parseLine('\x1b[31mR\x1b[32mG\x1b[34mB');
    expect(spans).toHaveLength(3);
    expect(spans[0].text).toBe('R');
    expect(spans[0].style.fg).toBe('var(--ansi-red)');
    expect(spans[1].text).toBe('G');
    expect(spans[1].style.fg).toBe('var(--ansi-green)');
    expect(spans[2].text).toBe('B');
    expect(spans[2].style.fg).toBe('var(--ansi-blue)');
  });

  // --- Inverse, hidden, strikethrough ---

  it('should handle inverse on ESC[7m', () => {
    const spans = parser.parseLine('\x1b[7mInversed');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Inversed');
    expect(spans[0].style.inverse).toBe(true);
  });

  it('should handle hidden on ESC[8m', () => {
    const spans = parser.parseLine('\x1b[8mHidden');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Hidden');
    expect(spans[0].style.hidden).toBe(true);
  });

  it('should handle strikethrough on ESC[9m', () => {
    const spans = parser.parseLine('\x1b[9mStruck');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Struck');
    expect(spans[0].style.strikethrough).toBe(true);
  });

  // --- Edge cases ---

  it('should not produce empty spans for adjacent escape sequences', () => {
    // Two escape sequences back-to-back with no text between
    const spans = parser.parseLine('\x1b[1m\x1b[31mBoldRed');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('BoldRed');
    expect(spans[0].style.bold).toBe(true);
    expect(spans[0].style.fg).toBe('var(--ansi-red)');
  });

  it('should handle escape sequence at end of line with no trailing text', () => {
    // Text then ANSI with no following text -> only 1 span for the text
    const spans = parser.parseLine('Text\x1b[31m');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Text');
    expect(spans[0].style.fg).toBeNull();
  });

  it('should handle only an escape sequence with no text at all', () => {
    const spans = parser.parseLine('\x1b[31m');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('');
    // The state should now be red but the empty span uses the state before or after
    // Since there's no text content, the regex skips over it and no span is added,
    // then the empty fallback kicks in. The style reflects the updated state.
    expect(spans[0].style.fg).toBe('var(--ansi-red)');
  });

  it('should handle 256-color mode with missing color index gracefully', () => {
    // ESC[38;5m with no color number -- incomplete extended color
    const spans = parser.parseLine('\x1b[38;5mText');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Text');
    // fg should remain null since the color was incomplete
    expect(spans[0].style.fg).toBeNull();
  });

  it('should handle truecolor with missing components gracefully', () => {
    // ESC[38;2;100;200m -- missing blue component
    const spans = parser.parseLine('\x1b[38;2;100;200mText');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Text');
    // fg should remain null since the truecolor was incomplete
    expect(spans[0].style.fg).toBeNull();
  });

  it('should produce independent style objects for each span', () => {
    const spans = parser.parseLine('A\x1b[1mB');
    expect(spans).toHaveLength(2);
    // Modifying one span's style should not affect another
    spans[0].style.bold = true;
    expect(spans[1].style.bold).toBe(true); // was already bold
    spans[1].style.fg = 'modified';
    expect(spans[0].style.fg).toBeNull(); // should be unaffected
  });

  it('should handle 256-color for background', () => {
    // Color 232 grayscale via background
    const spans = parser.parseLine('\x1b[48;5;232mDarkBg');
    expect(spans).toHaveLength(1);
    expect(spans[0].style.bg).toBe('rgb(8,8,8)');
  });

  it('should preserve non-color attributes when changing colors', () => {
    const spans = parser.parseLine('\x1b[1mBold\x1b[31mBoldRed\x1b[32mBoldGreen');
    expect(spans).toHaveLength(3);
    expect(spans[0].style.bold).toBe(true);
    expect(spans[0].style.fg).toBeNull();
    expect(spans[1].style.bold).toBe(true);
    expect(spans[1].style.fg).toBe('var(--ansi-red)');
    expect(spans[2].style.bold).toBe(true);
    expect(spans[2].style.fg).toBe('var(--ansi-green)');
  });
});
