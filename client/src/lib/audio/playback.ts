import type {
  PlayOptions,
  PlaybackEvents,
  FadeConfig,
  FilterConfig,
  Position3D,
  Disposable,
} from './types';
import { EventEmitter } from './events';
import { applyFade } from './fade';
import { createPannerNode, setPannerPosition, createStereoPanner } from './spatial';
import { createFilter } from './filters';

export type PlaybackState = 'playing' | 'paused' | 'stopped';

export class Playback extends EventEmitter<PlaybackEvents> implements Disposable {
  readonly id: string;

  private context: AudioContext;
  private buffer: AudioBuffer;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private pannerNode: PannerNode | null = null;
  private stereoPannerNode: StereoPannerNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private destination: AudioNode;

  private _state: PlaybackState = 'stopped';
  private _volume: number;
  private _playbackRate: number;
  private _loop: boolean | number;
  private _loopCount = 0;
  private _startedAt = 0;
  private _pausedAt: number;
  private _initialOffset: number;
  private _duration: number | undefined;
  private _isDisposed = false;

  constructor(
    id: string,
    context: AudioContext,
    buffer: AudioBuffer,
    destination: AudioNode,
    options: PlayOptions = {},
  ) {
    super();
    this.id = id;
    this.context = context;
    this.buffer = buffer;
    this.destination = destination;
    this._volume = options.volume ?? 1;
    this._playbackRate = options.playbackRate ?? 1;
    this._loop = options.loop ?? false;
    this._initialOffset = options.offset ?? 0;
    this._pausedAt = this._initialOffset;
    this._duration = options.duration;

    // Gain node
    this.gainNode = context.createGain();
    this.gainNode.gain.value = this._volume;

    // Spatial (mutually exclusive)
    if (options.position) {
      this.pannerNode = createPannerNode(context, options.spatial);
      setPannerPosition(this.pannerNode, options.position);
    } else if (options.stereoPan !== undefined) {
      this.stereoPannerNode = createStereoPanner(context, options.stereoPan);
    }
  }

