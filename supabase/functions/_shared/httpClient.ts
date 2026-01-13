// Centralized HTTP client with rate limiting, backoff, retry logic, and timeboxing
// All sync functions should use this to ensure consistent behavior

export interface HttpClientConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterPercent?: number;
  timeoutMs?: number;
  maxConcurrency?: number;
  minDelayBetweenRequestsMs?: number; // Minimum delay between consecutive requests to same provider
}

export interface RequestMetrics {
  attempts: number;
  totalWaitMs: number;
  finalStatus: number;
  endpoint: string;
}

// Timebox budget tracker for job-level time limits
export class TimeBudget {
  private startTime: number;
  private maxDurationMs: number;
  private warningThresholdMs: number;

  constructor(maxDurationSeconds: number = 30) {
    this.startTime = Date.now();
    this.maxDurationMs = maxDurationSeconds * 1000;
    this.warningThresholdMs = this.maxDurationMs * 0.85; // Warn at 85%
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }

  remaining(): number {
    return Math.max(0, this.maxDurationMs - this.elapsed());
  }

  isExpired(): boolean {
    return this.elapsed() >= this.maxDurationMs;
  }

  isNearExpiry(): boolean {
    return this.elapsed() >= this.warningThresholdMs;
  }

  shouldContinue(): boolean {
    return !this.isExpired() && !this.isNearExpiry();
  }
}

const DEFAULT_CONFIG: Required<HttpClientConfig> = {
  maxRetries: 6,
  baseDelayMs: 2000,
  maxDelayMs: 120000, // 2 minutes
  jitterPercent: 0.3,
  timeoutMs: 30000,
  maxConcurrency: 2,
  minDelayBetweenRequestsMs: 300, // Default 300ms between requests
};

// Simple in-memory concurrency limiter per provider
const activeCalls: Map<string, number> = new Map();
// Track last request time per provider for minimum delay enforcement
const lastRequestTime: Map<string, number> = new Map();
// Track 429 rates per provider for observability
const rateLimitHits: Map<string, { count: number; lastHit: number }> = new Map();

function getActiveCount(provider: string): number {
  return activeCalls.get(provider) || 0;
}

function incrementActive(provider: string): void {
  activeCalls.set(provider, getActiveCount(provider) + 1);
}

function decrementActive(provider: string): void {
  const current = getActiveCount(provider);
  if (current > 0) {
    activeCalls.set(provider, current - 1);
  }
}

function recordRateLimitHit(provider: string): void {
  const existing = rateLimitHits.get(provider) || { count: 0, lastHit: 0 };
  rateLimitHits.set(provider, { count: existing.count + 1, lastHit: Date.now() });
  console.log(`[httpClient] 429 rate limit hit for ${provider}, total hits: ${existing.count + 1}`);
}

export function getRateLimitStats(): Record<string, { count: number; lastHit: number }> {
  const stats: Record<string, { count: number; lastHit: number }> = {};
  for (const [provider, data] of rateLimitHits) {
    stats[provider] = data;
  }
  return stats;
}

async function waitForSlot(provider: string, maxConcurrency: number): Promise<void> {
  while (getActiveCount(provider) >= maxConcurrency) {
    await sleep(100);
  }
}

async function enforceMinDelay(provider: string, minDelayMs: number): Promise<number> {
  const lastTime = lastRequestTime.get(provider) || 0;
  const elapsed = Date.now() - lastTime;
  const waitNeeded = Math.max(0, minDelayMs - elapsed);
  
  if (waitNeeded > 0) {
    await sleep(waitNeeded);
  }
  
  lastRequestTime.set(provider, Date.now());
  return waitNeeded;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoff(attempt: number, config: Required<HttpClientConfig>): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * config.jitterPercent * Math.random();
  return Math.floor(cappedDelay + jitter);
}

function shouldRetry(status: number): boolean {
  // Retry on rate limit (429) and server errors (5xx)
  return status === 429 || (status >= 500 && status < 600);
}

