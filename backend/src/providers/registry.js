import { PROVIDER_OPTIONS } from '@bacontrainer/shared';
import { openaiCompatibleAdapter } from './openaiCompatibleAdapter.js';
import { ollamaAdapter } from './ollamaAdapter.js';
import { geminiAdapter } from './geminiAdapter.js';

const adapters = new Map([
  [openaiCompatibleAdapter.id, openaiCompatibleAdapter],
  [ollamaAdapter.id, ollamaAdapter],
  [geminiAdapter.id, geminiAdapter]
]);

export function getProviderAdapter(providerId) {
  return adapters.get(providerId) ?? null;
}

export function getProviderOptions(config) {
  return PROVIDER_OPTIONS.map((provider) => {
    const adapter = getProviderAdapter(provider.id);
    const status = adapter.getStatus(config);

    return {
      ...provider,
      configured: status.configured,
      defaultModel: adapter.getDefaultModel(config),
      defaultBaseUrl: adapter.getDefaultBaseUrl(config),
      requiresApiKey: adapter.requiresApiKey,
      supportsCustomBaseUrl: adapter.supportsCustomBaseUrl
    };
  });
}

export function getProviderStatus(config) {
  return Object.fromEntries(
    PROVIDER_OPTIONS.map((provider) => {
      const adapter = getProviderAdapter(provider.id);
      const status = adapter.getStatus(config);

      return [
        provider.id,
        {
          configured: status.configured,
          defaultModel: adapter.getDefaultModel(config),
          defaultBaseUrl: adapter.getDefaultBaseUrl(config),
          requiresApiKey: adapter.requiresApiKey,
          supportsCustomBaseUrl: adapter.supportsCustomBaseUrl,
          summary: status.summary
        }
      ];
    })
  );
}

export function listProviderAdapters() {
  return Array.from(adapters.values());
}
