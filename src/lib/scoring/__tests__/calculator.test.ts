import { describe, it, expect } from 'vitest';
import {
  calculateRawScore,
  calculateBreakdown,
  estimateDwellSignal,
  normalizeScore,
  classifyBucket,
  calculateConfidence,
  calculateAlgoScore,
} from '../calculator';
import { DEFAULT_WEIGHTS, DEFAULT_BUCKET_THRESHOLDS } from '../weights';
import type { TweetMetrics } from '@/lib/types';

// ─── Test Fixtures ──────────────────────────────────────────────────

const zeroMetrics: TweetMetrics = {
  likes: 0,
  retweets: 0,
  replies: 0,
  impressions: 0,
  bookmarks: 0,
  profileClicks: 0,
  linkClicks: 0,
};

const moderateMetrics: TweetMetrics = {
  likes: 50,
  retweets: 10,
  replies: 5,
  impressions: 5000,
  bookmarks: 3,
  profileClicks: 2,
  linkClicks: 10,
};

const viralMetrics: TweetMetrics = {
  likes: 5000,
  retweets: 1500,
  replies: 300,
  impressions: 500000,
  bookmarks: 200,
  profileClicks: 150,
  linkClicks: 500,
  dwellTimeMs: 180000, // 3 minutes
};

// ─── calculateBreakdown ─────────────────────────────────────────────

describe('calculateBreakdown', () => {
  it('returns zero breakdown for zero metrics', () => {
    const breakdown = calculateBreakdown(zeroMetrics);
    expect(breakdown.replyScore).toBe(0);
    expect(breakdown.retweetScore).toBe(0);
    expect(breakdown.likeScore).toBe(0);
    expect(breakdown.bookmarkScore).toBe(0);
    expect(breakdown.dwellScore).toBe(0);
    expect(breakdown.profileClickScore).toBe(0);
  });

  it('correctly applies Heavy Ranker weights', () => {
    const breakdown = calculateBreakdown(moderateMetrics);
    // replies: 5 * 13.5 = 67.5
    expect(breakdown.replyScore).toBe(5 * DEFAULT_WEIGHTS.reply);
    // retweets: 10 * 1 = 10
    expect(breakdown.retweetScore).toBe(10 * DEFAULT_WEIGHTS.retweet);
    // likes: 50 * 0.5 = 25
    expect(breakdown.likeScore).toBe(50 * DEFAULT_WEIGHTS.like);
    // bookmarks: 3 * 10 = 30
    expect(breakdown.bookmarkScore).toBe(3 * DEFAULT_WEIGHTS.bookmark);
    // profileClicks: 2 * 12 = 24
    expect(breakdown.profileClickScore).toBe(2 * DEFAULT_WEIGHTS.profileClickEngage);
  });

  it('replies score is 13.5x likes score per unit', () => {
    const oneReply: TweetMetrics = { ...zeroMetrics, replies: 1 };
    const oneLike: TweetMetrics = { ...zeroMetrics, likes: 1 };
    const replyBreakdown = calculateBreakdown(oneReply);
    const likeBreakdown = calculateBreakdown(oneLike);
    expect(replyBreakdown.replyScore / likeBreakdown.likeScore).toBe(27); // 13.5 / 0.5
  });
});

// ─── calculateRawScore ──────────────────────────────────────────────

describe('calculateRawScore', () => {
  it('returns 0 for zero metrics', () => {
    expect(calculateRawScore(zeroMetrics)).toBe(0);
  });

  it('returns sum of weighted components', () => {
    const breakdown = calculateBreakdown(moderateMetrics);
    const expected =
      breakdown.replyScore +
      breakdown.retweetScore +
      breakdown.likeScore +
      breakdown.bookmarkScore +
      breakdown.dwellScore +
      breakdown.profileClickScore +
      breakdown.conversationClickScore;
    expect(calculateRawScore(moderateMetrics)).toBe(expected);
  });

  it('viral metrics produce significantly higher score than moderate', () => {
    const viralScore = calculateRawScore(viralMetrics);
    const moderateScore = calculateRawScore(moderateMetrics);
    expect(viralScore).toBeGreaterThan(moderateScore * 10);
  });
});

// ─── estimateDwellSignal ────────────────────────────────────────────

describe('estimateDwellSignal', () => {
  it('returns 0 when undefined', () => {
    expect(estimateDwellSignal(undefined)).toBe(0);
  });

  it('returns 0 for short dwell time', () => {
    expect(estimateDwellSignal(60000)).toBe(0); // 1 minute
  });

  it('returns 1 for 2+ minutes', () => {
    expect(estimateDwellSignal(120000)).toBe(1);
    expect(estimateDwellSignal(300000)).toBe(1); // 5 minutes
  });
});

