// Centralized HTTP client with rate limiting, backoff, and retry logic
// All sync functions should use this to ensure consistent behavior

export interface HttpClientConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterPercent?: number;
  timeoutMs?: number;
  maxConcurrency?: number;
}

export interface RequestMetrics {
  attempts: number;
  totalWaitMs: number;
  finalStatus: number;
  endpoint: string;
}

const DEFAULT_CONFIG: Required<HttpClientConfig> = {
  maxRetries: 6,
  baseDelayMs: 2000,
  maxDelayMs: 120000, // 2 minutes
  jitterPercent: 0.3,
  timeoutMs: 30000,
  maxConcurrency: 2,
};

// Simple in-memory concurrency limiter per provider
const activeCalls: Map<string, number> = new Map();

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

async function waitForSlot(provider: string, maxConcurrency: number): Promise<void> {
  while (getActiveCount(provider) >= maxConcurrency) {
    await sleep(100);
  }
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
  config: HttpClientConfig = {}
): Promise<{ response: Response; metrics: RequestMetrics }> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;
  let totalWaitMs = 0;
  
  await waitForSlot(provider, mergedConfig.maxConcurrency);
  incrementActive(provider);
  
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
        
        // Handle retry
        if (attempt < mergedConfig.maxRetries) {
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
  config: HttpClientConfig = {}
): Promise<{ data: T; metrics: RequestMetrics }> {
  const { response, metrics } = await fetchWithRetry(url, options, provider, config);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  const data = await response.json() as T;
  return { data, metrics };
}

// Batch processing helper with rate limiting
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
