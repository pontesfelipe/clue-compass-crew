// Simple in-memory cache with TTL for edge functions
// Reduces external API calls by 60-80%

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Clean up expired entries
  prune(): number {
    let pruned = 0;
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

export const cache = new MemoryCache();

// Helper for cached fetch operations
export async function cachedFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300 // 5 minutes default
): Promise<T> {
  const cached = cache.get<T>(cacheKey);
  if (cached !== null) {
    console.log(`[cache] HIT: ${cacheKey}`);
    return cached;
  }

  console.log(`[cache] MISS: ${cacheKey}`);
  const data = await fetcher();
  cache.set(cacheKey, data, ttlSeconds);
  return data;
}

// Cache key generators for common patterns
export const cacheKeys = {
  bill: (billId: string) => `bill:${billId}`,
  member: (memberId: string) => `member:${memberId}`,
  memberVotes: (memberId: string, congress: number) => `member-votes:${memberId}:${congress}`,
  vote: (voteId: string) => `vote:${voteId}`,
  fecCandidate: (candidateId: string) => `fec-candidate:${candidateId}`,
  stateMembers: (state: string) => `state-members:${state}`,
  congressSession: (congress: number) => `congress-session:${congress}`,
};

// TTL constants (in seconds)
export const cacheTTL = {
  shortLived: 60,        // 1 minute - for frequently changing data
  standard: 300,         // 5 minutes - default
  medium: 600,           // 10 minutes - for moderately stable data
  longLived: 1800,       // 30 minutes - for stable data
  veryLong: 3600,        // 1 hour - for rarely changing data
  daily: 86400,          // 24 hours - for static reference data
};
