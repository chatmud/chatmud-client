import type { CacheConfig } from './types';

type CacheEntry = {
  buffer: AudioBuffer;
  url: string;
  byteLength: number;
  lastAccessed: number;
};

export class AudioCache {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<AudioBuffer>>();
  private maxEntries: number;
  private maxBytes: number;
  private _totalBytes = 0;

  constructor(config?: CacheConfig) {
    this.maxEntries = config?.maxEntries ?? 100;
    this.maxBytes = config?.maxBytes ?? 0;
  }

  /** Fetch, decode, and cache. Deduplicates concurrent requests for the same URL. */
  async getBuffer(url: string, context: BaseAudioContext): Promise<AudioBuffer> {
    const cached = this.cache.get(url);
    if (cached) {
      cached.lastAccessed = performance.now();
      return cached.buffer;
    }

    const pending = this.inflight.get(url);
    if (pending) return pending;

    const promise = this.fetchAndDecode(url, context);
    this.inflight.set(url, promise);

    try {
      const buffer = await promise;
      this.store(url, buffer);
      return buffer;
    } finally {
      this.inflight.delete(url);
    }
  }

  /** Manually store a pre-decoded buffer. */
  set(url: string, buffer: AudioBuffer): void {
    this.store(url, buffer);
  }

  has(url: string): boolean {
    return this.cache.has(url);
  }

  delete(url: string): boolean {
    const entry = this.cache.get(url);
    if (entry) {
      this._totalBytes -= entry.byteLength;
      return this.cache.delete(url);
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.inflight.clear();
    this._totalBytes = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  private async fetchAndDecode(
    url: string,
    context: BaseAudioContext,
  ): Promise<AudioBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Audio fetch failed: ${response.status} ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return context.decodeAudioData(arrayBuffer).catch((err: unknown) => {
      throw new Error(`Audio decode failed for ${url}: ${err instanceof Error ? err.message : err}`);
    });
  }

  private store(url: string, buffer: AudioBuffer): void {
    const byteLength = buffer.length * buffer.numberOfChannels * 4;
    this.evict();
    this.cache.set(url, {
      buffer,
      url,
      byteLength,
      lastAccessed: performance.now(),
    });
    this._totalBytes += byteLength;
  }

  private evict(): void {
    while (this.cache.size >= this.maxEntries) {
      const oldest = this.findOldest();
      if (oldest) this.removeEntry(oldest);
      else break;
    }

    if (this.maxBytes > 0) {
      while (this._totalBytes > this.maxBytes && this.cache.size > 0) {
        const oldest = this.findOldest();
        if (oldest) this.removeEntry(oldest);
        else break;
      }
    }
  }

  private removeEntry(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this._totalBytes -= entry.byteLength;
      this.cache.delete(key);
    }
  }

  private findOldest(): string | null {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldest = key;
      }
    }
    return oldest;
  }
}
