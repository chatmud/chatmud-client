import type {
  PlayOptions,
  StreamOptions,
  EngineOptions,
  AudioEngineEvents,
  Position3D,
  Orientation3D,
  Disposable,
} from './types';
import { EventEmitter } from './events';
import { AudioCache } from './cache';
import { Sound } from './sound';
import { Playback } from './playback';
import { StreamingPlayback } from './streaming-playback';
import { setListenerTransform } from './spatial';

let streamId = 0;

export class AudioEngine extends EventEmitter<AudioEngineEvents> implements Disposable {
  readonly context: AudioContext;
  /** Exposed so external sources (e.g. LiveKit) can connect into the graph. */
  readonly masterGain: GainNode;

  private cache: AudioCache;
  private _volume = 1;
  private _isDisposed = false;
  private sounds = new Set<Sound>();
  private streams = new Set<StreamingPlayback>();
  private onStateChange: () => void;

  constructor(options?: EngineOptions) {
    super();
    this.context = new AudioContext({
      latencyHint: options?.latencyHint ?? 'interactive',
    });
    this.cache = new AudioCache(options?.cache);

    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    this.onStateChange = () => {
      this.emit('state-change', this.context.state);
    };
    this.context.addEventListener('statechange', this.onStateChange);
  }

  get volume(): number {
    return this._volume;
  }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.masterGain.gain.setValueAtTime(this._volume, this.context.currentTime);
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }
  get state(): AudioContextState {
    return this.context.state;
  }

  /** Resume AudioContext (required after user gesture on most browsers). */
  async resume(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  /** Suspend AudioContext to save resources. */
  async suspend(): Promise<void> {
    if (this.context.state === 'running') {
      await this.context.suspend();
    }
  }

  /**
   * Create a Sound from a URL. Fetches, decodes, and caches the buffer.
   * The returned Sound is ready to play immediately.
   */
  async createSound(url: string, options?: { volume?: number; baseUrl?: string }): Promise<Sound> {
    const resolved = this.resolveUrl(url, options?.baseUrl);
    const buffer = await this.cache.getBuffer(resolved, this.context);
    const sound = new Sound(resolved, this.context, this.masterGain, options?.volume);
    sound._setBuffer(buffer);
    this.sounds.add(sound);
    return sound;
  }

  /** Preload a URL into the cache without creating a Sound. */
  async preload(url: string, baseUrl?: string): Promise<void> {
    await this.cache.getBuffer(this.resolveUrl(url, baseUrl), this.context);
  }

  /**
   * Fire-and-forget: load from cache, play once, auto-cleanup.
   * Ideal for sound effects.
   */
  async playOneShot(url: string, options?: PlayOptions & { baseUrl?: string }): Promise<Playback> {
    await this.resume();
    const resolved = this.resolveUrl(url, options?.baseUrl);
    const buffer = await this.cache.getBuffer(resolved, this.context);

    const sound = new Sound(resolved, this.context, this.masterGain);
    sound._setBuffer(buffer);
    const playback = sound.play({ ...options, loop: false });

    const cleanup = () => {
      sound.dispose();
      this.sounds.delete(sound);
    };
    playback.on('ended', cleanup);
    playback.on('stopped', cleanup);

    this.sounds.add(sound);
    return playback;
  }

  /**
   * Create a streaming playback for long audio or live streams.
   * Uses HTMLAudioElement routed through Web Audio for spatial/volume control.
   */
  createStream(url: string, options?: StreamOptions & { baseUrl?: string }): StreamingPlayback {
    const resolved = this.resolveUrl(url, options?.baseUrl);
    const id = `stream_${(streamId++).toString(36)}`;
    const stream = new StreamingPlayback(id, this.context, resolved, this.masterGain, options);

    this.streams.add(stream);
    const cleanup = () => this.streams.delete(stream);
    stream.on('ended', cleanup);
    stream.on('stopped', cleanup);

    return stream;
  }

  /** Set the listener (ear) position and orientation for 3D audio. */
  setListenerPosition(position: Position3D, orientation?: Orientation3D): void {
    setListenerTransform(this.context.listener, position, orientation);
  }

  stopAll(): void {
    for (const sound of this.sounds) sound.stop();
    for (const stream of this.streams) stream.stop();
  }

  pauseAll(): void {
    for (const sound of this.sounds) sound.pause();
    for (const stream of this.streams) stream.pause();
  }

  resumeAll(): void {
    for (const sound of this.sounds) sound.resume();
    for (const stream of this.streams) stream.resume();
  }

  /** Direct access to the cache for advanced use. */
  get audioCache(): AudioCache {
    return this.cache;
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    this.stopAll();
    for (const sound of this.sounds) sound.dispose();
    for (const stream of this.streams) stream.dispose();
    this.sounds.clear();
    this.streams.clear();
    this.cache.clear();
    this.context.removeEventListener('statechange', this.onStateChange);
    this.context.close();
    this.removeAllListeners();
  }

  private resolveUrl(url: string, baseUrl?: string): string {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    if (baseUrl) {
      return baseUrl.endsWith('/') ? baseUrl + url : baseUrl + '/' + url;
    }
    return url;
  }
}
