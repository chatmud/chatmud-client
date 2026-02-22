import type { PlayOptions, SoundEvents, Disposable } from './types';
import { EventEmitter } from './events';
import { Playback } from './playback';

let nextId = 0;
function genId(): string {
  return `pb_${(nextId++).toString(36)}_${Date.now().toString(36)}`;
}

export class Sound extends EventEmitter<SoundEvents> implements Disposable {
  readonly url: string;

  private context: AudioContext;
  private destination: AudioNode;
  private _buffer: AudioBuffer | null = null;
  private _volume: number;
  private _isDisposed = false;
  private _playbacks = new Set<Playback>();

  constructor(
    url: string,
    context: AudioContext,
    destination: AudioNode,
    volume?: number,
  ) {
    super();
    this.url = url;
    this.context = context;
    this.destination = destination;
    this._volume = volume ?? 1;
  }

  get buffer(): AudioBuffer | null {
    return this._buffer;
  }
  get isLoaded(): boolean {
    return this._buffer !== null;
  }
  get isDisposed(): boolean {
    return this._isDisposed;
  }
  get volume(): number {
    return this._volume;
  }
  get activePlaybacks(): ReadonlySet<Playback> {
    return this._playbacks;
  }

  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
  }

  /** @internal Called by AudioEngine after buffer is fetched+decoded. */
  _setBuffer(buffer: AudioBuffer): void {
    this._buffer = buffer;
    this.emit('loaded', buffer);
  }

  /**
   * Play this sound, creating a new Playback instance.
   * Effective volume = sound.volume * options.volume.
   */
  play(options: PlayOptions = {}): Playback {
    if (this._isDisposed) throw new Error('Sound is disposed');
    if (!this._buffer) throw new Error('Sound not loaded');

    const effectiveVolume = this._volume * (options.volume ?? 1);
    const playback = new Playback(
      genId(),
      this.context,
      this._buffer,
      this.destination,
      { ...options, volume: effectiveVolume },
    );

    this._playbacks.add(playback);

    const cleanup = () => {
      this._playbacks.delete(playback);
      unsubEnded();
      unsubStopped();
    };
    const unsubEnded = playback.on('ended', cleanup);
    const unsubStopped = playback.on('stopped', cleanup);

    playback.play();

    if (options.fadeIn) {
      playback.fadeIn(options.fadeIn);
    }

    return playback;
  }

  stop(): void {
    for (const pb of this._playbacks) pb.stop();
    this._playbacks.clear();
  }

  pause(): void {
    for (const pb of this._playbacks) pb.pause();
  }

  resume(): void {
    for (const pb of this._playbacks) pb.resume();
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    this.stop();
    this._buffer = null;
    this.removeAllListeners();
  }
}
