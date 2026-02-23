// Room package

export interface RoomInfo {
  name?: string;
  area?: string;
  desc?: string;
  exits?: Record<string, string | number>;
  [key: string]: unknown;
}

export interface RoomPlayer {
  name?: string;
  fullname?: string;
  [key: string]: unknown;
}

// Comm.Channel package

export interface CommChannel {
  chan?: string;
  msg?: string;
  player?: string;
  [key: string]: unknown;
}

export interface ChannelInfo {
  name: string;
  caption?: string;
  command?: string;
  [key: string]: unknown;
}

// Char package (we only store the name; vitals/status/etc. are unused)

export interface CharName {
  name?: string;
  fullname?: string;
  [key: string]: unknown;
}

// Char.Items package

export interface CharItem {
  id?: string | number;
  name?: string;
  icon?: string;
  attrib?: string;
  [key: string]: unknown;
}

export interface CharItemsList {
  location: string;
  items: CharItem[];
}

export interface CharItemUpdate {
  location: string;
  item: CharItem;
}

// Client.Render package

export interface ClientRenderAdd {
  html?: string;
  markdown?: string;
  caption?: string;
  id?: string;
  [key: string]: unknown;
}

// Char.Login package

export interface CharLoginDefault {
  type: string[];
  location?: string;
}

export interface CharLoginResult {
  success: boolean;
  message?: string;
}
