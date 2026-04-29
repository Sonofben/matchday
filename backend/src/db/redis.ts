import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('error', (err) => console.error('Redis error', err))

// ── Cache helpers ────────────────────────────────────────────────────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await redis.get(key)
  return data ? (JSON.parse(data) as T) : null
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 30): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(value))
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key)
}

// Key namespaces
export const CacheKeys = {
  liveMatches: () => 'matches:live',
  match: (id: string) => `match:${id}`,
  standings: (compId: string) => `standings:${compId}`,
  competition: (id: string) => `competition:${id}`,
  player: (id: string) => `player:${id}`,
  playerStats: (playerId: string, compId: string) => `player:${playerId}:stats:${compId}`,
}
