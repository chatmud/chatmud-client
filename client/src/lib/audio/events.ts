type EventMap = Record<string, unknown>;
type Listener<T> = (data: T) => void;

export class EventEmitter<T extends EventMap> {
  private listeners = new Map<keyof T, Set<Listener<any>>>();

  on<K extends keyof T>(event: K, fn: Listener<T[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  once<K extends keyof T>(event: K, fn: Listener<T[K]>): () => void {
    const wrapper = ((data: T[K]) => {
      unsub();
      fn(data);
    }) as Listener<T[K]>;
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  protected emit<K extends keyof T>(event: K, data: T[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of [...set]) fn(data);
    }
  }

  removeAllListeners(event?: keyof T): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
