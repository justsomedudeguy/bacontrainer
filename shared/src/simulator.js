/**
 * @typedef {'assistant' | 'user' | 'system'} TranscriptRole
 */

/**
 * @typedef {'scenario' | 'analysis' | 'chat' | 'system'} TranscriptChannel
 */

/**
 * @typedef {Object} TranscriptMessage
 * @property {string} id
 * @property {TranscriptRole} role
 * @property {TranscriptChannel} channel
 * @property {string} content
 * @property {Object.<string, unknown>} [meta]
 */

/**
 * @typedef {Object} BootstrapResponse
 * @property {string} appMode
 * @property {string} defaultScenarioId
 * @property {string} defaultProviderId
 * @property {Array<import('./scenarios.js').ScenarioSummary>} scenarios
 * @property {Array<import('./providers.js').ProviderOption>} providers
 * @property {Object.<string, { configured: boolean, defaultModel: string, summary: string }>} providerStatus
 * @property {{ configured: boolean, defaultBaseUrl: string, supportsBrowserToken: boolean, summary: string }} courtlistenerStatus
 */

/**
 * @typedef {Object} SimulatorResetRequest
 * @property {string} scenarioId
 * @property {import('./scenarios.js').ScenarioDefinition} [scenario]
 * @property {string} providerId
 * @property {string} model
 * @property {{ baseUrl?: string, apiKey?: string }} [providerConfig]
 */

/**
 * @typedef {Object} SimulatorTurnRequest
 * @property {string} scenarioId
 * @property {import('./scenarios.js').ScenarioDefinition} [scenario]
 * @property {string} providerId
 * @property {string} model
 * @property {Array<TranscriptMessage>} transcript
 * @property {string} userInput
 * @property {{ baseUrl?: string, apiKey?: string }} [providerConfig]
 */

/**
 * @typedef {Object} SimulatorAnalysisRequest
 * @property {string} scenarioId
 * @property {import('./scenarios.js').ScenarioDefinition} [scenario]
 * @property {string} providerId
 * @property {string} model
 * @property {Array<TranscriptMessage>} transcript
 * @property {{ baseUrl?: string, apiKey?: string }} [providerConfig]
 * @property {CourtListenerConfig} [courtlistenerConfig]
 */

/**
 * @typedef {Object} SimulatorResponse
 * @property {string} appMode
 * @property {string} scenarioId
 * @property {string} providerId
 * @property {string} model
 * @property {Array<TranscriptMessage>} transcript
 */

/**
 * @typedef {Object} CourtListenerConfig
 * @property {string} [apiToken]
 */

/**
 * @typedef {Object} NormalizedCourtListenerSource
 * @property {string} id
 * @property {'o' | 'r' | 'rd' | 'd' | 'p' | 'oa'} type
 * @property {string} title
 * @property {string} url
 * @property {string} [downloadUrl]
 * @property {string} [court]
 * @property {string} [date]
 * @property {string} [docketNumber]
 * @property {Array<string>} citations
 * @property {string} [snippet]
 */

/**
 * @typedef {Object} ChatResetRequest
 * @property {string} [providerId]
 * @property {string} [model]
 */

/**
 * @typedef {Object} ChatTurnRequest
 * @property {string} providerId
 * @property {string} model
 * @property {Array<TranscriptMessage>} transcript
 * @property {string} userInput
 * @property {{ baseUrl?: string, apiKey?: string }} [providerConfig]
 * @property {CourtListenerConfig} [courtlistenerConfig]
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} appMode
 * @property {string} providerId
 * @property {string} model
 * @property {Array<TranscriptMessage>} transcript
 */

export const TRANSCRIPT_CHANNELS = {
  SCENARIO: 'scenario',
  ANALYSIS: 'analysis',
  CHAT: 'chat',
  SYSTEM: 'system'
};

export const TRANSCRIPT_ROLES = {
  ASSISTANT: 'assistant',
  USER: 'user',
  SYSTEM: 'system'
};

let messageCounter = 0;

export function createMessageId(prefix = 'msg') {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

export function createTranscriptMessage({ role, channel, content, meta = undefined }) {
  return {
    id: createMessageId(channel),
    role,
    channel,
    content,
    ...(meta ? { meta } : {})
  };
}
