import {
  PROVIDER_IDS,
  TRANSCRIPT_CHANNELS,
  TRANSCRIPT_ROLES,
  createTranscriptMessage,
  isProviderId
} from '@bacontrainer/shared';
import { getLegalResearchSystemPrompt } from '../prompts/legalResearchSystemPrompt.js';
import { getProviderAdapter } from '../providers/registry.js';
import { HttpError } from '../utils/httpError.js';
import { LegalRetrievalWorkflow } from './LegalRetrievalWorkflow.js';

const LEGAL_RESEARCH_CONTEXT = {
  id: 'legal-research',
  title: 'Legal Research Chat'
};

function ensureNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
}

function cleanProviderConfig(providerConfig) {
  if (!providerConfig || typeof providerConfig !== 'object') {
    return {};
  }

  return {
    ...(typeof providerConfig.baseUrl === 'string'
      ? { baseUrl: providerConfig.baseUrl.trim() }
      : {}),
    ...(typeof providerConfig.apiKey === 'string'
      ? { apiKey: providerConfig.apiKey.trim() }
      : {})
  };
}

function sanitizeTranscript(transcript) {
  if (!Array.isArray(transcript)) {
    return [];
  }

  return transcript
    .filter((message) => message && typeof message.content === 'string')
    .map((message) => ({
      id: message.id ?? 'external-message',
      role: message.role ?? TRANSCRIPT_ROLES.USER,
      channel: message.channel ?? TRANSCRIPT_CHANNELS.CHAT,
      content: message.content,
      ...(message.meta ? { meta: message.meta } : {})
    }));
}

function buildRetrievalMeta(retrieval) {
  return {
    status: retrieval.status,
    queriedTypes: retrieval.queriedTypes,
    query: retrieval.query,
    ...(retrieval.issue ? { issue: retrieval.issue } : {}),
    ...(retrieval.currentFocus ? { currentFocus: retrieval.currentFocus } : {}),
    ...(retrieval.jurisdictionMode ? { jurisdictionMode: retrieval.jurisdictionMode } : {}),
    ...(typeof retrieval.stateVariation === 'boolean'
      ? { stateVariation: retrieval.stateVariation }
      : {}),
    ...(retrieval.jurisdictionNotes ? { jurisdictionNotes: retrieval.jurisdictionNotes } : {}),
    ...(retrieval.strategy ? { strategy: retrieval.strategy } : {}),
    ...(retrieval.analysisBlueprint ? { analysisBlueprint: retrieval.analysisBlueprint } : {}),
    ...(typeof retrieval.candidateSourceCount === 'number'
      ? { candidateSourceCount: retrieval.candidateSourceCount }
      : {})
  };
}

function buildResetTranscript({ appMode, providerId, model }) {
  return [
    createTranscriptMessage({
      role: TRANSCRIPT_ROLES.SYSTEM,
      channel: TRANSCRIPT_CHANNELS.SYSTEM,
      content: `Legal research chat reset. Provider: ${providerId}. Model: ${model}.`,
      meta: {
        appMode
      }
    }),
    createTranscriptMessage({
      role: TRANSCRIPT_ROLES.ASSISTANT,
      channel: TRANSCRIPT_CHANNELS.CHAT,
      content:
        'Ask any legal question. I will answer in an educational way and, when available, ground the response in CourtListener sources.',
      meta: {
        providerId,
        model,
        purpose: 'legal-research',
        retrieval: {
          status: 'idle',
          queriedTypes: [],
          query: ''
        },
        sources: []
      }
    })
  ];
}

export class LegalResearchService {
  constructor({ config, courtListenerService, usageLogger = null }) {
    this.config = config;
    this.courtListenerService = courtListenerService;
    this.usageLogger = usageLogger;
    this.legalRetrievalWorkflow = new LegalRetrievalWorkflow({
      config,
      courtListenerService,
      usageLogger
    });
  }

  getCourtListenerStatus() {
    return this.courtListenerService.getStatus();
  }

  resetChat({ providerId, model } = {}) {
    const adapter = this.#resolveProvider(providerId);
    const resolvedModel = model?.trim() || adapter.getDefaultModel(this.config);

    return {
      appMode: this.config.appMode,
      providerId: adapter.id,
      model: resolvedModel,
      transcript: buildResetTranscript({
        appMode: this.config.appMode,
        providerId: adapter.id,
        model: resolvedModel
      })
    };
  }

