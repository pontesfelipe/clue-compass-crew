// Circuit Breaker pattern to prevent cascading failures
// Protects against repeated failures to external APIs

export enum CircuitState {
  CLOSED = "CLOSED",     // Normal operation
  OPEN = "OPEN",         // Blocking requests
  HALF_OPEN = "HALF_OPEN" // Testing recovery
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60000, // 1 minute
    private halfOpenSuccessThreshold: number = 2
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      // Check if we should transition to HALF_OPEN
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        console.log("[CircuitBreaker] Transitioning to HALF_OPEN");
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error("Circuit breaker is OPEN - failing fast");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        console.log("[CircuitBreaker] Transitioning to CLOSED");
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      console.log("[CircuitBreaker] Transitioning to OPEN");
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): { state: CircuitState; failureCount: number; successCount: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

// Global circuit breakers per service
const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  service: string,
  options?: {
    failureThreshold?: number;
    resetTimeoutMs?: number;
    halfOpenSuccessThreshold?: number;
  }
): CircuitBreaker {
  if (!breakers.has(service)) {
    breakers.set(
      service,
      new CircuitBreaker(
        options?.failureThreshold,
        options?.resetTimeoutMs,
        options?.halfOpenSuccessThreshold
      )
    );
  }
  return breakers.get(service)!;
}

export function getAllCircuitBreakerStats(): Record<string, { state: CircuitState; failureCount: number; successCount: number }> {
  const stats: Record<string, { state: CircuitState; failureCount: number; successCount: number }> = {};
  for (const [service, breaker] of breakers) {
    stats[service] = breaker.getStats();
  }
  return stats;
}
