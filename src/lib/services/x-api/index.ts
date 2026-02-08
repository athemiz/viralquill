/**
 * ViralQuill — X API Service
 * Public API surface for X API integration.
 */

export { XApiClient } from './client';
export type { XApiClientConfig } from './client';

export { QuotaTracker } from './quota-tracker';
export type { QuotaTrackerConfig } from './quota-tracker';

export { withRetry, XApiError, calculateDelay, isRetryable, parseRateLimitHeaders } from './retry';
export type { RetryConfig, RateLimitHeaders } from './retry';

export type {
  IXApiClient,
  XApiResponse,
  XApiTweet,
  XApiUser,
  XApiMedia,
  TweetLookupParams,
  UserTimelineParams,
  SearchRecentParams,
  CreateTweetParams,
  QuotaState,
  QuotaLevel,
  EndpointRateLimit,
  ENDPOINT_RATE_LIMITS,
} from './types';
