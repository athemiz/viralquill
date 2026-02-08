/**
 * POST /api/analyze
 * Analyze draft text and return content signals + scoring.
 * 100% local — no external API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeContent } from '@/lib/analyzer';
import { calculateAlgoScore } from '@/lib/scoring';
import type { TweetMetrics } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Analyze content signals
    const signals = analyzeContent(text);

    // Create estimated metrics from pre-optimization score
    // (In production, these would come from the engagement prediction model)
    const estimatedMetrics: TweetMetrics = {
      likes: Math.round(signals.preOptimizationScore * 2),
      retweets: Math.round(signals.preOptimizationScore * 0.5),
      replies: signals.hasQuestion ? Math.round(signals.preOptimizationScore * 1.5) : Math.round(signals.preOptimizationScore * 0.3),
      impressions: Math.round(signals.preOptimizationScore * 100),
      bookmarks: Math.round(signals.preOptimizationScore * 0.2),
      profileClicks: Math.round(signals.preOptimizationScore * 0.1),
      linkClicks: signals.hasExternalLink ? Math.round(signals.preOptimizationScore * 0.5) : 0,
    };

    const algoScore = calculateAlgoScore(estimatedMetrics);

    return NextResponse.json({
      signals,
      algoScore,
      estimatedMetrics,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
