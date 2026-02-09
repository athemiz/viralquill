/**
 * ViralQuill — Core TypeScript Data Models
 * Aligned with research report v4 schema and Tech Lead decisions.
 */

// ─── Tweet & Content ────────────────────────────────────────────────

export interface Tweet {
  id: string;
  text: string;
  authorId: string;
  createdAt: string; // ISO 8601
  metrics: TweetMetrics;
  media?: MediaAttachment[];
  isThread: boolean;
  threadPosition?: number;
  parentId?: string;
}

export interface TweetMetrics {
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  bookmarks: number;
  profileClicks: number;
  linkClicks: number;
  dwellTimeMs?: number; // estimated
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'gif';
  url: string;
  altText?: string;
}

// ─── User / Author ──────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  displayName: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  isPremium: boolean;
  tweepCred?: number; // 0-100, algorithm signal
  createdAt: string;
}

// ─── Scoring ────────────────────────────────────────────────────────

/** Algorithm weight configuration based on X Heavy Ranker open-source weights */
export interface AlgorithmWeights {
  replyEngagedByAuthor: number; // 75 (150x like)
  reply: number; // 13.5
  profileClickEngage: number; // 12
  conversationClick: number; // 11
  dwellTime2min: number; // 10
  bookmark: number; // 10
  retweet: number; // 1 (20x like baseline)
  like: number; // 0.5 (baseline)
}

export type EngagementBucket = 'low' | 'medium' | 'high' | 'viral';

/**
 * Engagement bucket thresholds — percentile-based.
 * Per-creator when >= 50 posts, fallback to global.
 */
export interface BucketThresholds {
  low: number; // < p25
  medium: number; // p25 - p75
  high: number; // p75 - p95
  viral: number; // > p95
}

export interface AlgoScore {
  raw: number; // weighted composite score
  normalized: number; // 0-100 scale
  bucket: EngagementBucket;
  breakdown: ScoreBreakdown;
  confidence: number; // 0-1, based on data quality
}

export interface ScoreBreakdown {
  replyScore: number;
  retweetScore: number;
  likeScore: number;
  bookmarkScore: number;
  dwellScore: number;
  profileClickScore: number;
  conversationClickScore: number;
}

// ─── Content Rewriting ──────────────────────────────────────────────

export interface RewriteRequest {
  originalText: string;
  targetTone?: ToneType;
  targetLength?: 'short' | 'medium' | 'thread';
  preserveIntent: boolean;
  includeHook: boolean;
  avoidExternalLinks: boolean;
}

export type ToneType =
  | 'professional'
  | 'casual'
  | 'authoritative'
  | 'humorous'
  | 'provocative'
  | 'educational';

export interface RewriteResult {
  rewrittenText: string;
  predictedScore: AlgoScore;
  changes: string[]; // human-readable list of changes made
  tone: ToneType;
  hookUsed?: string;
}

// ─── LLM Judge (Quality Scoring) ────────────────────────────────────

export interface JudgeResult {
  grammar: number; // 1-5 rubric
  fluency: number; // 1-5 rubric
  tone: number; // 1-5 rubric
  overall: number; // average
  feedback: string;
}

// ─── Scheduling ─────────────────────────────────────────────────────

export interface ScheduledPost {
  id: string;
  userId: string;
  content: string;
  scheduledAt: string; // ISO 8601
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  tweetId?: string; // populated after posting
  predictedScore: AlgoScore;
  media?: MediaAttachment[];
}

// ─── Analytics ──────────────────────────────────────────────────────

export interface PostAnalytics {
  tweetId: string;
  predictedScore: AlgoScore;
  actualMetrics: TweetMetrics;
  accuracy: number; // predicted vs actual deviation
  collectedAt: string;
}

// ─── Reply Suggestions ──────────────────────────────────────────────

export interface ReplySuggestion {
  id: string;
  parentTweetId: string;
  suggestedText: string;
  tone: ToneType;
  predictedEngagement: EngagementBucket;
}

// ─── API / Service Layer ────────────────────────────────────────────

export interface LLMServiceConfig {
  provider: 'openai' | 'anthropic' | 'mock';
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface XApiConfig {
  tier: 'free' | 'basic' | 'pro';
  monthlyReadCap: number;
  monthlyWriteCap: number;
  oauthVersion: '2.0';
}

export interface RateLimitState {
  endpoint: string;
  remaining: number;
  resetAt: string; // ISO 8601
  limit: number;
  scope: 'app' | 'user';
}
