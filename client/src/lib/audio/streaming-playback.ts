import type {
  StreamOptions,
  PlaybackEvents,
  FadeConfig,
  Position3D,
  Disposable,
} from './types';
import { EventEmitter } from './events';
import { applyFade } from './fade';
import { createPannerNode, setPannerPosition, createStereoPanner } from './spatial';

export type StreamState = 'playing' | 'paused' | 'stopped' | 'loading';

export class StreamingPlayback
  extends EventEmitter<PlaybackEvents>
  implements Disposable
{
  readonly id: string;

  private context: AudioContext;
  private element: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode;
  private gainNode: GainNode;
  private pannerNode: PannerNode | null = null;
  private stereoPannerNode: StereoPannerNode | null = null;
  private destination: AudioNode;
  private cleanupFns: (() => void)[] = [];

  private _state: StreamState = 'stopped';
  private _volume: number;
  private _isDisposed = false;

  constructor(
    id: string,
    context: AudioContext,
    url: string,
    destination: AudioNode,
    options: StreamOptions = {},
  ) {
    super();
    this.id = id;
    this.context = context;
    this.destination = destination;
    this._volume = options.volume ?? 1;

    // HTMLAudioElement for streaming
    this.element = new Audio();
    this.element.crossOrigin = 'anonymous';
    this.element.preload = 'auto';

    if (options.loop === true) {
      this.element.loop = true;
    }
    if (options.playbackRate) {
      this.element.playbackRate = options.playbackRate;
    }

    // Route through Web Audio
    this.sourceNode = context.createMediaElementSource(this.element);

    this.gainNode = context.createGain();
    this.gainNode.gain.value = this._volume;

    // Spatial
    if (options.position) {
      this.pannerNode = createPannerNode(context, options.spatial);
      setPannerPosition(this.pannerNode, options.position);
    } else if (options.stereoPan !== undefined) {
      this.stereoPannerNode = createStereoPanner(context, options.stereoPan);
    }

    this.wireGraph();
    this.bindEvents(url);

    this.element.src = url;
  }

  get state(): StreamState {
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
    this.gainNode.gain.setValueAtTime(this._volume, this.context.currentTime);
  }

  get currentTime(): number {
    return this.element.currentTime;
  }
  get duration(): number {
    return this.element.duration || 0;
  }

  get playbackRate(): number {
    return this.element.playbackRate;
  }
  set playbackRate(rate: number) {
    this.element.playbackRate = rate;
  }

  async play(): Promise<void> {
    if (this._isDisposed) return;
    this._state = 'loading';
    try {
      await this.element.play();
      this._state = 'playing';
      this.emit('started', undefined);
    } catch (e) {
      this._state = 'stopped';
      this.emit('error', e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  }

  stop(): void {
    if (this._isDisposed) return;
    this.element.pause();
    this.element.currentTime = 0;
    this._state = 'stopped';
    this.emit('stopped', undefined);
  }

  pause(): void {
    if (this._state !== 'playing') return;
    this.element.pause();
    this._state = 'paused';
    this.emit('paused', undefined);
  }

  async resume(): Promise<void> {
    if (this._state !== 'paused') return;
    await this.element.play();
    this._state = 'playing';
    this.emit('resumed', undefined);
  }

  seek(time: number): void {
    this.element.currentTime = time;
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

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    this.element.pause();
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    this.disconnectAll();
    this.element.removeAttribute('src');
    this.element.load();
    if (this._state !== 'stopped') {
      this._state = 'stopped';
      this.emit('stopped', undefined);
    }
    this.removeAllListeners();
  }

  // -- Private --

  private wireGraph(): void {
    let current: AudioNode = this.sourceNode;

    if (this.pannerNode) {
      current.connect(this.pannerNode);
      current = this.pannerNode;
    } else if (this.stereoPannerNode) {
      current.connect(this.stereoPannerNode);
      current = this.stereoPannerNode;
    }

    current.connect(this.gainNode);
    this.gainNode.connect(this.destination);
  }

  private disconnectAll(): void {
    try {
      this.sourceNode.disconnect();
    } catch {}
    try {
      this.pannerNode?.disconnect();
    } catch {}
    try {
      this.stereoPannerNode?.disconnect();
    } catch {}
    try {
      this.gainNode.disconnect();
    } catch {}
  }

  private bindEvents(url: string): void {
    const onEnded = () => {
      if (this._state === 'playing') {
        this._state = 'stopped';
        this.emit('ended', undefined);
      }
    };
    this.element.addEventListener('ended', onEnded);
    this.cleanupFns.push(() => this.element.removeEventListener('ended', onEnded));

    const onError = () => {
      this.emit('error', new Error(`Stream error: ${url}`));
    };
    this.element.addEventListener('error', onError);
    this.cleanupFns.push(() => this.element.removeEventListener('error', onError));
  }
}
