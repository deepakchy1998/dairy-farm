const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute

export function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

export function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
  // Evict old entries if cache gets too large
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

export function clearCache(pattern) {
  if (!pattern) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}
