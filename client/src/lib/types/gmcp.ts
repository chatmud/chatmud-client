export interface CharBase {
  name?: string;
  class?: string;
  race?: string;
  level?: number;
  [key: string]: unknown;
}

export interface CharVitals {
  hp?: number;
  maxhp?: number;
  mana?: number;
  maxmana?: number;
  moves?: number;
  maxmoves?: number;
  [key: string]: unknown;
}

export interface CharStats {
  [key: string]: number;
}

export interface CharMaxStats {
  [key: string]: number;
}

export interface CharStatus {
  [key: string]: unknown;
}

export interface CharWorth {
  [key: string]: unknown;
}

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

export interface GroupMember {
  name?: string;
  [key: string]: unknown;
}
