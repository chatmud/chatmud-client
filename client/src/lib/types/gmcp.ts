export interface RoomInfo {
  name?: string;
  area?: string;
  desc?: string;
  exits?: Record<string, string | number>;
  [key: string]: unknown;
}

export interface CommChannel {
  chan?: string;
  msg?: string;
  player?: string;
  [key: string]: unknown;
}
