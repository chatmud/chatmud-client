/** ANSI SGR state for text styling */
export interface AnsiState {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  blink: boolean;
  inverse: boolean;
  hidden: boolean;
  strikethrough: boolean;
  fg: string | null;        // CSS color string or null for default
  bg: string | null;        // CSS color string or null for default
}

/** A styled span of text within a line */
export interface OutputSpan {
  text: string;
  style: AnsiState;
}

/** A single line of output */
export interface OutputLine {
  id: number;
  spans: OutputSpan[];
  timestamp: number;
  isPrompt?: boolean;
  isSystem?: boolean;
  html?: string;       // sanitized HTML content from Client.Render.Add
  contentId?: string;  // server-assigned ID for future remove/replace
}
