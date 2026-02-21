class TtsState {
  speaking = $state(false);
  available = $state(false);
  voices = $state<SpeechSynthesisVoice[]>([]);
  /** Suppress speech during buffer replay on reconnect. */
  suppressed = $state(false);

  reset(): void {
    this.speaking = false;
  }
}

export const ttsState = new TtsState();
