import { describe, it, expect } from 'vitest';
import { availableModels } from '@/components/ai_agents/ModelSelector';

// Shape checks, not freshness: nothing local can tell that a provider retired a model.

const PROVIDER_PREFIX: Record<string, string> = {
  openai: 'openai/',
  gemini: 'gemini/',
  anthropic: 'anthropic/',
  openrouter: 'openrouter/',
  deepseek: 'deepseek/',
  together_ai: 'together_ai/',
  fireworks_ai: 'fireworks_ai/',
  perplexity: 'perplexity/',
  bedrock: 'bedrock/',
  vertex_ai: 'vertex_ai/',
};

const duplicatesOf = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter(v => {
    if (seen.has(v)) return true;
    seen.add(v);
    return false;
  });
};

describe('availableModels', () => {
  it('files every entry under a provider the picker knows', () => {
    const unknown = availableModels.filter(m => !PROVIDER_PREFIX[m.provider]);
    expect(unknown).toEqual([]);
  });

  it('prefixes every value with its own provider', () => {
    const mismatched = availableModels.filter(
      m => !m.value.startsWith(PROVIDER_PREFIX[m.provider]),
    );
    expect(mismatched).toEqual([]);
  });

  it('has no duplicate value', () => {
    expect(duplicatesOf(availableModels.map(m => m.value))).toEqual([]);
  });

  it('has no duplicate label, so two entries never look like one', () => {
    expect(duplicatesOf(availableModels.map(m => m.label))).toEqual([]);
  });

  it('keeps at most the current family pinned for a provider that lists live', () => {
    // Mirrors ProviderSupportsDynamicModels in the core-service
    // (pkg/api_key/service/models_fetcher.go); update both together.
    const listsLive = ['openai', 'gemini', 'anthropic', 'openrouter', 'deepseek', 'together_ai', 'fireworks_ai'];
    const oversized = listsLive.filter(
      p => availableModels.filter(m => m.provider === p).length > 3,
    );
    expect(oversized).toEqual([]);
  });
});