function parseRetryAfter(headers: Headers): number | null {
  const retryAfter = headers.get('Retry-After');
  if (!retryAfter) return null;
  
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }
  
  // Try parsing as HTTP date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }
  
  return null;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  provider: string = 'default',
  config: HttpClientConfig = {},
  budget?: TimeBudget
): Promise<{ response: Response; metrics: RequestMetrics }> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;
  let totalWaitMs = 0;
  
  // Check time budget before starting
  if (budget && budget.isExpired()) {
    throw new Error(`Time budget expired before request to ${url}`);
  }
  
  await waitForSlot(provider, mergedConfig.maxConcurrency);
  incrementActive(provider);
  
  // Enforce minimum delay between requests to same provider
  const delayWait = await enforceMinDelay(provider, mergedConfig.minDelayBetweenRequestsMs);
  totalWaitMs += delayWait;
  
  try {
    for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), mergedConfig.timeoutMs);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok || !shouldRetry(response.status)) {
          return {
            response,
            metrics: {
              attempts: attempt + 1,
              totalWaitMs,
              finalStatus: response.status,
              endpoint: url,
            },
          };
        }
        
        // Track 429s for observability
        if (response.status === 429) {
          recordRateLimitHit(provider);
        }
        
        // Handle retry
        if (attempt < mergedConfig.maxRetries) {
          // Check time budget before retrying
          if (budget && budget.isNearExpiry()) {
            console.log(`[httpClient] Time budget near expiry, returning partial result for ${url}`);
            return {
              response,
              metrics: {
                attempts: attempt + 1,
                totalWaitMs,
                finalStatus: response.status,
                endpoint: url,
              },
            };
          }
          
          const retryAfterMs = parseRetryAfter(response.headers);
          const waitMs = retryAfterMs ?? calculateBackoff(attempt, mergedConfig);
          
          console.log(`[httpClient] ${provider} retry ${attempt + 1}/${mergedConfig.maxRetries} for ${url}, status=${response.status}, waiting ${waitMs}ms`);
          
          totalWaitMs += waitMs;
          await sleep(waitMs);
        } else {
          return {
            response,
            metrics: {
              attempts: attempt + 1,
              totalWaitMs,
              finalStatus: response.status,
              endpoint: url,
            },
          };
        }
      } catch (error) {
        lastError = error as Error;
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`[httpClient] ${provider} timeout for ${url}, attempt ${attempt + 1}`);
        }
        
        if (attempt < mergedConfig.maxRetries) {
          const waitMs = calculateBackoff(attempt, mergedConfig);
          console.log(`[httpClient] ${provider} error retry ${attempt + 1}/${mergedConfig.maxRetries}, waiting ${waitMs}ms: ${error}`);
          totalWaitMs += waitMs;
          await sleep(waitMs);
        }
      }
    }
    
    throw lastError || new Error(`Failed after ${mergedConfig.maxRetries} retries`);
  } finally {
    decrementActive(provider);
  }
}

export async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
  provider: string = 'default',
  config: HttpClientConfig = {},
  budget?: TimeBudget
): Promise<{ data: T; metrics: RequestMetrics }> {
  const { response, metrics } = await fetchWithRetry(url, options, provider, config, budget);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  const data = await response.json() as T;
  return { data, metrics };
}

// Basic batch processing helper
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { batchSize = 10, delayBetweenBatches = 100, onProgress } = options;
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    onProgress?.(Math.min(i + batchSize, items.length), items.length);
    
    if (i + batchSize < items.length) {
      await sleep(delayBetweenBatches);
    }
  }
  
  return results;
}

// Enhanced batch processing with error recovery
export interface BatchOptions<T, R> {
  batchSize?: number;
  delayBetweenBatches?: number;
  onProgress?: (completed: number, total: number, item: T) => void;
  onError?: (item: T, error: Error) => void;
  continueOnError?: boolean;
}

export async function processBatchWithRecovery<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: BatchOptions<T, R> = {}
): Promise<{ results: R[]; errors: Array<{ item: T; error: Error }> }> {
  const {
    batchSize = 10,
    delayBetweenBatches = 100,
    onProgress,
    onError,
    continueOnError = true,
  } = options;

  const results: R[] = [];
  const errors: Array<{ item: T; error: Error }> = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const batchPromises = batch.map(async (item, batchIndex) => {
      try {
        const result = await processor(item);
        onProgress?.(i + batchIndex + 1, items.length, item);
        return { success: true as const, result };
      } catch (error) {
        const err = error as Error;
        errors.push({ item, error: err });
        onError?.(item, err);

        if (!continueOnError) {
          throw error;
        }
        return { success: false as const, result: null };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    for (const r of batchResults) {
      if (r.success && r.result !== null) {
        results.push(r.result);
      }
    }

    if (i + batchSize < items.length) {
      await sleep(delayBetweenBatches);
    }
  }

  return { results, errors };
}

// Parallel batch processing with concurrency control
export async function processParallelBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { concurrency = 5, onProgress } = options;
  const results: R[] = new Array(items.length);
  let completed = 0;
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      results[index] = await processor(item);
      completed++;
      onProgress?.(completed, items.length);
    }
  };

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}
