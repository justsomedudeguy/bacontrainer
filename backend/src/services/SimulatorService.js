import {
  PROVIDER_IDS,
  TRANSCRIPT_CHANNELS,
  TRANSCRIPT_ROLES,
  createTranscriptMessage,
  isProviderId
} from '@bacontrainer/shared';
import { getAnalysisSystemPrompt } from '../prompts/analysisSystemPrompt.js';
import { getScenarioCreationSystemPrompt } from '../prompts/scenarioCreationSystemPrompt.js';
import { getScenarioSystemPrompt } from '../prompts/scenarioSystemPrompt.js';
import {
  getDefaultScenario,
  getScenarioById,
  getScenarioSummaries,
  normalizeScenarioDefinition,
  toScenarioSummary
} from '../scenarios/catalog.js';
import { getProviderAdapter, getProviderOptions, getProviderStatus } from '../providers/registry.js';
import { HttpError } from '../utils/httpError.js';
import { LegalRetrievalWorkflow } from './LegalRetrievalWorkflow.js';

const SCENARIO_GENERATOR_CONTEXT = {
  id: 'scenario-generator',
  title: 'Scenario Generator'
};
const EMPTY_RETRIEVAL = {
  status: 'unavailable',
  query: '',
  queriedTypes: [],
  sources: []
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
      channel: message.channel ?? TRANSCRIPT_CHANNELS.SCENARIO,
      content: message.content,
      ...(message.meta ? { meta: message.meta } : {})
    }));
}

function cleanGeneratedText(value) {
  return String(value ?? '')
    .trim()
    .split('\n')
    .map((line) =>
      line.replace(/^\s*\[(?:scenario|analysis|chat|system)\]\s*/i, '')
    )
    .join('\n')
    .trim();
}

function buildResetTranscript({ scenario, providerId, model, appMode }) {
  return [
    createTranscriptMessage({
      role: TRANSCRIPT_ROLES.SYSTEM,
      channel: TRANSCRIPT_CHANNELS.SYSTEM,
      content: `Scenario reset: ${scenario.title}. Provider: ${providerId}. Model: ${model}.`,
      meta: {
        appMode
      }
    }),
    createTranscriptMessage({
      role: TRANSCRIPT_ROLES.ASSISTANT,
      channel: TRANSCRIPT_CHANNELS.SCENARIO,
      content: scenario.openingMessage,
      meta: {
        actor: scenario.institutionalActor,
        providerId,
        model
      }
    })
  ];
}

function withStructuredAnalysisHeadings(text, { sources = [] } = {}) {
  const normalized = text.trim();

  if (!normalized) {
    throw new HttpError(502, 'The model returned an empty analysis response.');
  }

  const lower = normalized
    .toLowerCase()
    .replace(/[’‘]/g, "'");
  const hasAllHeadings = [
    'bottom line',
    'facts',
    'analysis',
    'final conclusion'
  ].every((heading) => lower.includes(heading));

  if (hasAllHeadings) {
    return appendVerifiedAuthorityList(normalized, sources);
  }

  const authorityNotes = sources.length
    ? sources
        .map((source) => {
          const citation = source.citations?.length ? ` (${source.citations.join('; ')})` : '';

          return `- **${source.title}**${citation}: review the linked CourtListener source before relying on it.`;
        })
        .join('\n')
    : '- No CourtListener authorities were available for this analysis turn.';

  return [
    '## Bottom Line',
    'The model returned an unstructured analysis. Treat the following explanation as educational information and verify the cited authorities before relying on it.',
    '',
    '## Facts',
    '- Review the roleplay transcript above as the factual record for this analysis.',
    '',
    '## Analysis',
    normalized,
    '',
    'Retrieved authorities:',
    authorityNotes,
    '',
    '## Final Conclusion',
    'This is educational information rather than legal advice. Check the cited CourtListener sources and the transcript facts before relying on the analysis.'
  ].join('\n');
}

function appendVerifiedAuthorityList(text, sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return text;
  }

  if (/^\s*(?:#{1,6}\s*)?(?:authorities|authorities checked|retrieved authorities)\s*:?\s*$/im.test(text)) {
    return text;
  }

  const authorityLines = sources.map((source) => {
    const citation = source.citations?.length ? `, ${source.citations.join('; ')}` : '';

    return `- **${source.title}**${citation}`;
  });

  return [
    text,
    '',
    'Authorities checked:',
    ...authorityLines
  ].join('\n');
}

