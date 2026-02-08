/**
 * ViralQuill — Mock LLM Provider
 * Returns fake but schema-correct data for dev/test.
 * No API calls, no API keys needed.
 */

import type { LLMProvider, LLMProviderConfig } from './types';
import type { RewriteRequest, RewriteResult, JudgeResult, ToneType, AlgoScore } from '@/lib/types';

export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  private config: LLMProviderConfig;

  constructor(config?: Partial<LLMProviderConfig>) {
    this.config = {
      provider: 'mock',
      rewriterModel: 'mock-rewriter',
      judgeModel: 'mock-judge',
      embedderModel: 'mock-embedder',
      temperature: 0,
      maxTokens: 1024,
      ...config,
    };
  }

  async rewrite(request: RewriteRequest): Promise<RewriteResult> {
    const tone = request.targetTone ?? 'professional';
    const hook = request.includeHook ? '🔥 ' : '';

    const mockScore: AlgoScore = {
      raw: 150,
      normalized: 65,
      bucket: 'high',
      breakdown: {
        replyScore: 67.5,
        retweetScore: 10,
        likeScore: 25,
        bookmarkScore: 30,
        dwellScore: 10,
        profileClickScore: 24,
        conversationClickScore: 0,
      },
      confidence: 0.71,
    };

    return {
      rewrittenText: `${hook}[MOCK REWRITE] ${request.originalText}`,
      predictedScore: mockScore,
      changes: [
        'Added engaging hook',
        `Adjusted tone to ${tone}`,
        'Removed external links',
        'Optimized for algorithm engagement signals',
      ],
      tone,
      hookUsed: request.includeHook ? 'Pattern interrupt hook' : undefined,
    };
  }

  async judge(text: string, tone: ToneType): Promise<JudgeResult> {
    // Deterministic mock scores based on text length
    const lengthFactor = Math.min(text.length / 280, 1);
    const baseScore = 3 + lengthFactor;

    return {
      grammar: Math.min(Math.round(baseScore * 10) / 10, 5),
      fluency: Math.min(Math.round((baseScore + 0.3) * 10) / 10, 5),
      tone: Math.min(Math.round((baseScore - 0.2) * 10) / 10, 5),
      overall: Math.min(Math.round(baseScore * 10) / 10, 5),
      feedback: `[MOCK] Content analyzed for ${tone} tone. Length: ${text.length} chars.`,
    };
  }

  async embed(text: string): Promise<number[]> {
    // Generate deterministic 1536-dim mock embedding based on text hash
    const dimensions = 1536; // text-embedding-3-small dimensions
    const embedding: number[] = [];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) & 0x7fffffff;
    }

    for (let i = 0; i < dimensions; i++) {
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      embedding.push((hash / 0x7fffffff) * 2 - 1); // normalize to [-1, 1]
    }

    return embedding;
  }

  async suggestReplies(tweetText: string, count: number): Promise<string[]> {
    const replies: string[] = [];
    const templates = [
      'Great point! This reminds me of...',
      'Interesting perspective. Have you considered...',
      "This is exactly right. I'd add that...",
      "Couldn't agree more. The key insight here is...",
      'Thanks for sharing this. One thing to note...',
    ];

    for (let i = 0; i < Math.min(count, templates.length); i++) {
      replies.push(`[MOCK] ${templates[i]}`);
    }

    return replies;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
