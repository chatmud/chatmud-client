import type {
  MediaPlayOptions,
  MediaStopOptions,
  MediaLoadOptions,
  MediaDefaultOptions,
  ActiveMedia,
  MediaType,
} from '../types/media';
import { mediaState } from '../state/media.svelte';
import { audioEngine } from './audio-engine-instance';
import { generateId } from '../utils/generate-id';
class MediaService {
  /** Set the default base URL for media files. */
  handleDefault(options: MediaDefaultOptions): void {
    mediaState.defaultUrl = options.url;
  }

  /** Preload a media file into the engine cache. */
  handleLoad(options: MediaLoadOptions): void {
    const url = this.resolveUrl(options.name, options.url);
    if (!url) return;
    audioEngine.preload(url).catch(err => {
      console.warn('[Media] Preload failed:', err);
    });
  }

  /** Play a media file according to the given options. */
  async handlePlay(options: MediaPlayOptions): Promise<void> {
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

    // Ensure AudioContext is resumed
    await audioEngine.resume();

    // Create sound via engine (fetches + decodes + caches the buffer)
    let sound;
    try {
      sound = await audioEngine.createSound(url);
    } catch (err) {
      console.warn('[Media] Failed to load:', err);
      return;
    }

    // Map GMCP options to engine PlayOptions
    const effectiveVolume = this.calculateVolume(volume, options.tag);
    const offset = options.start ? options.start / 1000 : undefined;
    const duration =
      options.finish && options.start !== undefined
        ? (options.finish - options.start) / 1000
        : options.finish
          ? options.finish / 1000
          : undefined;
    const loop = loops === -1 ? true : loops > 1 ? loops : false;
    const fadeIn = options.fadein && options.fadein > 0
      ? { duration: options.fadein }
      : undefined;

    const playback = sound.play({
      volume: effectiveVolume,
      offset,
      duration,
      loop,
      fadeIn,
    });

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
      playback,
      caption: options.caption,
      fadeoutDuration: options.fadeout,
    };

    // Auto-remove when playback ends naturally
    const cleanup = () => {
      sound.dispose();
      mediaState.removeMedia(id);
    };
    playback.on('ended', cleanup);

    mediaState.addMedia(activeMedia);
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

  /** Recompute effective volumes for all active media (after user changes master/category volumes or mute). */
  updateVolumes(): void {
    for (const m of mediaState.activeMedia) {
      m.playback.volume = this.calculateVolume(m.volume, m.tag);
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

  private calculateVolume(mediaVolume: number, tag?: string): number {
    if (mediaState.muted) return 0;
    const categoryVolume = tag === 'room_ambience' ? mediaState.ambianceVolume : mediaState.soundVolume;
    return (mediaVolume / 100) * (categoryVolume / 100) * (mediaState.masterVolume / 100);
  }

  private stopSingle(media: ActiveMedia, fadeoutMs?: number): void {
    const pb = media.playback;
    if (fadeoutMs && fadeoutMs > 0) {
      pb.fadeOut({ duration: fadeoutMs }).then(() => {
        pb.stop();
        mediaState.removeMedia(media.id);
      }).catch(() => {
        pb.stop();
        mediaState.removeMedia(media.id);
      });
    } else {
      pb.stop();
      mediaState.removeMedia(media.id);
    }
  }
}

export const mediaService = new MediaService();
