import type { ActiveMedia } from '../types/media';

class MediaState {
  activeMedia = $state<ActiveMedia[]>([]);
  defaultUrl = $state<string | null>(null);
  masterVolume = $state(60);       // 0-100 master volume
  soundVolume = $state(60);        // 0-100 sound category volume
  ambianceVolume = $state(60);     // 0-100 ambiance category volume
  muted = $state(false);

  readonly soundCount = $derived(this.activeMedia.filter(m => m.type === 'sound').length);
  readonly ambianceCount = $derived(this.activeMedia.filter(m => m.type === 'music').length);

  addMedia(media: ActiveMedia): void {
    this.activeMedia = [...this.activeMedia, media];
  }

  removeMedia(id: string): void {
    this.activeMedia = this.activeMedia.filter(m => m.id !== id);
  }

  reset(): void {
    for (const m of this.activeMedia) {
      try { m.playback.stop(); } catch {}
    }
    this.activeMedia = [];
    this.defaultUrl = null;
  }
}

export const mediaState = new MediaState();
