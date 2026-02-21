import type {
  MediaPlayOptions,
  MediaStopOptions,
  MediaLoadOptions,
  MediaDefaultOptions,
  ActiveMedia,
  MediaType,
} from '../types/media';
import { mediaState } from '../state/media.svelte';
import { generateId } from '../utils/generate-id';

class MediaService {
  private preloadCache = new Map<string, HTMLAudioElement>();
  private fadeIntervals = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>();

  /** Set the default base URL for media files. */
  handleDefault(options: MediaDefaultOptions): void {
    mediaState.defaultUrl = options.url;
  }

  /** Preload a media file into the cache. */
  handleLoad(options: MediaLoadOptions): void {
    const url = this.resolveUrl(options.name, options.url);
    if (!url) return;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    this.preloadCache.set(options.name, audio);
  }

  /** Play a media file according to the given options. */
  handlePlay(options: MediaPlayOptions): void {
    const url = this.resolveUrl(options.name, options.url);
    if (!url) return;

    const type: MediaType = options.type ?? 'sound';
    const volume = options.volume ?? 50;
    const loops = options.loops ?? 1;
    const priority = options.priority ?? 50;

    // If key is specified, stop any existing media with the same key (but different name)
    if (options.key) {
      const existing = mediaState.activeMedia.filter(m => m.key === options.key);
      for (const m of existing) {
        if (m.name !== options.name) {
          this.stopSingle(m);
        } else if (options.continue) {
          // Same key, same name, continue=true -> don't restart
          return;
        }
      }
    }

    // If continue=true, check if this exact sound is already playing
    if (options.continue) {
      const playing = mediaState.activeMedia.find(
        m => m.name === options.name && m.type === type,
      );
      if (playing) return; // Already playing, don't restart
    }

    // Stop lower priority sounds of same type if priority specified
    if (options.priority) {
      const lowerPriority = mediaState.activeMedia.filter(
        m => m.type === type && m.priority < priority,
      );
      for (const m of lowerPriority) {
        this.stopSingle(m);
      }
    }

    // Create audio element (reuse preloaded if available)
    let audio = this.preloadCache.get(options.name);
    if (audio) {
      this.preloadCache.delete(options.name);
    } else {
      audio = new Audio(url);
    }

    // Set start position
    if (options.start) {
      audio.currentTime = options.start / 1000;
    }

    // Calculate effective volume
    const effectiveVolume = this.calculateVolume(volume, type);

    // Handle fade-in
    if (options.fadein && options.fadein > 0) {
      audio.volume = 0;
      this.fadeVolume(audio, 0, effectiveVolume, options.fadein);
    } else {
      audio.volume = effectiveVolume;
    }

    const id = generateId();
    const activeMedia: ActiveMedia = {
      id,
      name: options.name,
      type,
      tag: options.tag,
      key: options.key,
      priority,
      volume,
      loops,
      loopsRemaining: loops,
      audio,
      caption: options.caption,
      fadeoutDuration: options.fadeout,
    };

    // Handle finish time
    if (options.finish) {
      const checkFinish = () => {
        if (audio!.currentTime * 1000 >= options.finish!) {
          this.handleMediaEnd(activeMedia);
        }
      };
      audio.addEventListener('timeupdate', checkFinish);
      activeMedia._cleanupFinish = () => audio!.removeEventListener('timeupdate', checkFinish);
    }

    // Handle natural end / looping
    const onEnded = () => {
      if (activeMedia.loopsRemaining === -1) {
        // Infinite loop
        audio!.currentTime = options.start ? options.start / 1000 : 0;
        audio!.play().catch(() => this.handleMediaEnd(activeMedia));
      } else if (activeMedia.loopsRemaining > 1) {
        activeMedia.loopsRemaining--;
        audio!.currentTime = options.start ? options.start / 1000 : 0;
        audio!.play().catch(() => this.handleMediaEnd(activeMedia));
      } else {
        this.handleMediaEnd(activeMedia);
      }
    };
    audio.addEventListener('ended', onEnded);
    activeMedia._cleanupEnded = () => audio!.removeEventListener('ended', onEnded);

    mediaState.addMedia(activeMedia);
    audio.play().catch(err => {
      console.warn('[Media] Playback failed:', err);
      mediaState.removeMedia(id);
    });
  }

