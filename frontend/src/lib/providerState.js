const OPENAI_COMPATIBLE_PROVIDER_ID = 'openai-compatible';
const LEGACY_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1';
const LEGACY_OPENAI_COMPATIBLE_MODEL = 'gpt-4.1-mini';

function shouldReplaceStaleOpenAiBaseUrl(provider, persistedConfig) {
  return (
    provider.id === OPENAI_COMPATIBLE_PROVIDER_ID &&
    !persistedConfig?.apiKey &&
    persistedConfig?.baseUrl === LEGACY_OPENAI_COMPATIBLE_BASE_URL &&
    provider.defaultBaseUrl &&
    provider.defaultBaseUrl !== persistedConfig.baseUrl
  );
}

function shouldReplaceStaleOpenAiModel(provider, persistedModel) {
  return (
    provider.id === OPENAI_COMPATIBLE_PROVIDER_ID &&
    persistedModel === LEGACY_OPENAI_COMPATIBLE_MODEL &&
    provider.defaultModel &&
    provider.defaultModel !== persistedModel
  );
}

export function buildInitialProviderConfigs(providers, persistedConfigs = {}) {
  return Object.fromEntries(
    providers.map((provider) => {
      const persistedConfig = persistedConfigs[provider.id] || {};

      return [
        provider.id,
        {
          baseUrl: shouldReplaceStaleOpenAiBaseUrl(provider, persistedConfig)
            ? provider.defaultBaseUrl
            : persistedConfig.baseUrl || provider.defaultBaseUrl || '',
          apiKey: persistedConfig.apiKey || ''
        }
      ];
    })
  );
}

export function buildInitialProviderModels(providers, persistedModels = {}) {
  return Object.fromEntries(
    providers.map((provider) => {
      const persistedModel = persistedModels[provider.id];

      return [
        provider.id,
        shouldReplaceStaleOpenAiModel(provider, persistedModel)
          ? provider.defaultModel
          : persistedModel || provider.defaultModel || ''
      ];
    })
  );
}