function buildScenarioCreationPrompt(promptIdea) {
  const cleanedIdea = typeof promptIdea === 'string' ? promptIdea.trim() : '';

  return cleanedIdea
    ? `Invent a new police-overreach roleplay scenario based on this idea: ${cleanedIdea}`
    : 'Invent a new classic Fourth Amendment police-overreach roleplay scenario.';
}

function buildAnalysisResearchQuery({ scenario, transcript }) {
  const transcriptText = transcript
    .filter((message) => message.channel === TRANSCRIPT_CHANNELS.SCENARIO)
    .slice(-8)
    .map((message) => message.content)
    .join(' ');
  const authorityHints = new Set([
    'Fourth Amendment',
    'traffic stop',
    'reasonable suspicion',
    'probable cause',
    'consent search'
  ]);

  if (/\bterry\b|reasonable suspicion|stop and frisk/i.test(transcriptText)) {
    authorityHints.add('Terry v. Ohio');
  }

  if (
    /\btraffic\b|\bvehicle\b|\bcar\b|\bautomobile\b|\bbackpack\b|\bbag\b|\bcontainer\b/i.test(
      transcriptText
    ) ||
    scenario.id === 'traffic-stop-backpack-search'
  ) {
    authorityHints.add('automobile exception');
    authorityHints.add('California v. Acevedo');
    authorityHints.add('Carroll v. United States');
    authorityHints.add('vehicle container search');
  }

  if (/\bconsent\b|\brefus(?:e|ed|al|ing)\b/i.test(transcriptText)) {
    authorityHints.add('Schneckloth v. Bustamonte');
    authorityHints.add('voluntariness of consent to search');
    authorityHints.add('right to refuse consent');
  }

  if (/\bwarrant\b|\bwarrantless\b/i.test(transcriptText)) {
    authorityHints.add('warrantless vehicle search');
    authorityHints.add('probable cause exception');
  }

  if (/\bk9\b|\bdog\b|canine|sniff|wait for|prolong|free to leave/i.test(transcriptText)) {
    authorityHints.add('Rodriguez v. United States');
    authorityHints.add('traffic stop prolongation');
  }

  scenario.legalFocus.forEach((focus) => {
    if (/fourth amendment|traffic|vehicle|consent|probable cause|reasonable suspicion/i.test(focus)) {
      authorityHints.add(focus);
    }
  });

  return Array.from(authorityHints)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
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

function parseJsonObjectFromText(text) {
  const normalized = text.trim();
  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : normalized;
  const firstBraceIndex = candidate.indexOf('{');
  const lastBraceIndex = candidate.lastIndexOf('}');

  if (firstBraceIndex === -1 || lastBraceIndex === -1) {
    throw new HttpError(502, 'The model did not return scenario JSON.');
  }

  try {
    return JSON.parse(candidate.slice(firstBraceIndex, lastBraceIndex + 1));
  } catch {
    throw new HttpError(502, 'The generated scenario could not be parsed.');
  }
}

export class SimulatorService {
  constructor({ config, courtListenerService = null, usageLogger = null }) {
    this.config = config;
    this.courtListenerService = courtListenerService;
    this.usageLogger = usageLogger;
    this.legalRetrievalWorkflow = new LegalRetrievalWorkflow({
      config,
      courtListenerService,
      usageLogger
    });
  }

  getBootstrap() {
    const defaultScenario = getDefaultScenario();

    return {
      appMode: this.config.appMode,
      defaultScenarioId: defaultScenario.id,
      defaultProviderId: this.config.defaultProviderId,
      scenarios: getScenarioSummaries(),
      providers: getProviderOptions(this.config),
      providerStatus: getProviderStatus(this.config)
    };
  }

  resetScenario({ scenarioId, scenario, providerId, model } = {}) {
    const resolvedScenario = this.#resolveScenario(scenarioId, scenario);
    const adapter = this.#resolveProvider(providerId);
    const resolvedModel = model?.trim() || adapter.getDefaultModel(this.config);

    return {
      appMode: this.config.appMode,
      scenarioId: resolvedScenario.id,
      providerId: adapter.id,
      model: resolvedModel,
      transcript: buildResetTranscript({
        scenario: resolvedScenario,
        providerId: adapter.id,
        model: resolvedModel,
        appMode: this.config.appMode
      })
    };
  }

  async submitTurn({
    scenarioId,
    scenario,
    providerId,
    model,
    transcript,
    userInput,
    providerConfig
  }) {
    ensureNonEmptyString(userInput, 'userInput');

    const resolvedScenario = this.#resolveScenario(scenarioId, scenario);
    const adapter = this.#resolveProvider(providerId);
    const resolvedModel = model?.trim() || adapter.getDefaultModel(this.config);
    const transcriptSoFar = sanitizeTranscript(transcript);
    const cleanedProviderConfig = cleanProviderConfig(providerConfig);

    const userMessage = createTranscriptMessage({
      role: TRANSCRIPT_ROLES.USER,
      channel: TRANSCRIPT_CHANNELS.SCENARIO,
      content: userInput
    });

    const displayTranscriptWithUserTurn = [...transcriptSoFar, userMessage];
    const conversationTranscript = displayTranscriptWithUserTurn.filter(
      (message) => message.channel !== TRANSCRIPT_CHANNELS.ANALYSIS
    );

    const normalizedScenarioRequest = adapter.normalizeRequest(
      {
        purpose: 'scenario',
        scenario: resolvedScenario,
        model: resolvedModel,
        systemPrompt: getScenarioSystemPrompt(resolvedScenario),
        transcript: conversationTranscript,
        providerConfig: cleanedProviderConfig
      },
      this.config
    );

    this.#assertProviderReady(adapter, normalizedScenarioRequest);

    const effectiveModel = normalizedScenarioRequest.model;

    this.#log({
      type: 'user_query',
      payload: {
        workspace: 'simulator',
        scenarioId: resolvedScenario.id,
        providerId: adapter.id,
        model: effectiveModel,
        text: userInput
      }
    });

    const scenarioResult = await this.#generateTextWithUsageLogging({
      adapter,
      request: normalizedScenarioRequest,
      scenarioId: resolvedScenario.id
    });

    const scenarioMessage = createTranscriptMessage({
      role: TRANSCRIPT_ROLES.ASSISTANT,
      channel: TRANSCRIPT_CHANNELS.SCENARIO,
      content: cleanGeneratedText(scenarioResult.text),
      meta: {
        actor: resolvedScenario.institutionalActor,
        providerId: adapter.id,
        model: effectiveModel,
        purpose: 'scenario'
      }
    });

    this.#log({
      type: 'police_response',
      payload: {
        workspace: 'simulator',
        scenarioId: resolvedScenario.id,
        providerId: adapter.id,
        model: effectiveModel,
        text: scenarioMessage.content
      }
    });

    const displayTranscriptWithScenarioReply = [
      ...displayTranscriptWithUserTurn,
      scenarioMessage
    ];

    return {
      appMode: this.config.appMode,
      scenarioId: resolvedScenario.id,
      providerId: adapter.id,
      model: effectiveModel,
      transcript: displayTranscriptWithScenarioReply
    };
  }

  async analyzeScenario({
    scenarioId,
    scenario,
    providerId,
    model,
    transcript,
    providerConfig,
    courtlistenerConfig
  }) {
    const resolvedScenario = this.#resolveScenario(scenarioId, scenario);
    const adapter = this.#resolveProvider(providerId);
    const resolvedModel = model?.trim() || adapter.getDefaultModel(this.config);
    const transcriptSoFar = sanitizeTranscript(transcript);
    const cleanedProviderConfig = cleanProviderConfig(providerConfig);
    const analysisTranscript = transcriptSoFar.filter(
      (message) => message.channel !== TRANSCRIPT_CHANNELS.ANALYSIS
    );
    const retrieval = this.courtListenerService
      ? await this.legalRetrievalWorkflow.retrieve({
          adapter,
          model: resolvedModel,
          providerConfig: cleanedProviderConfig,
          context: resolvedScenario,
          transcript: analysisTranscript,
          userInput: buildAnalysisResearchQuery({
            scenario: resolvedScenario,
            transcript: analysisTranscript
          }),
          courtlistenerConfig,
          sourceTypes: ['o'],
          workspace: 'simulator-analysis',
          generateText: ({ adapter: requestAdapter, request: workflowRequest }) =>
            this.#generateTextWithUsageLogging({
              adapter: requestAdapter,
              request: workflowRequest,
              scenarioId: resolvedScenario.id
            }),
          assertProviderReady: (requestAdapter, workflowRequest) =>
            this.#assertProviderReady(requestAdapter, workflowRequest)
        })
      : EMPTY_RETRIEVAL;

    const normalizedAnalysisRequest = adapter.normalizeRequest(
      {
        purpose: 'analysis',
        scenario: resolvedScenario,
        model: resolvedModel,
        systemPrompt: getAnalysisSystemPrompt(resolvedScenario, {
          retrieval,
          sources: retrieval.sources
        }),
        transcript: analysisTranscript,
        providerConfig: cleanedProviderConfig
      },
      this.config
    );

    this.#assertProviderReady(adapter, normalizedAnalysisRequest);
    const effectiveModel = normalizedAnalysisRequest.model;

    const analysisResult = await this.#generateTextWithUsageLogging({
      adapter,
      request: normalizedAnalysisRequest,
      scenarioId: resolvedScenario.id
    });

    const analysisContent = withStructuredAnalysisHeadings(
      cleanGeneratedText(analysisResult.text),
      {
        sources: retrieval.sources
      }
    );

    const analysisMessage = createTranscriptMessage({
      role: TRANSCRIPT_ROLES.ASSISTANT,
      channel: TRANSCRIPT_CHANNELS.ANALYSIS,
      content: analysisContent,
      meta: {
        providerId: adapter.id,
        model: effectiveModel,
        purpose: 'analysis',
        retrieval: buildRetrievalMeta(retrieval),
        sources: retrieval.sources
      }
    });

    this.#log({
      type: 'analysis_generated',
      payload: {
        workspace: 'simulator',
        scenarioId: resolvedScenario.id,
        providerId: adapter.id,
        model: effectiveModel,
        retrievalStatus: retrieval.status,
        sourceCount: retrieval.sources.length,
        text: analysisContent
      }
    });

    return {
      appMode: this.config.appMode,
      scenarioId: resolvedScenario.id,
      providerId: adapter.id,
      model: effectiveModel,
      transcript: [
        ...transcriptSoFar,
        analysisMessage
      ]
    };
  }

  async inventScenario({ providerId, model, providerConfig, promptIdea } = {}) {
    const adapter = this.#resolveProvider(providerId);
    const resolvedModel = model?.trim() || adapter.getDefaultModel(this.config);
    const cleanedProviderConfig = cleanProviderConfig(providerConfig);
    const normalizedRequest = adapter.normalizeRequest(
      {
        purpose: 'scenario-invention',
        scenario: SCENARIO_GENERATOR_CONTEXT,
        model: resolvedModel,
        systemPrompt: getScenarioCreationSystemPrompt(),
        transcript: [
          createTranscriptMessage({
            role: TRANSCRIPT_ROLES.USER,
            channel: TRANSCRIPT_CHANNELS.SYSTEM,
            content: buildScenarioCreationPrompt(promptIdea)
          })
        ],
        providerConfig: cleanedProviderConfig
      },
      this.config
    );

    this.#assertProviderReady(adapter, normalizedRequest);
    const effectiveModel = normalizedRequest.model;

    const generatedScenarioResponse = await this.#generateTextWithUsageLogging({
      adapter,
      request: normalizedRequest,
      scenarioId: SCENARIO_GENERATOR_CONTEXT.id
    });
    const generatedScenario = normalizeScenarioDefinition(
      parseJsonObjectFromText(generatedScenarioResponse.text),
      { generated: true }
    );

    return {
      appMode: this.config.appMode,
      providerId: adapter.id,
      model: effectiveModel,
      scenario: generatedScenario,
      scenarioSummary: toScenarioSummary(generatedScenario)
    };
  }

  #resolveScenario(scenarioId, providedScenario) {
    if (providedScenario) {
      return normalizeScenarioDefinition(providedScenario, { generated: true });
    }

    const resolvedScenarioId = scenarioId || getDefaultScenario().id;
    const scenario = getScenarioById(resolvedScenarioId);

    if (!scenario) {
      throw new HttpError(404, `Unknown scenario: ${resolvedScenarioId}`);
    }

    return scenario;
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

  async #generateTextWithUsageLogging({ adapter, request, scenarioId }) {
    const startedAt = Date.now();

    try {
      const result = await adapter.generateText(request, this.config);

      this.#log({
        type: 'inference_call',
        payload: {
          workspace: request.purpose === 'legal-research' ? 'research' : 'simulator',
          purpose: request.purpose,
          providerId: adapter.id,
          model: request.model,
          endpoint: request.endpoint,
          scenarioId,
          durationMs: Date.now() - startedAt,
          success: true
        }
      });

      return result;
    } catch (error) {
      this.#log({
        type: 'inference_call',
        payload: {
          workspace: request.purpose === 'legal-research' ? 'research' : 'simulator',
          purpose: request.purpose,
          providerId: adapter.id,
          model: request.model,
          endpoint: request.endpoint,
          scenarioId,
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
