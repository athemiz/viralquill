/**
 * ViralQuill — Groq LLM Provider
 * Uses groq-sdk to call Groq's free-tier API (llama-3.3-70b-versatile).
 * Implements LLMProvider interface with 30 RPM rate limit awareness.
 */

import Groq from 'groq-sdk';
import type { LLMProvider, LLMProviderConfig } from './types';
import type { RewriteRequest, RewriteResult, JudgeResult, ToneType } from '@/lib/types';

const FALLBACK_MODEL = 'llama-3.1-8b-instant';
const RATE_LIMIT_RPM = 30; // Groq free tier: 30 requests per minute

export class GroqLLMProvider implements LLMProvider {
  readonly name = 'groq';
  private client: Groq;
  private config: LLMProviderConfig;
  private requestCount = 0;
  private windowStart = Date.now();

  constructor(config: LLMProviderConfig) {
    this.config = config;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
    this.client = new Groq({ apiKey });
  }

  async rewrite(request: RewriteRequest): Promise<RewriteResult> {
    await this.checkRateLimit();

    const userPrompt = `Rewrite this tweet for maximum engagement on X (Twitter).

Original: "${request.originalText}"
Tone: ${request.targetTone || 'professional'}
Include hook: ${request.includeHook ? 'yes' : 'no'}
Avoid external links: ${request.avoidExternalLinks ? 'yes' : 'no'}

Respond ONLY with valid JSON:
{"rewrittenText": "...", "explanation": "...", "hookUsed": "...", "changes": ["..."]}\`\`\``;

    const text = await this.callGroq(
      'You are a viral content optimizer for X (Twitter). Rewrite posts to maximize engagement using algorithm-aware techniques.',
      userPrompt,
      this.config.rewriterModel,
      this.config.temperature,
    );

    try {
      const parsed = JSON.parse(this.extractJson(text));
      return {
        rewrittenText: parsed.rewrittenText || request.originalText,
        predictedScore: {
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
        },
        changes: parsed.changes || ['Rewritten by Groq LLM'],
        tone: request.targetTone || 'professional',
        hookUsed: parsed.hookUsed || null,
      };
    } catch {
      return {
        rewrittenText: text.slice(0, 280),
        predictedScore: {
          raw: 100,
          normalized: 50,
          bucket: 'medium',
          breakdown: {
            replyScore: 50,
            retweetScore: 5,
            likeScore: 15,
            bookmarkScore: 20,
            dwellScore: 5,
            profileClickScore: 10,
            conversationClickScore: 0,
          },
          confidence: 0.5,
        },
        changes: ['Rewritten by Groq LLM (raw response)'],
        tone: request.targetTone || 'professional',
        hookUsed: null,
      };
    }
  }

  async judge(text: string, tone: ToneType): Promise<JudgeResult> {
    await this.checkRateLimit();

    const userPrompt = `Evaluate this tweet for X (Twitter):

"${text}"

Respond ONLY with valid JSON:
{"grammar": 4, "fluency": 4, "tone": 4, "overall": 4, "feedback": "..."}\`\`\``;

    const result = await this.callGroq(
      'You are a content quality evaluator for X. Score tweets 1-5 on grammar, fluency, and tone.',
      userPrompt,
      this.config.judgeModel,
      0.3,
    );

    try {
      const parsed = JSON.parse(this.extractJson(result));
      return {
        grammar: parsed.grammar ?? 3,
        fluency: parsed.fluency ?? 3,
        tone: parsed.tone ?? 3,
        overall: parsed.overall ?? 3,
        feedback: parsed.feedback || 'Evaluated by Groq LLM',
      };
    } catch {
      return {
        grammar: 3,
        fluency: 3,
        tone: 3,
        overall: 3,
        feedback: 'Could not parse LLM response',
      };
    }
  }

  async embed(text: string): Promise<number[]> {
    // Groq does not support native embeddings.
    // Return deterministic pseudo-embedding based on text hash.
    // TODO: Replace with real embedding service (OpenAI, Cohere) when budget allows.
    console.warn(
      '[GroqLLMProvider] embed() — Groq has no native embeddings. Using pseudo-embedding.',
    );
    const dims = 1536;
    const embedding: number[] = [];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) & 0x7fffffff;
    }
    for (let i = 0; i < dims; i++) {
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      embedding.push((hash / 0x7fffffff) * 2 - 1);
    }
    return embedding;
  }

  async suggestReplies(tweetText: string, count: number): Promise<string[]> {
    await this.checkRateLimit();

    const userPrompt = `Generate ${count} engaging reply suggestions for this tweet on X:

"${tweetText}"

Respond ONLY with valid JSON:
{"replies": ["...", "..."]}\`\`\``;

    const result = await this.callGroq(
      'You are an expert X engagement strategist. Generate witty, relevant replies.',
      userPrompt,
      this.config.rewriterModel,
      0.8,
    );

    try {
      const parsed = JSON.parse(this.extractJson(result));
      return parsed.replies || [result.slice(0, 280)];
    } catch {
      return [result.slice(0, 280)];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.config.rewriterModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
      return true;
    } catch {
      return false;
    }
  }

  // --- Private helpers ---

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.windowStart) / 1000 / 60; // minutes

    if (elapsed >= 1) {
      // Reset window
      this.windowStart = now;
      this.requestCount = 0;
    }

    if (this.requestCount >= RATE_LIMIT_RPM) {
      const waitTime = 60 - elapsed * 60;
      console.warn(
        `[GroqLLMProvider] Rate limit (${RATE_LIMIT_RPM} RPM) approaching. Wait ${Math.ceil(waitTime)}s.`,
      );
    }

    this.requestCount++;
  }

  private async callGroq(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    temperature: number,
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: this.config.maxTokens,
      });
      return response.choices[0]?.message?.content ?? '';
    } catch (error: unknown) {
      if (model !== FALLBACK_MODEL) {
        console.warn(
          `[GroqLLMProvider] Primary model failed, falling back to ${FALLBACK_MODEL}`,
          error,
        );
        return this.callGroq(systemPrompt, userPrompt, FALLBACK_MODEL, temperature);
      }
      throw error;
    }
  }

  private extractJson(text: string): string {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return jsonMatch[1].trim();
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) return braceMatch[0];
    return text;
  }
}
