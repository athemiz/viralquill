/**
 * Tests for X API retry/backoff logic.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateDelay,
  isRetryable,
  parseRateLimitHeaders,
  delayUntilReset,
  withRetry,
  XApiError,
} from '../retry';
import type { RetryConfig } from '../retry';

describe('calculateDelay', () => {
  const noJitterConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 60_000,
    backoffMultiplier: 2,
    jitter: false,
  };

  it('calculates exponential delays without jitter', () => {
    expect(calculateDelay(0, noJitterConfig)).toBe(1000); // 1000 * 2^0
    expect(calculateDelay(1, noJitterConfig)).toBe(2000); // 1000 * 2^1
    expect(calculateDelay(2, noJitterConfig)).toBe(4000); // 1000 * 2^2
    expect(calculateDelay(3, noJitterConfig)).toBe(8000); // 1000 * 2^3
  });

  it('caps delay at maxDelayMs', () => {
    const config: RetryConfig = { ...noJitterConfig, maxDelayMs: 3000 };
    expect(calculateDelay(0, config)).toBe(1000);
    expect(calculateDelay(1, config)).toBe(2000);
    expect(calculateDelay(2, config)).toBe(3000); // capped
    expect(calculateDelay(5, config)).toBe(3000); // still capped
  });

  it('adds jitter within ±25% range', () => {
    const jitterConfig: RetryConfig = { ...noJitterConfig, jitter: true };
    const delays = Array.from({ length: 100 }, () => calculateDelay(1, jitterConfig));

    // Base delay at attempt 1 = 2000ms
    // Jitter range: 2000 ± 500 = [1500, 2500]
    expect(delays.every((d) => d >= 1500 && d <= 2500)).toBe(true);
    // Should have some variation (not all identical)
    const unique = new Set(delays);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('isRetryable', () => {
  it('retries 429 (rate limited)', () => {
    expect(isRetryable(429)).toBe(true);
  });

  it('retries server errors (500-504)', () => {
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(502)).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(504)).toBe(true);
  });

  it('does not retry client errors', () => {
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
    expect(isRetryable(403)).toBe(false);
    expect(isRetryable(404)).toBe(false);
    expect(isRetryable(422)).toBe(false);
  });

  it('does not retry 200 OK', () => {
    expect(isRetryable(200)).toBe(false);
  });
});

describe('parseRateLimitHeaders', () => {
  it('parses valid X API rate limit headers', () => {
    const result = parseRateLimitHeaders({
      'x-rate-limit-limit': '900',
      'x-rate-limit-remaining': '450',
      'x-rate-limit-reset': '1770523000',
    });

    expect(result).not.toBeNull();
    expect(result!.limit).toBe(900);
    expect(result!.remaining).toBe(450);
    expect(result!.resetAt).toBeInstanceOf(Date);
  });

  it('returns null when headers are missing', () => {
    expect(parseRateLimitHeaders({})).toBeNull();
    expect(parseRateLimitHeaders({ 'x-rate-limit-limit': '900' })).toBeNull();
  });
});

describe('delayUntilReset', () => {
  it('returns positive delay for future reset', () => {
    const future = new Date(Date.now() + 60_000); // 60s from now
    const delay = delayUntilReset(future);
    // Should be ~61s (60s + 1s buffer)
    expect(delay).toBeGreaterThan(59_000);
    expect(delay).toBeLessThan(63_000);
  });

  it('returns 0 for past reset time', () => {
    const past = new Date(Date.now() - 60_000);
    expect(delayUntilReset(past)).toBe(0);
  });
});

describe('withRetry', () => {
  const fastConfig: RetryConfig = {
    maxRetries: 2,
    baseDelayMs: 1,
    maxDelayMs: 10,
    backoffMultiplier: 2,
    jitter: false,
  };

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, fastConfig);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new XApiError('rate limited', 429, 'GET /2/tweets'))
      .mockResolvedValue('success after retry');

    const result = await withRetry(fn, fastConfig);
    expect(result).toBe('success after retry');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(new XApiError('server error', 500, 'GET /2/tweets'));

    await expect(withRetry(fn, fastConfig)).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new XApiError('not found', 404, 'GET /2/tweets'));

    await expect(withRetry(fn, fastConfig)).rejects.toThrow('not found');
    expect(fn).toHaveBeenCalledTimes(1); // no retries
  });

  it('calls onRetry callback before each retry', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new XApiError('error', 500, 'GET /2/tweets'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();

    await withRetry(fn, fastConfig, onRetry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(0, expect.any(Number), expect.any(XApiError));
  });
});

describe('XApiError', () => {
  it('creates error with correct properties', () => {
    const error = new XApiError('rate limited', 429, 'GET /2/tweets');
    expect(error.name).toBe('XApiError');
    expect(error.message).toBe('rate limited');
    expect(error.statusCode).toBe(429);
    expect(error.endpoint).toBe('GET /2/tweets');
    expect(error.retryable).toBe(true);
  });

  it('marks non-retryable errors correctly', () => {
    const error = new XApiError('forbidden', 403, 'POST /2/tweets');
    expect(error.retryable).toBe(false);
  });
});
