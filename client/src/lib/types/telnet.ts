/** Parsed telnet events emitted by the parser */
export type TelnetEvent =
  | { type: 'text'; data: Uint8Array }
  | { type: 'command'; command: number }
  | { type: 'negotiate'; command: number; option: number }
  | { type: 'subnegotiate'; option: number; data: Uint8Array };

/** State of a telnet option negotiation (local/remote) */
export interface NegotiationState {
  local: boolean;   // We have agreed to DO/WILL this option
  remote: boolean;  // They have agreed to DO/WILL this option
}
