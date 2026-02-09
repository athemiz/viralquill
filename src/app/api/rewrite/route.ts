/**
 * POST /api/rewrite
 * Rewrite draft text using mock LLM provider.
 * 100% local — no external API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLLMProvider } from '@/lib/services/llm';
import type { RewriteRequest } from '@/lib/types';

// Environment-driven provider selection: read VIRALQUILL_LLM_PROVIDER from env, defaults to 'mock'
const providerName =
  (process.env.VIRALQUILL_LLM_PROVIDER as 'groq' | 'openai' | 'anthropic' | 'mock') || 'mock';
const llm = createLLMProvider(providerName);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, tone = 'professional', includeHook = true } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const rewriteRequest: RewriteRequest = {
      originalText: text,
      targetTone: tone,
      preserveIntent: true,
      includeHook,
      avoidExternalLinks: true,
    };

    const result = await llm.rewrite(rewriteRequest);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
