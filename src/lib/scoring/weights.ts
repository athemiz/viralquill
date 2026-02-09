/**
 * ViralQuill — Algorithm Weights
 * Based on X Heavy Ranker open-source code (github.com/twitter/the-algorithm)
 * Confirmed by 3 independent sources: Hashmeta, Tweet Archivist, igorbrigadir/awesome-twitter-algo
 *
 * These weights represent the relative importance of each engagement signal
 * in the X recommendation algorithm as of 2025/2026.
 */

import type { AlgorithmWeights, BucketThresholds } from '@/lib/types';

/**
 * Default algorithm weights from X Heavy Ranker.
 * reply_engaged_by_author = 150x more powerful than a like.
 */
export const DEFAULT_WEIGHTS: AlgorithmWeights = {
  replyEngagedByAuthor: 75, // Author replies to a reply — strongest signal
  reply: 13.5, // Getting a reply
  profileClickEngage: 12, // Profile click leading to engagement
  conversationClick: 11, // Click to expand conversation
  dwellTime2min: 10, // User spends 2+ min on post
  bookmark: 10, // Save for later — strong intent signal
  retweet: 20, // Repost (20x a like)
  like: 0.5, // Baseline engagement signal
};

/**
 * Default engagement bucket thresholds (percentile-based).
 * Per-creator thresholds when creator has >= MIN_POSTS_FOR_CREATOR_PERCENTILES posts.
 * Falls back to global dataset percentiles otherwise.
 */
export const DEFAULT_BUCKET_THRESHOLDS: BucketThresholds = {
  low: 25, // < p25
  medium: 75, // p25 - p75
  high: 95, // p75 - p95
  viral: 95, // > p95
};

/** Minimum posts required before using per-creator percentiles */
export const MIN_POSTS_FOR_CREATOR_PERCENTILES = 50;

/** Global dataset fallback percentile values (to be calibrated with real data) */
export const GLOBAL_PERCENTILES = {
  p25: 0, // placeholder — calibrate with Kaggle seed dataset
  p50: 0, // placeholder
  p75: 0, // placeholder
  p95: 0, // placeholder
  p99: 0, // placeholder
};
