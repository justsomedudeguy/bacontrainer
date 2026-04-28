/**
 * @typedef {'openai-compatible' | 'ollama' | 'gemini'} ProviderId
 */

/**
 * @typedef {Object} ProviderOption
 * @property {ProviderId} id
 * @property {string} label
 * @property {string} description
 * @property {boolean} builtIn
 * @property {string} [defaultModel]
 * @property {string} [defaultBaseUrl]
 * @property {boolean} [configured]
 * @property {boolean} [requiresApiKey]
 * @property {boolean} [supportsCustomBaseUrl]
 */

export const PROVIDER_IDS = {
  OPENAI_COMPATIBLE: 'openai-compatible',
  OLLAMA: 'ollama',
  GEMINI: 'gemini'
};

export const PROVIDER_OPTIONS = [
  {
    id: PROVIDER_IDS.OPENAI_COMPATIBLE,
    label: 'OpenAI-Compatible',
    description: 'Any OpenAI-style chat completion endpoint with a configurable base URL.',
    builtIn: false
  },
  {
    id: PROVIDER_IDS.OLLAMA,
    label: 'Ollama-Compatible',
    description: 'A local or self-hosted Ollama-compatible chat endpoint.',
    builtIn: false
  },
  {
    id: PROVIDER_IDS.GEMINI,
    label: 'Gemini',
    description: 'Gemini backend integration that uses an API key instead of Google OAuth.',
    builtIn: true
  }
];

export function isProviderId(value) {
  return Object.values(PROVIDER_IDS).includes(value);
}

export function getProviderOption(providerId) {
  return PROVIDER_OPTIONS.find((provider) => provider.id === providerId) ?? null;
}
