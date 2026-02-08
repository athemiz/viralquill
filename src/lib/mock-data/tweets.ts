/**
 * ViralQuill — Mock Tweet Data
 * Fake tweets for local development (no X API needed).
 */

import type { Tweet } from '@/lib/types';

export const MOCK_TWEETS: Tweet[] = [
  {
    id: 'mock-001',
    text: 'I analyzed 10,000 viral tweets. Here are 7 patterns that get 150x more reach than average posts. 🧵',
    authorId: 'user-001',
    createdAt: '2026-02-07T14:30:00Z',
    metrics: {
      likes: 4200,
      retweets: 1800,
      replies: 350,
      impressions: 420000,
      bookmarks: 180,
      profileClicks: 120,
      linkClicks: 0,
    },
    isThread: true,
    threadPosition: 1,
  },
  {
    id: 'mock-002',
    text: 'Everyone says you need to post 5x a day on X.\n\nThey\'re wrong.\n\nI grew from 0 to 50K followers posting once a day.\n\nQuality > Quantity. Always.',
    authorId: 'user-001',
    createdAt: '2026-02-06T09:15:00Z',
    metrics: {
      likes: 2100,
      retweets: 650,
      replies: 180,
      impressions: 185000,
      bookmarks: 95,
      profileClicks: 75,
      linkClicks: 0,
    },
    isThread: false,
  },
  {
    id: 'mock-003',
    text: 'Check out my new blog post about productivity: https://myblog.com/productivity-tips',
    authorId: 'user-002',
    createdAt: '2026-02-05T16:45:00Z',
    metrics: {
      likes: 12,
      retweets: 3,
      replies: 1,
      impressions: 850,
      bookmarks: 0,
      profileClicks: 2,
      linkClicks: 8,
    },
    isThread: false,
  },
  {
    id: 'mock-004',
    text: 'What\'s the one tool you can\'t live without as a developer?\n\nMine is VS Code. Reply with yours 👇',
    authorId: 'user-001',
    createdAt: '2026-02-04T11:00:00Z',
    metrics: {
      likes: 890,
      retweets: 120,
      replies: 420,
      impressions: 95000,
      bookmarks: 25,
      profileClicks: 45,
      linkClicks: 0,
    },
    isThread: false,
  },
  {
    id: 'mock-005',
    text: 'gm',
    authorId: 'user-003',
    createdAt: '2026-02-03T07:00:00Z',
    metrics: {
      likes: 3,
      retweets: 0,
      replies: 0,
      impressions: 120,
      bookmarks: 0,
      profileClicks: 0,
      linkClicks: 0,
    },
    isThread: false,
  },
];

/** Get a mock tweet by ID */
export function getMockTweet(id: string): Tweet | undefined {
  return MOCK_TWEETS.find((t) => t.id === id);
}

/** Get all mock tweets sorted by score potential (descending) */
export function getMockTweetsSorted(): Tweet[] {
  return [...MOCK_TWEETS].sort(
    (a, b) =>
      (b.metrics.replies * 13.5 + b.metrics.retweets + b.metrics.likes * 0.5) -
      (a.metrics.replies * 13.5 + a.metrics.retweets + a.metrics.likes * 0.5),
  );
}
