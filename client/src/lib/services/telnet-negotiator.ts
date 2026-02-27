/**
 * Handles telnet option negotiation responses and subnegotiation dispatch.
 *
 * Responds to WILL/DO requests from the server with appropriate DO/WILL/DONT/WONT,
 * handles terminal type and NAWS subnegotiations, and dispatches GMCP messages.
 */

import {
  Telnet,
  TelnetOption,
  TerminalType,
  CLIENT_NAME,
  CLIENT_VERSION,
  GIT_COMMIT,
  GMCP_SUPPORTED_MODULES,
} from '../constants';

export class TelnetNegotiator {
  private sendRaw: (data: Uint8Array) => void;
  private onGmcpMessage: (module: string, data: unknown) => void;
  private echoMode = false;

  constructor(
    sendRaw: (data: Uint8Array) => void,
    onGmcpMessage: (module: string, data: unknown) => void,
  ) {
    this.sendRaw = sendRaw;
    this.onGmcpMessage = onGmcpMessage;
  }

  /**
   * Handle a negotiation command (WILL/WONT/DO/DONT) for a given option.
   */
  handleNegotiation(command: number, option: number): void {
    switch (command) {
      case Telnet.WILL:
        this.handleWill(option);
        break;
      case Telnet.WONT:
        this.handleWont(option);
        break;
      case Telnet.DO:
        this.handleDo(option);
        break;
      case Telnet.DONT:
        // We just acknowledge by not doing anything special
        break;
    }
  }

  /**
   * Handle a subnegotiation for the given option with associated data.
   */
  handleSubnegotiation(option: number, data: Uint8Array): void {
    switch (option) {
      case TelnetOption.TTYPE:
        if (data.length > 0 && data[0] === TerminalType.SEND) {
          this.sendTerminalType();
        }
        break;
      case TelnetOption.GMCP:
        this.handleGmcpSubnegotiation(data);
        break;
    }
  }

  /**
   * Whether the server has indicated it will handle echo (password masking mode).
   */
  get isEchoMode(): boolean {
    return this.echoMode;
  }

  /**
   * Send a GMCP message to the server.
   */
  sendGmcp(module: string, data?: unknown): void {
    let payload: string;
    if (data !== undefined) {
      payload = `${module} ${JSON.stringify(data)}`;
    } else {
      payload = module;
    }
    const encoder = new TextEncoder();
    this.sendSubnegotiation(TelnetOption.GMCP, encoder.encode(payload));
  }

  /**
   * Send a NAWS (window size) subnegotiation.
   */
  sendNaws(cols: number, rows: number): void {
    const payload: number[] = [];

    // Cols as 2 big-endian bytes
    const colHigh = (cols >> 8) & 0xff;
    const colLow = cols & 0xff;
    payload.push(colHigh);
    if (colHigh === 0xff) payload.push(0xff); // Escape IAC
    payload.push(colLow);
    if (colLow === 0xff) payload.push(0xff);

    // Rows as 2 big-endian bytes
    const rowHigh = (rows >> 8) & 0xff;
    const rowLow = rows & 0xff;
    payload.push(rowHigh);
    if (rowHigh === 0xff) payload.push(0xff);
    payload.push(rowLow);
    if (rowLow === 0xff) payload.push(0xff);

    // Build the full NAWS SB sequence manually since the payload
    // already has IAC escaping applied and sendSubnegotiation would
    // double-escape it.
    const bytes: number[] = [Telnet.IAC, Telnet.SB, TelnetOption.NAWS];
    bytes.push(...payload);
    bytes.push(Telnet.IAC, Telnet.SE);
    this.sendRaw(new Uint8Array(bytes));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private handleWill(option: number): void {
    switch (option) {
      case TelnetOption.GMCP:
        this.sendNegotiation(Telnet.DO, TelnetOption.GMCP);
        // Send Core.Hello and Core.Supports.Set
        this.sendGmcp('Core.Hello', {
          client: CLIENT_NAME,
          version: `${CLIENT_VERSION}+${GIT_COMMIT}`,
        });
        this.sendGmcp('Core.Supports.Set', GMCP_SUPPORTED_MODULES);
        break;
      case TelnetOption.SGA:
        this.sendNegotiation(Telnet.DO, TelnetOption.SGA);
        break;
      case TelnetOption.ECHO:
        this.sendNegotiation(Telnet.DO, TelnetOption.ECHO);
        this.echoMode = true;
        break;
      default:
        this.sendNegotiation(Telnet.DONT, option);
        break;
    }
  }

  private handleWont(option: number): void {
    switch (option) {
      case TelnetOption.ECHO:
        this.echoMode = false;
        break;
    }
  }

  private handleDo(option: number): void {
    switch (option) {
      case TelnetOption.NAWS:
        this.sendNegotiation(Telnet.WILL, TelnetOption.NAWS);
        // Send initial window size (reasonable defaults for a web client)
        this.sendNaws(80, 24);
        break;
      case TelnetOption.TTYPE:
        this.sendNegotiation(Telnet.WILL, TelnetOption.TTYPE);
        break;
      default:
        this.sendNegotiation(Telnet.WONT, option);
        break;
    }
  }

  /**
   * Send a 3-byte negotiation: IAC <command> <option>
   */
  private sendNegotiation(command: number, option: number): void {
    this.sendRaw(new Uint8Array([Telnet.IAC, command, option]));
  }

  /**
   * Send a subnegotiation: IAC SB <option> <payload with IAC escaped> IAC SE
   */
  private sendSubnegotiation(option: number, payload: Uint8Array): void {
    const bytes: number[] = [Telnet.IAC, Telnet.SB, option];
    for (let i = 0; i < payload.length; i++) {
      bytes.push(payload[i]);
      if (payload[i] === 0xff) {
        bytes.push(0xff); // Escape IAC bytes
      }
    }
    bytes.push(Telnet.IAC, Telnet.SE);
    this.sendRaw(new Uint8Array(bytes));
  }

  /**
   * Respond to a TTYPE SEND request with our terminal type string.
   */
  private sendTerminalType(): void {
    const encoder = new TextEncoder();
    const nameBytes = encoder.encode(CLIENT_NAME);
    const payload = new Uint8Array(1 + nameBytes.length);
    payload[0] = TerminalType.IS;
    payload.set(nameBytes, 1);
    this.sendSubnegotiation(TelnetOption.TTYPE, payload);
  }

  /**
   * Parse and dispatch a GMCP subnegotiation payload.
   * Format: "Module.Name <json>" or just "Module.Name"
   */
  private handleGmcpSubnegotiation(data: Uint8Array): void {
    const decoder = new TextDecoder();
    const text = decoder.decode(data);

    // Find the first space to split module name from JSON body
    const spaceIndex = text.indexOf(' ');
    let module: string;
    let body: unknown;

    if (spaceIndex === -1) {
      module = text;
      body = undefined;
    } else {
      module = text.substring(0, spaceIndex);
      const jsonStr = text.substring(spaceIndex + 1);
      try {
        body = JSON.parse(jsonStr);
      } catch {
        // If JSON parsing fails, pass the raw string
        body = jsonStr;
      }
    }

    this.onGmcpMessage(module, body);
  }
}
