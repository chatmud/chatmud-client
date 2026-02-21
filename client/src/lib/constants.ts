// Telnet protocol bytes
export const enum Telnet {
  IAC = 255,
  DONT = 254,
  DO = 253,
  WONT = 252,
  WILL = 251,
  SB = 250,
  GA = 249,
  EL = 248,
  EC = 247,
  AYT = 246,
  AO = 245,
  IP = 244,
  BRK = 243,
  DM = 242,
  NOP = 241,
  SE = 240,
}

// Telnet options
export const enum TelnetOption {
  ECHO = 1,
  SGA = 3,         // Suppress Go Ahead
  TTYPE = 24,      // Terminal Type
  NAWS = 31,       // Negotiate About Window Size
  NEW_ENVIRON = 39,
  GMCP = 201,
}

// Terminal type sub-commands
export const enum TerminalType {
  IS = 0,
  SEND = 1,
}

// Proxy control message marker
export const PROXY_MARKER = 0x00;

// Client identification
export const CLIENT_NAME = 'ChatMUD-Web';
export const CLIENT_VERSION = '0.1.0';

// MCP protocol
export const MCP_PREFIX = '#$#';
export const MCP_QUOTE_PREFIX = '#$"';
export const MCP_MULTILINE_PREFIX = '#$#*';
export const MCP_MULTILINE_END_PREFIX = '#$#:';

// Reconnection backoff schedule (ms)
export const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

// Output buffer defaults
export const DEFAULT_MAX_OUTPUT_LINES = 1000;

// GMCP modules we support
export const GMCP_SUPPORTED_MODULES = [
  'Char.Base 1',
  'Char.Vitals 1',
  'Char.Stats 1',
  'Char.MaxStats 1',
  'Char.Status 1',
  'Char.Worth 1',
  'Room.Info 1',
  'Comm.Channel 1',
  'Comm.Tick 1',
  'Comm.Quest 1',
  'Comm.Repop 1',
  'Group 1',
  'Client.Media 1',
];