  /** Stop media matching the given criteria. Empty options stops all. */
  handleStop(options: MediaStopOptions): void {
    // Empty options = stop all
    if (!options.name && !options.type && !options.tag && !options.key) {
      for (const m of [...mediaState.activeMedia]) {
        this.stopSingle(m, options.fadeaway ? options.fadeout : undefined);
      }
      return;
    }

    let toStop = [...mediaState.activeMedia];

    if (options.name) toStop = toStop.filter(m => m.name === options.name);
    if (options.type) toStop = toStop.filter(m => m.type === options.type);
    if (options.tag) toStop = toStop.filter(m => m.tag === options.tag);
    if (options.key) toStop = toStop.filter(m => m.key === options.key);
    if (options.priority) toStop = toStop.filter(m => m.priority <= options.priority!);

    for (const m of toStop) {
      this.stopSingle(m, options.fadeaway ? options.fadeout : undefined);
    }
  }

  /** Recompute effective volumes for all active media (after user changes master/category volumes). */
  updateVolumes(): void {
    for (const m of mediaState.activeMedia) {
      m.audio.volume = this.calculateVolume(m.volume, m.type);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private resolveUrl(name: string, url?: string): string | null {
    const baseUrl = url ?? mediaState.defaultUrl;
    if (!baseUrl) {
      console.warn('[Media] No URL available for:', name);
      return null;
    }
    return baseUrl.endsWith('/') ? baseUrl + name : baseUrl + '/' + name;
  }

  private calculateVolume(mediaVolume: number, type: MediaType): number {
    if (mediaState.muted) return 0;
    const categoryVolume = type === 'music' ? mediaState.musicVolume : mediaState.soundVolume;
    return (mediaVolume / 100) * (categoryVolume / 100) * (mediaState.masterVolume / 100);
  }

  private cleanupMedia(media: ActiveMedia): void {
    media._cleanupFinish?.();
    media._cleanupEnded?.();
    this.cancelFade(media.audio);
  }

  private stopSingle(media: ActiveMedia, fadeoutMs?: number): void {
    if (fadeoutMs && fadeoutMs > 0) {
      this.fadeVolume(media.audio, media.audio.volume, 0, fadeoutMs, () => {
        this.cleanupMedia(media);
        media.audio.pause();
        media.audio.src = '';
        mediaState.removeMedia(media.id);
      });
    } else {
      this.cleanupMedia(media);
      media.audio.pause();
      media.audio.src = '';
      mediaState.removeMedia(media.id);
    }
  }

  private handleMediaEnd(media: ActiveMedia): void {
    if (media.fadeoutDuration && media.fadeoutDuration > 0) {
      this.fadeVolume(media.audio, media.audio.volume, 0, media.fadeoutDuration, () => {
        this.cleanupMedia(media);
        media.audio.pause();
        mediaState.removeMedia(media.id);
      });
    } else {
      this.cleanupMedia(media);
      media.audio.pause();
      mediaState.removeMedia(media.id);
    }
  }

  private cancelFade(audio: HTMLAudioElement): void {
    const existing = this.fadeIntervals.get(audio);
    if (existing) {
      clearInterval(existing);
      this.fadeIntervals.delete(audio);
    }
  }

  private fadeVolume(
    audio: HTMLAudioElement,
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void,
  ): void {
    this.cancelFade(audio);

    const steps = Math.max(1, Math.floor(durationMs / 50)); // 50ms per step
    const stepSize = (to - from) / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      if (step >= steps) {
        audio.volume = Math.max(0, Math.min(1, to));
        this.fadeIntervals.delete(audio);
        clearInterval(interval);
        onComplete?.();
      } else {
        audio.volume = Math.max(0, Math.min(1, from + stepSize * step));
      }
    }, 50);

    this.fadeIntervals.set(audio, interval);
  }
}

export const mediaService = new MediaService();
