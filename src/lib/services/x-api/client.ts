/**
 * ViralQuill — X API Client
 * Abstracted client for X API v2 with:
 * - Batch reads (100 IDs per request)
 * - Retry with exponential backoff + jitter
 * - Quota tracking (15K reads/mo shared cap)
 * - Rate limit awareness per endpoint
 * - Mock mode for local development
 */

import type {
  IXApiClient,
  XApiResponse,
  XApiTweet,
  TweetLookupParams,
  UserTimelineParams,
  SearchRecentParams,
  CreateTweetParams,
  QuotaState,
  QuotaLevel,
} from './types';
import type { RateLimitState } from '@/lib/types';
import { withRetry, XApiError, parseRateLimitHeaders, DEFAULT_RETRY_CONFIG } from './retry';
import type { RetryConfig } from './retry';
import { QuotaTracker } from './quota-tracker';
import type { QuotaTrackerConfig } from './quota-tracker';

// ─── Default Tweet Fields ───────────────────────────────────────────

const DEFAULT_TWEET_FIELDS = [
  'id',
  'text',
  'author_id',
  'created_at',
  'public_metrics',
  'conversation_id',
  'in_reply_to_user_id',
  'attachments',
] as const;

const DEFAULT_USER_FIELDS = [
  'id',
  'name',
  'username',
  'created_at',
  'public_metrics',
  'verified_type',
] as const;

// ─── Client Configuration ───────────────────────────────────────────

export interface XApiClientConfig {
  bearerToken?: string;
  userAccessToken?: string;
  baseUrl?: string;
  retryConfig?: Partial<RetryConfig>;
  quotaConfig?: Partial<QuotaTrackerConfig>;
  mockMode?: boolean;
}

// ─── Client Implementation ─────────────────────────────────────────

export class XApiClient implements IXApiClient {
  private readonly baseUrl: string;
  private readonly bearerToken: string;
  private readonly userAccessToken?: string;
  private readonly retryConfig: RetryConfig;
  private readonly quota: QuotaTracker;
  private readonly mockMode: boolean;
  private readonly rateLimitStates: Map<string, RateLimitState> = new Map();

  constructor(config: XApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'https://api.x.com';
    this.bearerToken = config.bearerToken ?? '';
    this.userAccessToken = config.userAccessToken;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
    this.quota = new QuotaTracker(config.quotaConfig);
    this.mockMode = config.mockMode ?? !config.bearerToken;
  }

  // ─── Read Operations ──────────────────────────────────────────

  /**
   * Batch lookup tweets by IDs.
   * Uses GET /2/tweets — max 100 IDs per request = 100x more efficient.
   * Consumes 1 read per request (regardless of how many IDs).
   */
  async getTweets(params: TweetLookupParams): Promise<XApiResponse<XApiTweet[]>> {
    if (this.mockMode) return this.mockGetTweets(params);

    // Batch into chunks of 100
    const chunks = this.chunkArray(params.ids, 100);
    const allTweets: XApiTweet[] = [];

    for (const chunk of chunks) {
      if (!this.quota.canRead()) {
        throw new XApiError(
          'Monthly read quota exhausted. Serving cached data.',
          429,
          'GET /2/tweets',
        );
      }

      const response = await this.request<XApiTweet[]>('GET', '/2/tweets', {
        ids: chunk.join(','),
        'tweet.fields': (params.tweetFields ?? DEFAULT_TWEET_FIELDS).join(','),
        'user.fields': (params.userFields ?? DEFAULT_USER_FIELDS).join(','),
        expansions: (params.expansions ?? ['author_id']).join(','),
      });

      this.quota.recordReads(1); // 1 read per batch request
      if (response.data) {
        allTweets.push(...(Array.isArray(response.data) ? response.data : [response.data]));
      }
    }

    return { data: allTweets };
  }

  /**
   * Get a user's timeline.
   * Uses GET /2/users/:id/tweets.
   * Consumes 1 read per request.
   */
  async getUserTimeline(params: UserTimelineParams): Promise<XApiResponse<XApiTweet[]>> {
    if (this.mockMode) return this.mockGetTimeline(params);

    if (!this.quota.canRead()) {
      throw new XApiError('Monthly read quota exhausted.', 429, 'GET /2/users/:id/tweets');
    }

    const queryParams: Record<string, string> = {
      'tweet.fields': (params.tweetFields ?? DEFAULT_TWEET_FIELDS).join(','),
      max_results: String(params.maxResults ?? 10),
    };

    if (params.sinceId) queryParams.since_id = params.sinceId;
    if (params.untilId) queryParams.until_id = params.untilId;
    if (params.paginationToken) queryParams.pagination_token = params.paginationToken;
    if (params.startTime) queryParams.start_time = params.startTime;
    if (params.endTime) queryParams.end_time = params.endTime;
    if (params.exclude) queryParams.exclude = params.exclude.join(',');

    const response = await this.request<XApiTweet[]>(
      'GET',
      `/2/users/${params.userId}/tweets`,
      queryParams,
    );

    this.quota.recordReads(1);
    return response;
  }

  /**
   * Search recent tweets.
   * Uses GET /2/tweets/search/recent.
   * MOST RESTRICTIVE: 300/15min per-user.
   * Consumes 1 read per request.
   */
  async searchRecent(params: SearchRecentParams): Promise<XApiResponse<XApiTweet[]>> {
    if (this.mockMode) return this.mockSearch(params);

    if (!this.quota.canRead()) {
      throw new XApiError('Monthly read quota exhausted.', 429, 'GET /2/tweets/search/recent');
    }

    const queryParams: Record<string, string> = {
      query: params.query,
      'tweet.fields': (params.tweetFields ?? DEFAULT_TWEET_FIELDS).join(','),
      max_results: String(params.maxResults ?? 10),
    };

    if (params.sinceId) queryParams.since_id = params.sinceId;
    if (params.nextToken) queryParams.next_token = params.nextToken;
    if (params.sortOrder) queryParams.sort_order = params.sortOrder;

    const response = await this.request<XApiTweet[]>('GET', '/2/tweets/search/recent', queryParams);

    this.quota.recordReads(1);
    return response;
  }

