import { AudioEngine } from '../audio/engine';

export const audioEngine = new AudioEngine();

// Auto-resume AudioContext on first user gesture (browsers require this).
function resumeOnGesture() {
  if (audioEngine.state !== 'suspended') return;
  audioEngine.resume().catch(() => {});
}

const events = ['click', 'keydown', 'touchstart'] as const;
for (const event of events) {
  document.addEventListener(event, resumeOnGesture, { once: false, passive: true });
}

// Once running, remove the listeners.
audioEngine.on('state-change', (state) => {
  if (state === 'running') {
    for (const event of events) {
      document.removeEventListener(event, resumeOnGesture);
    }
  }
});
