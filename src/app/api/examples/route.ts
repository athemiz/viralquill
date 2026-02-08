/**
 * GET /api/examples
 * Return mock tweet examples with scores.
 * 100% local — no external API calls.
 */

import { NextResponse } from 'next/server';
import { getMockTweetsSorted } from '@/lib/mock-data/tweets';
import { calculateAlgoScore } from '@/lib/scoring';

export async function GET() {
  const tweets = getMockTweetsSorted();

  const examples = tweets.map((tweet) => ({
    ...tweet,
    algoScore: calculateAlgoScore(tweet.metrics),
  }));

  return NextResponse.json({ examples });
}
