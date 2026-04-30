import { describe, expect, it } from 'vitest';
import {
  buildProviderDefaults,
  buildInitialProviderConfigs,
  buildInitialProviderModels,
  resolveInitialProviderId
} from './providerState.js';

const providers = [
  {
    id: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/free'
  },
  {
    id: 'gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-flash-lite'
  },
  {
    id: 'ollama',
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2'
  }
];

describe('provider state', () => {
  it('migrates stale OpenAI-compatible defaults to the server defaults when no browser key exists', () => {
    expect(
      buildInitialProviderConfigs(providers, {
        'openai-compatible': {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: ''
        }
      })['openai-compatible'].baseUrl
    ).toBe('https://openrouter.ai/api/v1');

    expect(
      buildInitialProviderModels(providers, {
        'openai-compatible': 'gpt-4.1-mini'
      })['openai-compatible']
    ).toBe('openrouter/free');
  });

  it('migrates a persisted model that matched the previous server default', () => {
    expect(
      buildInitialProviderModels(
        providers,
        {
          gemini: 'gemini-1.5-flash'
        },
        {
          gemini: {
            defaultBaseUrl: 'https://generativelanguage.googleapis.com',
            defaultModel: 'gemini-1.5-flash'
          }
        }
      ).gemini
    ).toBe('gemini-2.5-flash-lite');
  });

  it('migrates the retired Gemini 1.5 Flash default even without a saved default snapshot', () => {
    expect(
      buildInitialProviderModels(providers, {
        gemini: 'gemini-1.5-flash'
      }).gemini
    ).toBe('gemini-2.5-flash-lite');
  });

  it('uses the current server default provider when persisted state predates explicit provider tracking', () => {
    expect(
      resolveInitialProviderId(providers, 'openai-compatible', 'gemini', false)
    ).toBe('gemini');
  });

  it('preserves an explicit provider choice', () => {
    expect(
      resolveInitialProviderId(providers, 'ollama', 'gemini', true)
    ).toBe('ollama');
  });

  it('snapshots provider defaults for future migrations', () => {
    expect(buildProviderDefaults(providers).gemini).toEqual({
      defaultBaseUrl: 'https://generativelanguage.googleapis.com',
      defaultModel: 'gemini-2.5-flash-lite'
    });
  });
});
