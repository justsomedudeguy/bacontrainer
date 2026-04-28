import { describe, expect, it } from 'vitest';
import {
  buildInitialProviderConfigs,
  buildInitialProviderModels
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
    defaultModel: 'gemini-2.5-flash'
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
});
