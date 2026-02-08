/**
 * ViralQuill — Scoring Calculator
 * Pure functions, zero API calls. 100% testable.
 *
 * Calculates algo_score based on X Heavy Ranker weights.
 * Classifies posts into engagement buckets (low/medium/high/viral).
 */

import type {
  TweetMetrics,
  AlgorithmWeights,
  AlgoScore,
  ScoreBreakdown,
  EngagementBucket,
  BucketThresholds,
} from '@/lib/types';
import { DEFAULT_WEIGHTS, DEFAULT_BUCKET_THRESHOLDS } from './weights';

/**
 * Calculate the weighted algo_score for a tweet's engagement metrics.
 *
 * The score is a weighted sum of engagement signals based on
 * the X Heavy Ranker open-source weights.
 *
 * @param metrics - Tweet engagement metrics
 * @param weights - Algorithm weights (defaults to X Heavy Ranker weights)
 * @returns Raw weighted score
 */
export function calculateRawScore(
  metrics: TweetMetrics,
  weights: AlgorithmWeights = DEFAULT_WEIGHTS,
): number {
  const breakdown = calculateBreakdown(metrics, weights);
  return (
    breakdown.replyScore +
    breakdown.retweetScore +
    breakdown.likeScore +
    breakdown.bookmarkScore +
    breakdown.dwellScore +
    breakdown.profileClickScore +
    breakdown.conversationClickScore
  );
}

/**
 * Calculate the per-signal score breakdown.
 *
 * @param metrics - Tweet engagement metrics
 * @param weights - Algorithm weights
 * @returns Score contribution from each signal
 */
export function calculateBreakdown(
  metrics: TweetMetrics,
  weights: AlgorithmWeights = DEFAULT_WEIGHTS,
): ScoreBreakdown {
  return {
    replyScore: metrics.replies * weights.reply,
    retweetScore: metrics.retweets * weights.retweet,
    likeScore: metrics.likes * weights.like,
    bookmarkScore: metrics.bookmarks * weights.bookmark,
    dwellScore: estimateDwellSignal(metrics.dwellTimeMs) * weights.dwellTime2min,
    profileClickScore: metrics.profileClicks * weights.profileClickEngage,
    conversationClickScore: 0, // Not available from API — placeholder
  };
}

/**
 * Estimate the dwell time signal (binary: did user stay 2+ min?).
 * In production, this would come from API analytics.
 * For now, we estimate based on impressions-to-engagement ratio.
 *
 * @param dwellTimeMs - Estimated dwell time in milliseconds
 * @returns 1 if >= 120s, 0 otherwise
 */
export function estimateDwellSignal(dwellTimeMs?: number): number {
  if (dwellTimeMs === undefined) return 0;
  return dwellTimeMs >= 120_000 ? 1 : 0;
}

/**
 * Normalize a raw score to 0-100 scale.
 * Uses log scaling to handle the wide range of raw scores.
 *
 * @param rawScore - Raw weighted score
 * @param maxScore - Reference max score for normalization (default: 10000)
 * @returns Normalized score 0-100
 */
export function normalizeScore(rawScore: number, maxScore: number = 10000): number {
  if (rawScore <= 0) return 0;
  if (rawScore >= maxScore) return 100;

  // Log-scale normalization for better distribution
  const logScore = Math.log1p(rawScore);
  const logMax = Math.log1p(maxScore);
  return Math.round((logScore / logMax) * 100);
}

/**
 * Classify a normalized score into an engagement bucket.
 *
 * @param normalizedScore - Score on 0-100 scale
 * @param thresholds - Bucket thresholds (percentile-based)
 * @returns Engagement bucket classification
 */
export function classifyBucket(
  normalizedScore: number,
  thresholds: BucketThresholds = DEFAULT_BUCKET_THRESHOLDS,
): EngagementBucket {
  // Threshold interpretation:
  // thresholds.low = p25 (where 'medium' starts)
  // thresholds.medium = p75 (where 'high' starts)
  // thresholds.high/viral = p95 (where 'viral' starts)
  if (normalizedScore >= thresholds.high) return 'viral'; // >= p95
  if (normalizedScore >= thresholds.medium) return 'high'; // p75 <= score < p95
  if (normalizedScore >= thresholds.low) return 'medium'; // p25 <= score < p75
  return 'low'; // score < p25
}

/**
 * Calculate confidence based on data completeness.
 * Higher confidence when more metrics are available.
 *
 * @param metrics - Tweet engagement metrics
 * @returns Confidence score 0-1
 */
export function calculateConfidence(metrics: TweetMetrics): number {
  let available = 0;
  const total = 7; // total metric fields

  if (metrics.likes >= 0) available++;
  if (metrics.retweets >= 0) available++;
  if (metrics.replies >= 0) available++;
  if (metrics.impressions > 0) available++;
  if (metrics.bookmarks >= 0) available++;
  if (metrics.profileClicks > 0) available++;
  if (metrics.dwellTimeMs !== undefined) available++;

  return Number((available / total).toFixed(2));
}

/**
 * Full scoring pipeline: metrics → AlgoScore.
 *
 * @param metrics - Tweet engagement metrics
 * @param weights - Algorithm weights (optional, defaults to Heavy Ranker)
 * @param thresholds - Bucket thresholds (optional)
 * @returns Complete AlgoScore with raw, normalized, bucket, breakdown, confidence
 */
export function calculateAlgoScore(
  metrics: TweetMetrics,
  weights: AlgorithmWeights = DEFAULT_WEIGHTS,
  thresholds: BucketThresholds = DEFAULT_BUCKET_THRESHOLDS,
): AlgoScore {
  const breakdown = calculateBreakdown(metrics, weights);
  const raw = calculateRawScore(metrics, weights);
  const normalized = normalizeScore(raw);
  const bucket = classifyBucket(normalized, thresholds);
  const confidence = calculateConfidence(metrics);

  return {
    raw,
    normalized,
    bucket,
    breakdown,
    confidence,
  };
}
