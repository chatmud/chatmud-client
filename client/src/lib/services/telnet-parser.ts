/**
 * State-machine telnet parser that processes raw bytes and emits TelnetEvent[].
 *
 * Handles split packets by maintaining persistent internal state between calls.
 * Processes IAC sequences, negotiation commands (WILL/WONT/DO/DONT),
 * subnegotiations (SB ... SE), and accumulates text bytes into segments.
 */

import type { TelnetEvent } from '../types/telnet';
import { Telnet } from '../constants';

const enum State {
  DATA,
  IAC,
  WILL,
  WONT,
  DO,
  DONT,
  SB,
  SB_DATA,
  SB_IAC,
}

export class TelnetParser {
  private state: State = State.DATA;
  private textBuffer: number[] = [];
  private sbOption = 0;
  private sbBuffer: number[] = [];

  constructor() {
    // Initial state is already set above
  }

  /**
   * Process incoming raw bytes and return an array of parsed telnet events.
   * State is preserved between calls to handle split packets.
   */
  processData(data: Uint8Array): TelnetEvent[] {
    const events: TelnetEvent[] = [];

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];

      switch (this.state) {
        case State.DATA:
          if (byte === Telnet.IAC) {
            this.state = State.IAC;
          } else {
            this.textBuffer.push(byte);
          }
          break;

        case State.IAC:
          switch (byte) {
            case Telnet.IAC:
              // IAC IAC = literal 0xFF in text
              this.textBuffer.push(0xff);
              this.state = State.DATA;
              break;
            case Telnet.WILL:
              this.state = State.WILL;
              break;
            case Telnet.WONT:
              this.state = State.WONT;
              break;
            case Telnet.DO:
              this.state = State.DO;
              break;
            case Telnet.DONT:
              this.state = State.DONT;
              break;
            case Telnet.SB:
              this.state = State.SB;
              break;
            case Telnet.GA:
              // GA: flush pending text, then emit command event
              this.flushText(events);
              events.push({ type: 'command', command: Telnet.GA });
              this.state = State.DATA;
              break;
            default:
              // Other IAC commands (NOP, AYT, etc.)
              this.flushText(events);
              events.push({ type: 'command', command: byte });
              this.state = State.DATA;
              break;
          }
          break;

        case State.WILL:
          this.flushText(events);
          events.push({ type: 'negotiate', command: Telnet.WILL, option: byte });
          this.state = State.DATA;
          break;

        case State.WONT:
          this.flushText(events);
          events.push({ type: 'negotiate', command: Telnet.WONT, option: byte });
          this.state = State.DATA;
          break;

        case State.DO:
          this.flushText(events);
          events.push({ type: 'negotiate', command: Telnet.DO, option: byte });
          this.state = State.DATA;
          break;

        case State.DONT:
          this.flushText(events);
          events.push({ type: 'negotiate', command: Telnet.DONT, option: byte });
          this.state = State.DATA;
          break;

        case State.SB:
          // First byte after SB is the option
          this.sbOption = byte;
          this.sbBuffer = [];
          this.state = State.SB_DATA;
          break;

        case State.SB_DATA:
          if (byte === Telnet.IAC) {
            this.state = State.SB_IAC;
          } else {
            this.sbBuffer.push(byte);
          }
          break;

        case State.SB_IAC:
          if (byte === Telnet.SE) {
            // End of subnegotiation
            this.flushText(events);
            events.push({
              type: 'subnegotiate',
              option: this.sbOption,
              data: new Uint8Array(this.sbBuffer),
            });
            this.sbBuffer = [];
            this.state = State.DATA;
          } else if (byte === Telnet.IAC) {
            // IAC IAC inside subnegotiation = literal 0xFF
            this.sbBuffer.push(0xff);
            this.state = State.SB_DATA;
          } else {
            // Malformed sequence; treat as end of SB and process byte as IAC command
            this.flushText(events);
            events.push({
              type: 'subnegotiate',
              option: this.sbOption,
              data: new Uint8Array(this.sbBuffer),
            });
            this.sbBuffer = [];
            // Re-process this byte as if we were in IAC state
            this.state = State.IAC;
            i--; // Rewind to reprocess this byte
          }
          break;
      }
    }

    // Flush any remaining text at the end of the data
    this.flushText(events);

    return events;
  }

  /**
   * Flush accumulated text bytes as a text event.
   */
  private flushText(events: TelnetEvent[]): void {
    if (this.textBuffer.length > 0) {
      events.push({ type: 'text', data: new Uint8Array(this.textBuffer) });
      this.textBuffer = [];
    }
  }
}
