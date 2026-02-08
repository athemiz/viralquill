/**
 * ViralQuill — Retry & Backoff Logic
 * Exponential backoff with jitter for X API rate limit handling.
 * Follows X's recommended retry strategy.
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Calculate delay for a given retry attempt using exponential backoff.
 *
 * @param attempt - Retry attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  // Exponential: base * multiplier^attempt
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter (±25%) to avoid thundering herd
  if (config.jitter) {
    const jitterRange = cappedDelay * 0.25;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  return Math.round(cappedDelay);
}

/**
 * Determine if an error is retryable.
 *
 * @param statusCode - HTTP status code
 * @returns Whether the request should be retried
 */
export function isRetryable(statusCode: number): boolean {
  // 429: Rate limited — always retry with backoff
  // 500, 502, 503, 504: Server errors — transient, retry
  // Everything else: not retryable
  return statusCode === 429 || (statusCode >= 500 && statusCode <= 504);
}

/**
 * Parse rate limit headers from X API response.
 *
 * X API returns:
 *   x-rate-limit-limit: max requests in window
 *   x-rate-limit-remaining: remaining requests in window
 *   x-rate-limit-reset: Unix timestamp when window resets
 */
export interface RateLimitHeaders {
  limit: number;
  remaining: number;
  resetAt: Date;
}

export function parseRateLimitHeaders(headers: Record<string, string>): RateLimitHeaders | null {
  const limit = headers['x-rate-limit-limit'];
  const remaining = headers['x-rate-limit-remaining'];
  const reset = headers['x-rate-limit-reset'];

  if (!limit || !remaining || !reset) return null;

  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    resetAt: new Date(parseInt(reset, 10) * 1000),
  };
}

/**
 * Calculate delay based on rate limit reset time.
 * If we know when the window resets, wait until then instead of guessing.
 *
 * @param resetAt - When the rate limit window resets
 * @returns Delay in milliseconds (0 if already reset)
 */
export function delayUntilReset(resetAt: Date): number {
  const now = Date.now();
  const resetMs = resetAt.getTime();
  const delay = resetMs - now;
  // Add 1s buffer to account for clock skew
  return Math.max(0, delay + 1000);
}

/**
 * Sleep for a given duration.
 *
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic.
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @param onRetry - Optional callback called before each retry
 * @returns Result of fn
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, delay: number, error: XApiError) => void,
): Promise<T> {
  let lastError: XApiError | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as XApiError;

      // Don't retry if not retryable or last attempt
      if (!isRetryable(lastError.statusCode) || attempt === config.maxRetries) {
        throw lastError;
      }

      // If we have rate limit headers, use reset time
      let delay: number;
      if (lastError.statusCode === 429 && lastError.rateLimitReset) {
        delay = delayUntilReset(lastError.rateLimitReset);
      } else {
        delay = calculateDelay(attempt, config);
      }

      onRetry?.(attempt, delay, lastError);
      await sleep(delay);
    }
  }

  throw lastError;
}

// ─── Error Types ────────────────────────────────────────────────────

export class XApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly rateLimitReset?: Date,
    public readonly retryable: boolean = isRetryable(statusCode),
  ) {
    super(message);
    this.name = 'XApiError';
  }
}
