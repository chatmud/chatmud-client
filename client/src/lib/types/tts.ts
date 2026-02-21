export interface TtsConfig {
  enabled: boolean;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  interruptOnNew: boolean;
  filterRules: TtsFilterRule[];
}

export interface TtsFilterRule {
  pattern: string;
  action: 'include' | 'exclude';
}
