/**
 * ViralQuill — X API Client Types
 * Type definitions for X API v2 integration.
 */

import type { RateLimitState } from '@/lib/types';

// ─── API Response Types ─────────────────────────────────────────────

export interface XApiResponse<T> {
  data: T;
  meta?: {
    resultCount?: number;
    nextToken?: string;
    previousToken?: string;
  };
  includes?: {
    users?: XApiUser[];
    media?: XApiMedia[];
  };
}

export interface XApiTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count: number;
    impression_count: number;
  };
  non_public_metrics?: {
    url_link_clicks: number;
    user_profile_clicks: number;
  };
  attachments?: {
    media_keys?: string[];
  };
  conversation_id?: string;
  in_reply_to_user_id?: string;
}

export interface XApiUser {
  id: string;
  name: string;
  username: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  verified_type?: 'blue' | 'business' | 'government' | 'none';
  created_at: string;
}

export interface XApiMedia {
  media_key: string;
  type: 'photo' | 'video' | 'animated_gif';
  url?: string;
  preview_image_url?: string;
  alt_text?: string;
}

// ─── API Request Types ──────────────────────────────────────────────

export interface TweetLookupParams {
  ids: string[];                    // max 100 per request (batch)
  tweetFields?: TweetField[];
  userFields?: UserField[];
  expansions?: Expansion[];
}

export interface UserTimelineParams {
  userId: string;
  maxResults?: number;              // 5-100, default 10
  sinceId?: string;
  untilId?: string;
  paginationToken?: string;
  tweetFields?: TweetField[];
  startTime?: string;               // ISO 8601
  endTime?: string;                 // ISO 8601
  exclude?: ('retweets' | 'replies')[];
}

export interface SearchRecentParams {
  query: string;
  maxResults?: number;              // 10-100, default 10
  sinceId?: string;
  untilId?: string;
  nextToken?: string;
  tweetFields?: TweetField[];
  sortOrder?: 'recency' | 'relevancy';
}

export interface CreateTweetParams {
  text: string;
  replyTo?: string;                 // in_reply_to_tweet_id
  quoteTweetId?: string;
  media?: { media_ids: string[] };
  poll?: { options: string[]; duration_minutes: number };
}

// ─── Field Selections ───────────────────────────────────────────────

export type TweetField =
  | 'id' | 'text' | 'author_id' | 'created_at'
  | 'public_metrics' | 'non_public_metrics'
  | 'conversation_id' | 'in_reply_to_user_id'
  | 'attachments' | 'context_annotations'
  | 'entities' | 'lang' | 'source';

export type UserField =
  | 'id' | 'name' | 'username' | 'created_at'
  | 'public_metrics' | 'verified_type'
  | 'description' | 'profile_image_url';

export type Expansion =
  | 'author_id' | 'attachments.media_keys'
  | 'referenced_tweets.id' | 'in_reply_to_user_id';

// ─── Rate Limit Config ──────────────────────────────────────────────

/** X API v2 rate limits per endpoint (per 15-min window) */
export interface EndpointRateLimit {
  perApp15m: number;
  perUser15m: number;
}

export const ENDPOINT_RATE_LIMITS: Record<string, EndpointRateLimit> = {
  'GET /2/tweets':               { perApp15m: 3500,  perUser15m: 5000 },
  'GET /2/tweets/:id':           { perApp15m: 450,   perUser15m: 900 },
  'GET /2/tweets/search/recent': { perApp15m: 450,   perUser15m: 300 },   // most restrictive!
  'GET /2/users/:id/tweets':     { perApp15m: 10000, perUser15m: 900 },
  'GET /2/tweets/analytics':     { perApp15m: 300,   perUser15m: 300 },
  'POST /2/tweets':              { perApp15m: 10000, perUser15m: 100 },
  // Engagement endpoints
  'GET /2/tweets/:id/liking_users':    { perApp15m: 75, perUser15m: 75 },
  'GET /2/tweets/:id/retweeted_by':    { perApp15m: 75, perUser15m: 75 },
  'GET /2/tweets/:id/quote_tweets':    { perApp15m: 75, perUser15m: 75 },
};

// ─── Quota Tracking ─────────────────────────────────────────────────

export interface QuotaState {
  monthlyReadsUsed: number;
  monthlyReadsLimit: number;       // 15K for Basic
  monthlyWritesUsed: number;
  monthlyWritesLimit: number;      // 50K for Basic
  resetsAt: string;                // ISO 8601, first of next month
  cacheHitRate: number;            // 0-1, target >= 0.8
}

export type QuotaLevel = 'normal' | 'warning' | 'critical' | 'exhausted';

// ─── Client Interface ───────────────────────────────────────────────

export interface IXApiClient {
  // Read operations (consume monthly read budget)
  getTweets(params: TweetLookupParams): Promise<XApiResponse<XApiTweet[]>>;
  getUserTimeline(params: UserTimelineParams): Promise<XApiResponse<XApiTweet[]>>;
  searchRecent(params: SearchRecentParams): Promise<XApiResponse<XApiTweet[]>>;

  // Write operations (consume monthly write budget)
  createTweet(params: CreateTweetParams): Promise<XApiResponse<XApiTweet>>;

  // Quota management
  getQuotaState(): QuotaState;
  getQuotaLevel(): QuotaLevel;
  getRateLimitState(endpoint: string): RateLimitState | null;
}
