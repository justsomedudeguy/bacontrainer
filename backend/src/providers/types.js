/**
 * @typedef {'scenario' | 'analysis' | 'scenario-invention' | 'legal-research'} GenerationPurpose
 */

/**
 * @typedef {Object} ProviderMessage
 * @property {'system' | 'user' | 'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} NormalizedGenerationRequest
 * @property {string} providerId
 * @property {string} purpose
 * @property {string} model
 * @property {string} endpoint
 * @property {string} systemPrompt
 * @property {Array<ProviderMessage>} messages
 * @property {Object.<string, unknown>} context
 * @property {{ baseUrl?: string, apiKey?: string }} [runtimeConfig]
 */

/**
 * @typedef {Object} ProviderAdapter
 * @property {string} id
 * @property {string} label
 * @property {boolean} requiresApiKey
 * @property {boolean} supportsCustomBaseUrl
 * @property {(config: Object) => string} getDefaultModel
 * @property {(config: Object) => string} getDefaultBaseUrl
 * @property {(config: Object) => { configured: boolean, summary: string }} getStatus
 * @property {(request: Object, config: Object) => NormalizedGenerationRequest} normalizeRequest
 * @property {(request: NormalizedGenerationRequest, config: Object) => Promise<{ text: string, raw?: unknown }>} generateText
 */

export const PROVIDER_INTERFACE_NOTE =
  'Adapters normalize requests and execute provider-specific network calls.';
