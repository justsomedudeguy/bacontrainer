import { describe, expect, it } from 'vitest';
import { createConfig } from '../config/env.js';
import { getProviderAdapter, getProviderOptions, getProviderStatus, listProviderAdapters } from './registry.js';

describe('provider registry', () => {
  const config = createConfig({
    DEFAULT_PROVIDER: 'openai-compatible',
    OPENAI_COMPATIBLE_API_KEY: '',
    GEMINI_API_KEY: '',
    GEMINI_VERTEX_PROJECT: 'test-project'
  });

  it('returns all known provider adapters', () => {
    const adapters = listProviderAdapters();

    expect(adapters).toHaveLength(3);
    expect(getProviderAdapter('gemini')?.id).toBe('gemini');
  });

  it('exposes provider options with default models', () => {
    const providers = getProviderOptions(config);

    expect(providers.map((provider) => provider.id)).toEqual([
      'openai-compatible',
      'ollama',
      'gemini'
    ]);
    expect(providers.every((provider) => provider.defaultModel)).toBe(true);
  });

  it('builds safe provider status objects', () => {
    const status = getProviderStatus(config);

    expect(status['openai-compatible'].summary).toContain('Default base URL');
    expect(status['gemini'].configured).toBe(true);
    expect(status['gemini'].requiresApiKey).toBe(false);
    expect(status['gemini'].summary).toContain('Vertex AI project');
  });
});
