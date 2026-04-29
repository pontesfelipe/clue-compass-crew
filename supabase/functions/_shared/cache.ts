// Simple in-memory cache with TTL for edge functions
// Reduces external API calls by 60-80%
// Enhanced with LRU eviction and size limits

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  lastAccessed: number;
  size: number; // Estimated size in bytes
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number;
  maxSize: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxEntries: number = 1000; // Max number of entries
  private maxMemoryMB: number = 50; // Max memory usage in MB
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    currentSize: 0,
    maxSize: this.maxEntries
  };

  constructor(maxEntries: number = 1000, maxMemoryMB: number = 50) {
    this.maxEntries = maxEntries;
    this.maxMemoryMB = maxMemoryMB;
    this.stats.maxSize = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update last accessed time for LRU
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    return entry.data;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    const estimatedSize = this.estimateSize(data);
    
    // Check if we need to evict entries
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }
    
    // Check memory usage
    const currentMemoryMB = this.getTotalMemoryMB();
    if (currentMemoryMB + (estimatedSize / 1024 / 1024) > this.maxMemoryMB) {
      this.evictUntilFits(estimatedSize);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      lastAccessed: Date.now(),
      size: estimatedSize
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      maxSize: this.maxEntries
    };
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

  // Get cache statistics
  getStats(): CacheStats {
    return {
      ...this.stats,
      currentSize: this.cache.size
    };
  }

  // Get cache hit rate
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  // Estimate size of data in bytes
  private estimateSize(data: any): number {
    try {
      const str = JSON.stringify(data);
      return str.length * 2; // Rough estimate: 2 bytes per character
    } catch {
      return 1024; // Default 1KB if can't stringify
    }
  }

  // Get total memory usage in MB
  private getTotalMemoryMB(): number {
    let totalBytes = 0;
    for (const entry of this.cache.values()) {
      totalBytes += entry.size;
    }
    return totalBytes / 1024 / 1024;
  }

  // Evict least recently used entry
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  // Evict entries until we have enough space
  private evictUntilFits(requiredBytes: number): void {
    const requiredMB = requiredBytes / 1024 / 1024;
    
    while (this.getTotalMemoryMB() + requiredMB > this.maxMemoryMB && this.cache.size > 0) {
      this.evictLRU();
    }
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

// TTL constants (in seconds) - Optimized for better cache hit rates
export const cacheTTL = {
  realtime: 30,          // 30 seconds - for real-time data
  shortLived: 120,       // 2 minutes - for frequently changing data (increased from 1min)
  standard: 600,         // 10 minutes - default (increased from 5min)
  medium: 1800,          // 30 minutes - for moderately stable data (increased from 10min)
  longLived: 3600,       // 1 hour - for stable data (increased from 30min)
  veryLong: 7200,        // 2 hours - for rarely changing data (increased from 1h)
  daily: 86400,          // 24 hours - for static reference data
  weekly: 604800,        // 7 days - for historical/archived data
};
