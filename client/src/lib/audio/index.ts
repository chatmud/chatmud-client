export { AudioEngine } from './engine';
export { Sound } from './sound';
export { Playback, type PlaybackState } from './playback';
export { StreamingPlayback, type StreamState } from './streaming-playback';
export { AudioCache } from './cache';
export { EventEmitter } from './events';

export { applyFade, cancelFade } from './fade';
export { createFilter, connectFilterChain } from './filters';
export {
  createPannerNode,
  setPannerPosition,
  createStereoPanner,
  setListenerTransform,
} from './spatial';

export type {
  Position3D,
  Orientation3D,
  PanningModel,
  DistanceModel,
  SpatialConfig,
  FilterType,
  FilterConfig,
  FadeConfig,
  PlayOptions,
  StreamOptions,
  EngineOptions,
  CacheConfig,
  AudioEngineEvents,
  SoundEvents,
  PlaybackEvents,
  Disposable,
} from './types';
