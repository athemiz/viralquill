/**
 * ViralQuill — App Configuration
 * Centralized config with environment variable support.
 */

import type { XApiConfig, LLMServiceConfig } from '@/lib/types';

export const APP_CONFIG = {
  name: 'ViralQuill',
  version: '0.1.0',
  description: 'Viral content optimizer for X (Twitter)',
} as const;

export const X_API_CONFIG: XApiConfig = {
  tier: (process.env.VIRALQUILL_X_API_TIER as 'free' | 'basic' | 'pro') ?? 'basic',
  monthlyReadCap: Number(process.env.VIRALQUILL_X_READ_CAP) || 15_000,
  monthlyWriteCap: Number(process.env.VIRALQUILL_X_WRITE_CAP) || 50_000,
  oauthVersion: '2.0',
};

export const LLM_CONFIG: LLMServiceConfig = {
  provider: (process.env.VIRALQUILL_LLM_PROVIDER as 'openai' | 'anthropic' | 'mock') ?? 'mock',
  model: process.env.VIRALQUILL_LLM_MODEL ?? 'gpt-4o',
  temperature: Number(process.env.VIRALQUILL_LLM_TEMP) || 0.7,
  maxTokens: Number(process.env.VIRALQUILL_LLM_MAX_TOKENS) || 1024,
};

/** Embedding configuration — FINAL: text-embedding-3-small @ 1536 dims */
export const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  similarityThreshold: 0.7, // for originality/dedup corpus
} as const;