  // ─── Write Operations ─────────────────────────────────────────

  /**
   * Create a new tweet.
   * Uses POST /2/tweets.
   * Consumes 1 write.
   */
  async createTweet(params: CreateTweetParams): Promise<XApiResponse<XApiTweet>> {
    if (this.mockMode) return this.mockCreateTweet(params);

    if (!this.quota.canWrite()) {
      throw new XApiError('Monthly write quota exhausted.', 429, 'POST /2/tweets');
    }

    const body: Record<string, unknown> = { text: params.text };
    if (params.replyTo) body.reply = { in_reply_to_tweet_id: params.replyTo };
    if (params.quoteTweetId) body.quote_tweet_id = params.quoteTweetId;
    if (params.media) body.media = params.media;
    if (params.poll) body.poll = params.poll;

    const response = await this.request<XApiTweet>('POST', '/2/tweets', undefined, body);

    this.quota.recordWrites(1);
    return response;
  }

  // ─── Quota Management ─────────────────────────────────────────

  getQuotaState(): QuotaState {
    this.quota.checkAndReset();
    return this.quota.getState();
  }

  getQuotaLevel(): QuotaLevel {
    this.quota.checkAndReset();
    return this.quota.getLevel();
  }

  getRateLimitState(endpoint: string): RateLimitState | null {
    return this.rateLimitStates.get(endpoint) ?? null;
  }

  /**
   * Load persisted quota state (e.g., from Redis/Supabase on startup).
   */
  loadQuotaState(state: Partial<QuotaState>): void {
    this.quota.loadState(state);
  }

  /**
   * Set active user count for fair share calculation.
   */
  setActiveUsers(count: number): void {
    this.quota.setActiveUsers(count);
  }

  // ─── HTTP Layer ───────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    queryParams?: Record<string, string>,
    body?: Record<string, unknown>,
  ): Promise<XApiResponse<T>> {
    const endpoint = `${method} ${path.replace(/\/[a-zA-Z0-9]+$/, '/:id')}`;

    return withRetry(
      async () => {
        const url = new URL(path, this.baseUrl);
        if (queryParams) {
          Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.userAccessToken ?? this.bearerToken}`,
          'Content-Type': 'application/json',
        };

        const response = await fetch(url.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        // Parse and store rate limit headers
        const rateLimitHeaders = parseRateLimitHeaders(
          Object.fromEntries(response.headers.entries()),
        );
        if (rateLimitHeaders) {
          this.rateLimitStates.set(endpoint, {
            endpoint,
            remaining: rateLimitHeaders.remaining,
            resetAt: rateLimitHeaders.resetAt.toISOString(),
            limit: rateLimitHeaders.limit,
            scope: this.userAccessToken ? 'user' : 'app',
          });
        }

        if (!response.ok) {
          throw new XApiError(
            `X API error: ${response.status} ${response.statusText}`,
            response.status,
            endpoint,
            rateLimitHeaders?.resetAt,
          );
        }

        return response.json() as Promise<XApiResponse<T>>;
      },
      this.retryConfig,
      (attempt, delay, error) => {
        console.warn(
          `[X API] Retry ${attempt + 1}/${this.retryConfig.maxRetries} for ${endpoint} ` +
            `after ${delay}ms (${error.statusCode}: ${error.message})`,
        );
      },
    );
  }

  // ─── Mock Implementations ─────────────────────────────────────

  private mockGetTweets(params: TweetLookupParams): XApiResponse<XApiTweet[]> {
    this.quota.recordReads(1);
    return {
      data: params.ids.map((id) => this.createMockTweet(id)),
    };
  }

  private mockGetTimeline(params: UserTimelineParams): XApiResponse<XApiTweet[]> {
    this.quota.recordReads(1);
    const count = params.maxResults ?? 10;
    return {
      data: Array.from({ length: count }, (_, i) =>
        this.createMockTweet(`timeline-${params.userId}-${i}`),
      ),
      meta: { resultCount: count },
    };
  }

  private mockSearch(params: SearchRecentParams): XApiResponse<XApiTweet[]> {
    this.quota.recordReads(1);
    const count = params.maxResults ?? 10;
    return {
      data: Array.from({ length: count }, (_, i) =>
        this.createMockTweet(`search-${i}`, `Mock result for: ${params.query}`),
      ),
      meta: { resultCount: count },
    };
  }

  private mockCreateTweet(params: CreateTweetParams): XApiResponse<XApiTweet> {
    this.quota.recordWrites(1);
    return {
      data: this.createMockTweet(`new-${Date.now()}`, params.text),
    };
  }

  private createMockTweet(id: string, text?: string): XApiTweet {
    return {
      id,
      text: text ?? `Mock tweet ${id}. This is a sample tweet for local development.`,
      author_id: 'mock-author-001',
      created_at: new Date().toISOString(),
      public_metrics: {
        retweet_count: Math.floor(Math.random() * 50),
        reply_count: Math.floor(Math.random() * 20),
        like_count: Math.floor(Math.random() * 200),
        quote_count: Math.floor(Math.random() * 10),
        bookmark_count: Math.floor(Math.random() * 30),
        impression_count: Math.floor(Math.random() * 5000) + 100,
      },
    };
  }

  // ─── Utilities ────────────────────────────────────────────────

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
