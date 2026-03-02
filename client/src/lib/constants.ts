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
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
export const CLIENT_VERSION: string = __APP_VERSION__;
export const GIT_COMMIT: string = __GIT_COMMIT__;

// MCP protocol
export const MCP_PREFIX = '#$#';
export const MCP_QUOTE_PREFIX = '#$"';
export const MCP_MULTILINE_PREFIX = '#$#*';
export const MCP_MULTILINE_END_PREFIX = '#$#:';

// Reconnection backoff schedule (ms)
export const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

// Output buffer defaults
export const DEFAULT_MAX_OUTPUT_LINES = 5000;

// localStorage keys
export const STORAGE_KEYS = {
  SESSION_ID: 'chatmud-sessionId',
  PREFERENCES: 'chatmud-preferences',
  OUTPUT: 'chatmud-output',
  COMMAND_HISTORY: 'chatmud-commandHistory',
} as const;

// GMCP modules we support
export const GMCP_SUPPORTED_MODULES = [
  'Char 1',
  'Char.Items 1',
  'Char.Login 1',
  'Room 1',
  'Comm.Channel 1',
  'Client.Media 1',
  'Client.Render 1',
];
