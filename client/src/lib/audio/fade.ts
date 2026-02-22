import type { FadeConfig } from './types';

/**
 * Apply a fade to a GainNode using AudioParam scheduling.
 * Sample-accurate — runs on the audio thread, not setInterval.
 */
export function applyFade(
  gainNode: GainNode,
  config: FadeConfig,
  context: BaseAudioContext,
): Promise<void> {
  const now = context.currentTime;
  const durationSec = config.duration / 1000;
  const from = config.from ?? gainNode.gain.value;
  const to = config.to ?? 0;
  const curve = config.curve ?? 'linear';

  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(from, now);

  if (curve === 'exponential') {
    // exponentialRamp requires non-zero values
    const safeFrom = Math.max(from, 0.0001);
    const safeTo = Math.max(to, 0.0001);
    gainNode.gain.setValueAtTime(safeFrom, now);
    gainNode.gain.exponentialRampToValueAtTime(safeTo, now + durationSec);
  } else {
    gainNode.gain.linearRampToValueAtTime(to, now + durationSec);
  }

  return new Promise((resolve) => {
    setTimeout(resolve, config.duration + 50);
  });
}

/** Cancel any scheduled fades and optionally set gain immediately. */
export function cancelFade(
  gainNode: GainNode,
  context: BaseAudioContext,
  value?: number,
): void {
  const now = context.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  if (value !== undefined) {
    gainNode.gain.setValueAtTime(value, now);
  }
}