// ─── normalizeScore ─────────────────────────────────────────────────

describe('normalizeScore', () => {
  it('returns 0 for zero score', () => {
    expect(normalizeScore(0)).toBe(0);
  });

  it('returns 0 for negative score', () => {
    expect(normalizeScore(-10)).toBe(0);
  });

  it('returns 100 for score >= maxScore', () => {
    expect(normalizeScore(10000)).toBe(100);
    expect(normalizeScore(99999)).toBe(100);
  });

  it('returns value between 0-100 for normal scores', () => {
    const score = normalizeScore(500);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it('log scaling makes mid-range scores more distinguishable', () => {
    const s100 = normalizeScore(100);
    const s1000 = normalizeScore(1000);
    const s5000 = normalizeScore(5000);
    // Each step should be proportionally meaningful
    expect(s1000 - s100).toBeGreaterThan(0);
    expect(s5000 - s1000).toBeGreaterThan(0);
  });
});

// ─── classifyBucket ─────────────────────────────────────────────────

describe('classifyBucket', () => {
  it('classifies low scores as low', () => {
    expect(classifyBucket(10)).toBe('low');
    expect(classifyBucket(0)).toBe('low');
  });

  it('classifies medium scores as medium', () => {
    expect(classifyBucket(50)).toBe('medium');
    expect(classifyBucket(25)).toBe('medium');
  });

  it('classifies high scores as high', () => {
    expect(classifyBucket(80)).toBe('high');
    expect(classifyBucket(94)).toBe('high');
  });

  it('classifies viral scores as viral', () => {
    expect(classifyBucket(95)).toBe('viral');
    expect(classifyBucket(100)).toBe('viral');
  });

  it('uses custom thresholds correctly', () => {
    const custom = { low: 30, medium: 60, high: 90, viral: 90 };
    expect(classifyBucket(20, custom)).toBe('low');
    expect(classifyBucket(45, custom)).toBe('medium');
    expect(classifyBucket(75, custom)).toBe('high'); // Corrected: 75 >= 60 (medium) but < 90
    expect(classifyBucket(95, custom)).toBe('viral');
  });
});

// ─── calculateConfidence ────────────────────────────────────────────

describe('calculateConfidence', () => {
  it('returns lower confidence for minimal data', () => {
    const confidence = calculateConfidence(zeroMetrics);
    expect(confidence).toBeLessThan(1);
  });

  it('returns higher confidence when more metrics available', () => {
    const sparse = calculateConfidence(zeroMetrics);
    const rich = calculateConfidence(viralMetrics);
    expect(rich).toBeGreaterThan(sparse);
  });

  it('returns value between 0 and 1', () => {
    const confidence = calculateConfidence(moderateMetrics);
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });
});

// ─── calculateAlgoScore (full pipeline) ─────────────────────────────

describe('calculateAlgoScore', () => {
  it('returns complete AlgoScore for zero metrics', () => {
    const score = calculateAlgoScore(zeroMetrics);
    expect(score.raw).toBe(0);
    expect(score.normalized).toBe(0);
    expect(score.bucket).toBe('low');
    expect(score.confidence).toBeLessThan(1);
    expect(score.breakdown).toBeDefined();
  });

  it('returns complete AlgoScore for moderate metrics', () => {
    const score = calculateAlgoScore(moderateMetrics);
    expect(score.raw).toBeGreaterThan(0);
    expect(score.normalized).toBeGreaterThan(0);
    expect(score.normalized).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high', 'viral']).toContain(score.bucket);
    expect(score.confidence).toBeGreaterThan(0);
  });

  it('viral metrics produce higher scores than moderate', () => {
    const viralScore = calculateAlgoScore(viralMetrics);
    const moderateScore = calculateAlgoScore(moderateMetrics);
    expect(viralScore.raw).toBeGreaterThan(moderateScore.raw);
    expect(viralScore.normalized).toBeGreaterThan(moderateScore.normalized);
  });

  it('accepts custom weights', () => {
    const customWeights = { ...DEFAULT_WEIGHTS, like: 100 };
    const defaultScore = calculateAlgoScore(moderateMetrics);
    const customScore = calculateAlgoScore(moderateMetrics, customWeights);
    expect(customScore.raw).toBeGreaterThan(defaultScore.raw);
  });
});
