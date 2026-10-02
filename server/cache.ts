// Cache mémoire court. Les données Places ne sont conservées que quelques minutes,
// jamais écrites sur disque (conditions Google Maps Platform).

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private entries = new Map<string, Entry<T>>();

  constructor(
    private ttlMs: number,
    private maxEntries = 500,
    private now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      // Map conserve l'ordre d'insertion : la première clé est la plus ancienne.
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
