export type MediaType = 'sound' | 'music' | 'video';

export interface MediaPlayOptions {
  name: string;
  url?: string;
  type?: MediaType;
  tag?: string;
  volume?: number;       // 1-100, default 50
  fadein?: number;       // ms
  fadeout?: number;      // ms
  start?: number;        // ms playback start position
  finish?: number;       // ms playback end position
  loops?: number;        // -1=infinite, >=1 iterations, default 1
  priority?: number;     // 1-100
  continue?: boolean;    // if true, don't restart already-playing matching media
  key?: string;          // unique identifier for media management
  caption?: string;      // accessibility text
}

export interface MediaStopOptions {
  name?: string;
  type?: MediaType;
  tag?: string;
  priority?: number;
  key?: string;
  fadeaway?: boolean;
  fadeout?: number;       // ms
}

export interface MediaLoadOptions {
  name: string;
  url?: string;
}

export interface MediaDefaultOptions {
  url: string;
}

/** Represents an active media playback */
export interface ActiveMedia {
  id: string;
  name: string;
  type: MediaType;
  tag?: string;
  key?: string;
  priority: number;
  volume: number;
  loops: number;
  loopsRemaining: number;
  playback: import('../audio/playback').Playback | import('../audio/streaming-playback').StreamingPlayback;
  caption?: string;
  fadeoutDuration?: number;
}
