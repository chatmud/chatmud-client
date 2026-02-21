class StatusState {
  statusText = $state('');
  serverInfoUrls = $state<Map<string, string>>(new Map());
  pingLatency = $state<number | null>(null);
  lastPingSent = $state<number | null>(null);

  reset(): void {
    this.statusText = '';
    this.serverInfoUrls = new Map();
    this.pingLatency = null;
    this.lastPingSent = null;
  }
}

export const statusState = new StatusState();
