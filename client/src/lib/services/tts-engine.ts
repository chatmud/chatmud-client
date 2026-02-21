/**
 * Web Speech Synthesis API wrapper.
 *
 * Provides a queued TTS engine that reads incoming MUD text aloud
 * based on user preferences and filter rules.
 */

import { ttsState } from '../state/tts.svelte';
import { preferencesState } from '../state/preferences.svelte';

class TtsEngine {
  private queue: string[] = [];
  private speaking = false;

  init(): void {
    if ('speechSynthesis' in window) {
      ttsState.available = true;
      // Load voices (may be async on some browsers)
      const loadVoices = () => {
        ttsState.voices = speechSynthesis.getVoices();
      };
      loadVoices();
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }
  }

  speakLine(text: string): void {
    if (!preferencesState.tts.enabled || !ttsState.available) return;
    if (ttsState.suppressed) return;
    if (!text.trim()) return;

    // Check activation mode against window focus
    const mode = preferencesState.tts.activationMode;
    if (mode === 'focused' && !document.hasFocus()) return;
    if (mode === 'unfocused' && document.hasFocus()) return;

    // Apply filter rules
    for (const rule of preferencesState.tts.filterRules) {
      try {
        const regex = new RegExp(rule.pattern);
        if (rule.action === 'exclude' && regex.test(text)) return;
        if (rule.action === 'include' && !regex.test(text)) return;
      } catch {
        /* ignore invalid regex */
      }
    }

    if (preferencesState.tts.interruptOnNew) {
      this.cancel();
    }

    this.queue.push(text);
    this.processQueue();
  }

  cancel(): void {
    speechSynthesis.cancel();
    this.queue = [];
    this.speaking = false;
    ttsState.speaking = false;
  }

  private processQueue(): void {
    if (this.speaking || this.queue.length === 0) return;

    const text = this.queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);

    // Apply settings from preferences
    const config = preferencesState.tts;
    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = config.volume;

    // Set voice if configured
    if (config.voice) {
      const voice = ttsState.voices.find((v) => v.name === config.voice);
      if (voice) utterance.voice = voice;
    }

    utterance.onstart = () => {
      this.speaking = true;
      ttsState.speaking = true;
    };

    utterance.onend = () => {
      this.speaking = false;
      ttsState.speaking = false;
      this.processQueue();
    };

    utterance.onerror = () => {
      this.speaking = false;
      ttsState.speaking = false;
      this.processQueue();
    };

    speechSynthesis.speak(utterance);
  }
}

export const ttsEngine = new TtsEngine();
