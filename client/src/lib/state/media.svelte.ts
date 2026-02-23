import type { ActiveMedia } from '../types/media';
import { preferencesState } from './preferences.svelte';

class MediaState {
  activeMedia = $state<ActiveMedia[]>([]);
  defaultUrl = $state<string | null>(null);
  masterVolume = $state(preferencesState.sound.masterVolume);
  soundVolume = $state(preferencesState.sound.soundVolume);
  ambianceVolume = $state(preferencesState.sound.ambianceVolume);
  muted = $state(false);

  readonly soundCount = $derived(this.activeMedia.filter(m => m.tag !== 'room_ambience').length);
  readonly ambianceCount = $derived(this.activeMedia.filter(m => m.tag === 'room_ambience').length);

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