  get state(): PlaybackState {
    return this._state;
  }
  get isDisposed(): boolean {
    return this._isDisposed;
  }
  get volume(): number {
    return this._volume;
  }

  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (!this._isDisposed) {
      this.gainNode.gain.setValueAtTime(this._volume, this.context.currentTime);
    }
  }

  get playbackRate(): number {
    return this._playbackRate;
  }

  set playbackRate(rate: number) {
    if (this._state === 'playing') {
      this._pausedAt = this.currentTime;
      this._startedAt = this.context.currentTime - this._pausedAt / rate;
    }
    this._playbackRate = rate;
    if (this.source) {
      this.source.playbackRate.setValueAtTime(rate, this.context.currentTime);
    }
  }

  get currentTime(): number {
    if (this._state === 'paused') return this._pausedAt;
    if (this._state === 'playing') {
      return (this.context.currentTime - this._startedAt) * this._playbackRate;
    }
    return 0;
  }

  get duration(): number {
    return this.buffer.duration;
  }

  play(): void {
    if (this._isDisposed || this._state === 'playing') return;
    this.startInternal();
    this.emit('started', undefined);
  }

  stop(): void {
    if (this._isDisposed || this._state === 'stopped') return;
    this.teardownSource();
    this._state = 'stopped';
    this._pausedAt = 0;
    this.emit('stopped', undefined);
  }

  pause(): void {
    if (this._state !== 'playing') return;
    this._pausedAt = this.currentTime;
    this.teardownSource();
    this._state = 'paused';
    this.emit('paused', undefined);
  }

  resume(): void {
    if (this._state !== 'paused') return;
    this.startInternal();
    this.emit('resumed', undefined);
  }

  seek(time: number): void {
    if (this._isDisposed) return;
    const wasPlaying = this._state === 'playing';
    if (wasPlaying) this.teardownSource();
    this._pausedAt = Math.max(0, Math.min(time, this.buffer.duration));
    if (wasPlaying) {
      this.startInternal();
    }
  }

  async fadeIn(config: Omit<FadeConfig, 'to'>): Promise<void> {
    return applyFade(
      this.gainNode,
      { ...config, from: config.from ?? 0, to: this._volume },
      this.context,
    );
  }

  async fadeOut(config: Omit<FadeConfig, 'from'>): Promise<void> {
    return applyFade(
      this.gainNode,
      { ...config, from: this._volume, to: config.to ?? 0 },
      this.context,
    );
  }

  async fadeTo(volume: number, config: Omit<FadeConfig, 'from' | 'to'>): Promise<void> {
    await applyFade(
      this.gainNode,
      { ...config, from: this._volume, to: volume },
      this.context,
    );
    this._volume = volume;
  }

  setPosition(pos: Position3D): void {
    if (this.pannerNode) setPannerPosition(this.pannerNode, pos);
  }

  setStereoPan(value: number): void {
    if (this.stereoPannerNode) {
      this.stereoPannerNode.pan.value = Math.max(-1, Math.min(1, value));
    }
  }

  addFilter(config: FilterConfig): BiquadFilterNode {
    const filter = createFilter(this.context, config);
    this.filterNodes.push(filter);
    if (this._state === 'playing') {
      this.rewireGraph();
    }
    return filter;
  }

  removeFilter(filter: BiquadFilterNode): void {
    const idx = this.filterNodes.indexOf(filter);
    if (idx >= 0) {
      this.filterNodes.splice(idx, 1);
      if (this._state === 'playing') {
        this.rewireGraph();
      }
    }
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    if (this._state === 'playing') {
      try {
        this.source?.stop();
      } catch {
        /* already stopped */
      }
    }
    this.disconnectAll();
    if (this._state !== 'stopped') {
      this._state = 'stopped';
      this.emit('stopped', undefined);
    }
    this.removeAllListeners();
  }

  // -- Private --

  private createSource(): AudioBufferSourceNode {
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = this._playbackRate;

    if (this._loop === true) {
      source.loop = true;
    }

    source.addEventListener('ended', () => {
      if (this._state !== 'playing') return;

      // Finite loop counting
      if (typeof this._loop === 'number' && this._loop > 1) {
        this._loopCount++;
        if (this._loopCount < this._loop) {
          this.emit('loop', this._loopCount);
          this.restartForLoop();
          return;
        }
      }

      this._state = 'stopped';
      this.emit('ended', undefined);
    });

    return source;
  }

  private startInternal(): void {
    this.source = this.createSource();
    this.wireGraph();

    this._startedAt = this.context.currentTime - this._pausedAt / this._playbackRate;
    this.source.start(0, this._pausedAt, this._duration);
    this._state = 'playing';
  }

  private restartForLoop(): void {
    this.teardownSource();
    this._pausedAt = this._initialOffset;
    this.startInternal();
  }

  private wireGraph(): void {
    if (!this.source) return;

    let current: AudioNode = this.source;

    if (this.pannerNode) {
      current.connect(this.pannerNode);
      current = this.pannerNode;
    } else if (this.stereoPannerNode) {
      current.connect(this.stereoPannerNode);
      current = this.stereoPannerNode;
    }

    if (this.filterNodes.length > 0) {
      current.connect(this.filterNodes[0]);
      for (let i = 1; i < this.filterNodes.length; i++) {
        this.filterNodes[i - 1].connect(this.filterNodes[i]);
      }
      this.filterNodes[this.filterNodes.length - 1].connect(this.gainNode);
    } else {
      current.connect(this.gainNode);
    }

    this.gainNode.connect(this.destination);
  }

  private rewireGraph(): void {
    if (this._state !== 'playing' || !this.source) return;
    this.disconnectAll();
    this.wireGraph();
  }

  private teardownSource(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
      this.disconnectAll();
      this.source = null;
    }
  }

  private disconnectAll(): void {
    try {
      this.source?.disconnect();
    } catch {}
    try {
      this.pannerNode?.disconnect();
    } catch {}
    try {
      this.stereoPannerNode?.disconnect();
    } catch {}
    for (const f of this.filterNodes) {
      try {
        f.disconnect();
      } catch {}
    }
    try {
      this.gainNode.disconnect();
    } catch {}
  }
}
