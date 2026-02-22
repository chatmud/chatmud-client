/** 3D position as [x, y, z] */
export type Position3D = [x: number, y: number, z: number];

/** 3D orientation as [forwardX, forwardY, forwardZ, upX, upY, upZ] */
export type Orientation3D = [
  forwardX: number,
  forwardY: number,
  forwardZ: number,
  upX: number,
  upY: number,
  upZ: number,
];

export type PanningModel = 'HRTF' | 'equalpower';
export type DistanceModel = 'linear' | 'inverse' | 'exponential';

export type SpatialConfig = {
  panningModel?: PanningModel;
  distanceModel?: DistanceModel;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
};

export type FilterType =
  | 'lowpass'
  | 'highpass'
  | 'bandpass'
  | 'lowshelf'
  | 'highshelf'
  | 'peaking'
  | 'notch'
  | 'allpass';

export type FilterConfig = {
  type: FilterType;
  frequency: number;
  Q?: number;
  gain?: number;
  detune?: number;
};

export type FadeConfig = {
  /** Duration in milliseconds */
  duration: number;
  from?: number;
  to?: number;
  curve?: 'linear' | 'exponential';
};

export type PlayOptions = {
  volume?: number;
  /**
   * `true` = infinite loop, `false` = play once.
   * Number = total play count (e.g. `3` plays three times).
   * Values <= 1 are equivalent to `false`.
   */
  loop?: boolean | number;
  offset?: number;
  duration?: number;
  fadeIn?: FadeConfig;
  playbackRate?: number;
  position?: Position3D;
  spatial?: SpatialConfig;
  stereoPan?: number;
  filters?: FilterConfig[];
};

export type StreamOptions = PlayOptions & {
  /** Advisory latency buffer in seconds (default 0.2) */
  latencyHint?: number;
};

export type CacheConfig = {
  maxEntries?: number;
  maxBytes?: number;
};

export type EngineOptions = {
  cache?: CacheConfig;
  latencyHint?: AudioContextLatencyCategory | number;
};

export type AudioEngineEvents = {
  'state-change': AudioContextState;
  error: Error;
};

export type SoundEvents = {
  loaded: AudioBuffer;
  error: Error;
};

export type PlaybackEvents = {
  started: undefined;
  stopped: undefined;
  paused: undefined;
  resumed: undefined;
  ended: undefined;
  loop: number;
  error: Error;
};

export type Disposable = {
  dispose(): void;
  readonly isDisposed: boolean;
};
