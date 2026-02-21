import type { ActiveMedia } from '../types/media';

class MediaState {
  activeMedia = $state<ActiveMedia[]>([]);
  defaultUrl = $state<string | null>(null);
  masterVolume = $state(100);      // 0-100 master volume
  soundVolume = $state(100);       // 0-100 sound category volume
  musicVolume = $state(100);       // 0-100 music category volume
  muted = $state(false);

  readonly soundCount = $derived(this.activeMedia.filter(m => m.type === 'sound').length);
  readonly musicCount = $derived(this.activeMedia.filter(m => m.type === 'music').length);

  addMedia(media: ActiveMedia): void {
    this.activeMedia = [...this.activeMedia, media];
  }

  removeMedia(id: string): void {
    this.activeMedia = this.activeMedia.filter(m => m.id !== id);
  }

  reset(): void {
    // Stop all audio elements
    for (const m of this.activeMedia) {
      try { m.audio.pause(); m.audio.src = ''; } catch {}
    }
    this.activeMedia = [];
    this.defaultUrl = null;
  }
}

export const mediaState = new MediaState();
