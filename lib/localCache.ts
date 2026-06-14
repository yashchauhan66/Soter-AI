type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();
let lastSweep = 0;

export function getLocalCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setLocalCache<T>(key: string, value: T, ttlMs: number) {
  sweepExpired();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function deleteLocalCache(key: string) {
  cache.delete(key);
}

function sweepExpired() {
  const now = Date.now();
  if (now - lastSweep < 60_000 && cache.size < 5_000) return;
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  lastSweep = now;
}
