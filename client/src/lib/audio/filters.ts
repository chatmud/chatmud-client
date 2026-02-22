import type { FilterConfig } from './types';

/** Create and configure a BiquadFilterNode. */
export function createFilter(
  context: BaseAudioContext,
  config: FilterConfig,
): BiquadFilterNode {
  const filter = context.createBiquadFilter();
  filter.type = config.type;
  filter.frequency.value = config.frequency;
  if (config.Q !== undefined) filter.Q.value = config.Q;
  if (config.gain !== undefined) filter.gain.value = config.gain;
  if (config.detune !== undefined) filter.detune.value = config.detune;
  return filter;
}

/**
 * Connect a chain of filters between source and destination.
 * If no configs, connects source directly to destination.
 * Returns the created filter nodes.
 */
export function connectFilterChain(
  context: BaseAudioContext,
  source: AudioNode,
  destination: AudioNode,
  configs: FilterConfig[],
): BiquadFilterNode[] {
  if (configs.length === 0) {
    source.connect(destination);
    return [];
  }
  const filters = configs.map((c) => createFilter(context, c));
  source.connect(filters[0]);
  for (let i = 1; i < filters.length; i++) {
    filters[i - 1].connect(filters[i]);
  }
  filters[filters.length - 1].connect(destination);
  return filters;
}
