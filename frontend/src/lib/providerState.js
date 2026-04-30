const OPENAI_COMPATIBLE_PROVIDER_ID = 'openai-compatible';
const LEGACY_PROVIDER_DEFAULTS = {
  [OPENAI_COMPATIBLE_PROVIDER_ID]: {
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini'
  },
  gemini: {
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-flash',
    defaultModels: [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash-002',
      'gemini-2.0-flash',
      'gemini-2.0-flash-001',
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash-lite-001'
    ]
  }
};

function getPersistedProviderDefault(provider, persistedProviderDefaults = {}, field) {
  return (
    persistedProviderDefaults?.[provider.id]?.[field] ||
    LEGACY_PROVIDER_DEFAULTS[provider.id]?.[field] ||
    ''
  );
}

function shouldReplaceStaleBaseUrl(provider, persistedConfig, persistedProviderDefaults) {
  const previousDefaultBaseUrl = getPersistedProviderDefault(
    provider,
    persistedProviderDefaults,
    'defaultBaseUrl'
  );

  return (
    !persistedConfig?.apiKey &&
    previousDefaultBaseUrl &&
    persistedConfig?.baseUrl === previousDefaultBaseUrl &&
    provider.defaultBaseUrl &&
    provider.defaultBaseUrl !== previousDefaultBaseUrl
  );
}

function shouldReplaceStaleModel(provider, persistedModel, persistedProviderDefaults) {
  const previousDefaultModel = getPersistedProviderDefault(
    provider,
    persistedProviderDefaults,
    'defaultModel'
  );
  const knownDefaultModels = new Set(
    [
      previousDefaultModel,
      LEGACY_PROVIDER_DEFAULTS[provider.id]?.defaultModel,
      ...(LEGACY_PROVIDER_DEFAULTS[provider.id]?.defaultModels || [])
    ].filter(Boolean)
  );

  return (
    knownDefaultModels.has(persistedModel) &&
    provider.defaultModel &&
    provider.defaultModel !== persistedModel
  );
}

export function buildProviderDefaults(providers) {
  return Object.fromEntries(
    providers.map((provider) => [
      provider.id,
      {
        defaultBaseUrl: provider.defaultBaseUrl || '',
        defaultModel: provider.defaultModel || ''
      }
    ])
  );
}

export function resolveInitialProviderId(
  providers,
  persistedProviderId,
  currentDefaultProviderId,
  selectedProviderUserSet = false
) {
  const providerIds = new Set(providers.map((provider) => provider.id));
  const hasPersistedProvider = providerIds.has(persistedProviderId);
  const hasCurrentDefaultProvider = providerIds.has(currentDefaultProviderId);

  if (!hasCurrentDefaultProvider) {
    return hasPersistedProvider ? persistedProviderId : providers[0]?.id || '';
  }

  if (!hasPersistedProvider) {
    return currentDefaultProviderId;
  }

  return selectedProviderUserSet ? persistedProviderId : currentDefaultProviderId;
}

export function buildInitialProviderConfigs(
  providers,
  persistedConfigs = {},
  persistedProviderDefaults = {}
) {
  return Object.fromEntries(
    providers.map((provider) => {
      const persistedConfig = persistedConfigs[provider.id] || {};

      return [
        provider.id,
        {
          baseUrl: shouldReplaceStaleBaseUrl(
            provider,
            persistedConfig,
            persistedProviderDefaults
          )
            ? provider.defaultBaseUrl
            : persistedConfig.baseUrl || provider.defaultBaseUrl || '',
          apiKey: persistedConfig.apiKey || ''
        }
      ];
    })
  );
}

export function buildInitialProviderModels(
  providers,
  persistedModels = {},
  persistedProviderDefaults = {}
) {
  return Object.fromEntries(
    providers.map((provider) => {
      const persistedModel = persistedModels[provider.id];

      return [
        provider.id,
        shouldReplaceStaleModel(provider, persistedModel, persistedProviderDefaults)
          ? provider.defaultModel
          : persistedModel || provider.defaultModel || ''
      ];
    })
  );
}
