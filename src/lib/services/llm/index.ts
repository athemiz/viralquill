/**
 * ViralQuill — LLM Service Layer
 * Factory + public API.
 *
 * In dev/test mode, uses MockLLMProvider (no API keys needed).
 * In production, will use OpenAI/Anthropic providers.
 */

import type { LLMProvider, LLMProviderConfig } from './types';
import { MockLLMProvider } from './mock-provider';
import { DEFAULT_CONFIGS } from './types';

export type { LLMProvider, LLMProviderConfig } from './types';
export { MockLLMProvider } from './mock-provider';

/**
 * Create an LLM provider instance.
 *
 * @param provider - Provider name ('openai' | 'anthropic' | 'mock')
 * @param config - Optional config overrides
 * @returns LLMProvider instance
 */
export function createLLMProvider(
  provider: 'openai' | 'anthropic' | 'mock' = 'mock',
  config?: Partial<LLMProviderConfig>,
): LLMProvider {
  const mergedConfig = {
    ...(DEFAULT_CONFIGS[provider] ?? DEFAULT_CONFIGS.mock),
    ...config,
    provider,
  };

  switch (provider) {
    case 'mock':
      return new MockLLMProvider(mergedConfig);
    case 'openai':
      // Phase 2: return new OpenAIProvider(mergedConfig);
      console.warn('[ViralQuill] OpenAI provider not yet implemented. Using mock.');
      return new MockLLMProvider(mergedConfig);
    case 'anthropic':
      // Phase 2: return new AnthropicProvider(mergedConfig);
      console.warn('[ViralQuill] Anthropic provider not yet implemented. Using mock.');
      return new MockLLMProvider(mergedConfig);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Get the default LLM provider for the current environment.
 * Uses VIRALQUILL_LLM_PROVIDER env var, defaults to 'mock'.
 */
export function getDefaultProvider(): LLMProvider {
  const envProvider = process.env.VIRALQUILL_LLM_PROVIDER as
    | 'openai'
    | 'anthropic'
    | 'mock'
    | undefined;
  return createLLMProvider(envProvider ?? 'mock');
}
