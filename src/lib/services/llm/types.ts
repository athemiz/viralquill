/**
 * ViralQuill — LLM Service Types
 * Provider interface and configuration types.
 */

import type { RewriteRequest, RewriteResult, JudgeResult, ToneType } from '@/lib/types';

/**
 * LLM Provider configuration.
 */
export interface LLMProviderConfig {
  provider: 'openai' | 'anthropic' | 'mock' | 'groq';
  rewriterModel: string;
  judgeModel: string;
  embedderModel: string;
  temperature: number;
  maxTokens: number;
}

/**
 * LLM Provider interface — all providers must implement this.
 */
export interface LLMProvider {
  readonly name: string;

  /** Rewrite content for viral optimization */
  rewrite(request: RewriteRequest): Promise<RewriteResult>;

  /** Judge content quality using rubric scoring (1-5 per dimension) */
  judge(text: string, tone: ToneType): Promise<JudgeResult>;

  /** Generate text embedding (text-embedding-3-small, 1536 dims) */
  embed(text: string): Promise<number[]>;

  /** Generate reply suggestions for engagement */
  suggestReplies(tweetText: string, count: number): Promise<string[]>;

  /** Check if the provider is available and configured */
  isAvailable(): Promise<boolean>;
}

/**
 * Default configs per provider.
 */
export const DEFAULT_CONFIGS: Record<string, LLMProviderConfig> = {
  mock: {
    provider: 'mock',
    rewriterModel: 'mock-rewriter',
    judgeModel: 'mock-judge',
    embedderModel: 'mock-embedder',
    temperature: 0,
    maxTokens: 1024,
  },
  openai: {
    provider: 'openai',
    rewriterModel: 'gpt-4o',
    judgeModel: 'gpt-4o',
    embedderModel: 'text-embedding-3-small',
    temperature: 0.7,
    maxTokens: 1024,
  },
  anthropic: {
    provider: 'anthropic',
    rewriterModel: 'claude-sonnet-4-20250514',
    judgeModel: 'claude-sonnet-4-20250514',
    embedderModel: 'text-embedding-3-small', // uses OpenAI for embeddings
    temperature: 0.7,
    maxTokens: 1024,
  },
};