  async submitTurn({
    providerId,
    model,
    transcript,
    userInput,
    providerConfig,
    courtlistenerConfig
  }) {
    ensureNonEmptyString(userInput, 'userInput');

    const adapter = this.#resolveProvider(providerId);
    const resolvedModel = model?.trim() || adapter.getDefaultModel(this.config);
    const cleanedProviderConfig = cleanProviderConfig(providerConfig);
    const transcriptSoFar = sanitizeTranscript(transcript).filter(
      (message) => message.channel !== TRANSCRIPT_CHANNELS.SYSTEM
    );

    const userMessage = createTranscriptMessage({
      role: TRANSCRIPT_ROLES.USER,
      channel: TRANSCRIPT_CHANNELS.CHAT,
      content: userInput
    });

    this.#log({
      type: 'user_query',
      payload: {
        workspace: 'research',
        providerId: adapter.id,
        model: resolvedModel,
        text: userInput
      }
    });

    const nextTranscript = [...transcriptSoFar, userMessage];
    const retrieval = await this.legalRetrievalWorkflow.retrieve({
      adapter,
      model: resolvedModel,
      providerConfig: cleanedProviderConfig,
      context: LEGAL_RESEARCH_CONTEXT,
      transcript: nextTranscript,
      userInput,
      courtlistenerConfig,
      sourceTypes: ['o'],
      workspace: 'legal-research',
      generateText: ({ adapter: requestAdapter, request: workflowRequest }) =>
        this.#generateTextWithUsageLogging({
          adapter: requestAdapter,
          request: workflowRequest
        }),
      assertProviderReady: (requestAdapter, workflowRequest) =>
        this.#assertProviderReady(requestAdapter, workflowRequest)
    });
    const normalizedRequest = adapter.normalizeRequest(
      {
        purpose: 'legal-research',
        scenario: LEGAL_RESEARCH_CONTEXT,
        model: resolvedModel,
        systemPrompt: getLegalResearchSystemPrompt({
          retrieval,
          sources: retrieval.sources
        }),
        transcript: nextTranscript,
        providerConfig: cleanedProviderConfig
      },
      this.config
    );

    this.#assertProviderReady(adapter, normalizedRequest);

    const response = await this.#generateTextWithUsageLogging({
      adapter,
      request: normalizedRequest
    });
    const assistantMessage = createTranscriptMessage({
      role: TRANSCRIPT_ROLES.ASSISTANT,
      channel: TRANSCRIPT_CHANNELS.CHAT,
      content: response.text.trim(),
      meta: {
        providerId: adapter.id,
        model: resolvedModel,
        purpose: 'legal-research',
        retrieval: buildRetrievalMeta(retrieval),
        sources: retrieval.sources
      }
    });

    this.#log({
      type: 'research_response',
      payload: {
        workspace: 'research',
        providerId: adapter.id,
        model: resolvedModel,
        retrievalStatus: retrieval.status,
        sourceCount: retrieval.sources.length,
        text: assistantMessage.content
      }
    });

    return {
      appMode: this.config.appMode,
      providerId: adapter.id,
      model: resolvedModel,
      transcript: [...nextTranscript, assistantMessage]
    };
  }

  #resolveProvider(providerId) {
    const resolvedProviderId =
      providerId && isProviderId(providerId)
        ? providerId
        : this.config.defaultProviderId || PROVIDER_IDS.OPENAI_COMPATIBLE;
    const adapter = getProviderAdapter(resolvedProviderId);

    if (!adapter) {
      throw new HttpError(400, `Unknown provider: ${resolvedProviderId}`);
    }

    return adapter;
  }

  #assertProviderReady(adapter, normalizedRequest) {
    if (adapter.requiresApiKey && !normalizedRequest.runtimeConfig?.apiKey) {
      throw new HttpError(400, 'Enter an API key to continue.');
    }
  }

  async #generateTextWithUsageLogging({ adapter, request }) {
    const startedAt = Date.now();

    try {
      const result = await adapter.generateText(request, this.config);

      this.#log({
        type: 'inference_call',
        payload: {
          workspace: 'research',
          purpose: request.purpose,
          providerId: adapter.id,
          model: request.model,
          endpoint: request.endpoint,
          durationMs: Date.now() - startedAt,
          success: true
        }
      });

      return result;
    } catch (error) {
      this.#log({
        type: 'inference_call',
        payload: {
          workspace: 'research',
          purpose: request.purpose,
          providerId: adapter.id,
          model: request.model,
          endpoint: request.endpoint,
          durationMs: Date.now() - startedAt,
          success: false,
          error: error.message
        }
      });

      throw error;
    }
  }

  #log(event) {
    this.usageLogger?.log(event);
  }
}
