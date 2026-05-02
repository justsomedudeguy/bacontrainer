import {
  TRANSCRIPT_CHANNELS,
  TRANSCRIPT_ROLES,
  createTranscriptMessage
} from '@bacontrainer/shared';
import { getLegalIssuePlanningPrompt } from '../prompts/legalIssuePlanningPrompt.js';
import { getLegalSourceSelectionPrompt } from '../prompts/legalSourceSelectionPrompt.js';

const MAX_TRANSCRIPT_MESSAGES = 12;
const MAX_CANDIDATE_SOURCES = 18;
const MAX_SELECTED_SOURCES = 5;
const JURISDICTION_MODES = new Set([
  'federal',
  'state-specific',
  'mixed',
  'state-variable',
  'unknown'
]);

function cleanOptionalString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function dedupeStrings(values) {
  return Array.from(
    new Set(
      values
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function parseJsonObjectFromText(text) {
  const normalized = cleanOptionalString(text);
  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : normalized;
  const firstBraceIndex = candidate.indexOf('{');
  const lastBraceIndex = candidate.lastIndexOf('}');

  if (firstBraceIndex === -1 || lastBraceIndex === -1) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(firstBraceIndex, lastBraceIndex + 1));
  } catch {
    return null;
  }
}

function normalizeStringArray(value, maxItems = 8) {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeStrings(value).slice(0, maxItems);
}

function normalizeJurisdictionMode(value, fallback = 'unknown') {
  const cleaned = cleanOptionalString(value).toLowerCase();

  return JURISDICTION_MODES.has(cleaned) ? cleaned : fallback;
}

function inferFallbackJurisdictionMode(text) {
  if (/\b(record|recording|wiretap|telephone|phone call|consent state)\b/i.test(text)) {
    return 'state-variable';
  }

  if (/\b(fourth amendment|traffic stop|terry|police|search|seizure|frisk)\b/i.test(text)) {
    return 'federal';
  }

  return 'unknown';
}

function shouldAddSuppressionRetrievalHints(text) {
  const hasSearchEvent =
    /\b(search(?:ed|es|ing)?|look(?:ed|ing)? inside|open(?:ed|ing)?|unzip(?:ped|s|ping)?|seiz(?:ed|es|ing|ure))\b/i.test(
      text
    );
  const hasEvidenceOrRemedy =
    /\b(found|discover(?:ed|s)?|pull(?:ed|s)? out|contraband|baggie|substance|evidence|suppress(?:ed|ion)?|exclusionary|fruit of the poisonous tree)\b/i.test(
      text
    );

  return hasSearchEvent && hasEvidenceOrRemedy;
}

function addSupplementalIssueHints(plan, sourceText) {
  const combinedText = [
    sourceText,
    plan.issue,
    plan.currentFocus,
    plan.jurisdictionNotes,
    ...plan.recentFacts
  ].join(' ');

  if (!shouldAddSuppressionRetrievalHints(combinedText)) {
    return plan;
  }

  return {
    ...plan,
    candidateCaseNames: dedupeStrings([
      ...plan.candidateCaseNames,
      'Mapp v. Ohio',
      'Wong Sun v. United States'
    ]),
    searchQueries: dedupeStrings([
      ...plan.searchQueries,
      'Fourth Amendment exclusionary rule suppression unlawful search evidence',
      'fruit of the poisonous tree unlawful search suppression'
    ])
  };
}

function normalizeIssuePlan(rawPlan, fallbackInput, supplementalText = fallbackInput) {
  const fallbackText = cleanOptionalString(fallbackInput);
  const inferredJurisdictionMode = inferFallbackJurisdictionMode(fallbackText);
  const jurisdictionMode = normalizeJurisdictionMode(
    rawPlan?.jurisdictionMode,
    inferredJurisdictionMode
  );
  const stateVariation =
    typeof rawPlan?.stateVariation === 'boolean'
      ? rawPlan.stateVariation
      : jurisdictionMode === 'state-variable';
  const searchQueries = normalizeStringArray(rawPlan?.searchQueries);
  const issue =
    cleanOptionalString(rawPlan?.issue) ||
    cleanOptionalString(rawPlan?.currentFocus) ||
    fallbackText ||
    'Legal issue for this turn';

  const plan = {
    issue,
    currentFocus: cleanOptionalString(rawPlan?.currentFocus) || issue,
    jurisdictionMode,
    stateVariation,
    jurisdictionNotes:
      cleanOptionalString(rawPlan?.jurisdictionNotes) ||
      (stateVariation
        ? 'The governing rule may vary by state; compare one-party and all-party consent approaches when relevant.'
        : ''),
    candidateCaseNames: normalizeStringArray(rawPlan?.candidateCaseNames),
    searchQueries: searchQueries.length ? searchQueries : [issue],
    preferredCourtIds: normalizeStringArray(rawPlan?.preferredCourtIds, 5),
    recentFacts: normalizeStringArray(rawPlan?.recentFacts, 10)
  };

  return addSupplementalIssueHints(plan, supplementalText);
}

function createWorkflowMessage(content) {
  return createTranscriptMessage({
    role: TRANSCRIPT_ROLES.USER,
    channel: TRANSCRIPT_CHANNELS.SYSTEM,
    content
  });
}

function buildPlanningInput({ context, transcript, userInput, workspace }) {
  const transcriptLines = transcript
    .slice(-MAX_TRANSCRIPT_MESSAGES)
    .map((message) => `[${message.channel || 'unknown'}:${message.role || 'unknown'}] ${message.content}`)
    .join('\n');

  return [
    `Workspace: ${workspace}.`,
    `Context title: ${context?.title || 'Legal context'}.`,
    context?.legalFocus?.length ? `Legal focus: ${context.legalFocus.join(', ')}.` : '',
    context?.analysisFocus?.length ? `Analysis focus: ${context.analysisFocus.join(', ')}.` : '',
    context?.scenarioFacts?.length ? `Scenario facts: ${context.scenarioFacts.join(' ')}` : '',
    cleanOptionalString(userInput) ? `Current request: ${cleanOptionalString(userInput)}` : '',
    transcriptLines ? `Recent transcript:\n${transcriptLines}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildSelectionInput({ issuePlan, candidates }) {
  const candidateList = candidates.slice(0, MAX_CANDIDATE_SOURCES).map((source) => ({
    id: source.id,
    title: source.title,
    citations: source.citations,
    court: source.court,
    date: source.date,
    url: source.url,
    snippet: source.snippet
  }));

  return JSON.stringify(
    {
      issuePlan,
      candidates: candidateList
    },
    null,
    2
  );
}

function applySelection(candidateSources, selectionPlan) {
  if (!selectionPlan) {
    return candidateSources.slice(0, MAX_SELECTED_SOURCES);
  }

  const candidatesById = new Map(candidateSources.map((source) => [source.id, source]));
  const selectedSources = Array.isArray(selectionPlan.selectedSources)
    ? selectionPlan.selectedSources
    : [];
  const selected = [];
  const seen = new Set();

  selectedSources.forEach((selection) => {
    const id = cleanOptionalString(selection?.id);
    const source = candidatesById.get(id);

    if (!source || seen.has(id) || selected.length >= MAX_SELECTED_SOURCES) {
      return;
    }

    seen.add(id);
    selected.push({
      ...source,
      selectionRole: cleanOptionalString(selection?.selectionRole) || 'background',
      selectionReason: cleanOptionalString(selection?.reason)
    });
  });

  return selected;
}

function normalizeBlueprintString(value) {
  return cleanOptionalString(value).slice(0, 1200);
}

function normalizeAnalysisBlueprint(rawBlueprint) {
  if (!rawBlueprint || typeof rawBlueprint !== 'object') {
    return null;
  }

  const facts = normalizeStringArray(rawBlueprint.facts, 12);
  const issues = Array.isArray(rawBlueprint.issues)
    ? rawBlueprint.issues
        .filter((issue) => issue && typeof issue === 'object')
        .map((issue) => ({
          title: normalizeBlueprintString(issue.title),
          recordAssessment: normalizeBlueprintString(issue.recordAssessment),
          analysis: normalizeBlueprintString(issue.analysis)
        }))
        .filter((issue) => issue.title || issue.recordAssessment || issue.analysis)
        .slice(0, 8)
    : [];
  const blueprint = {
    bottomLine: normalizeBlueprintString(rawBlueprint.bottomLine),
    facts,
    issues,
    finalConclusion: normalizeBlueprintString(rawBlueprint.finalConclusion)
  };

  return blueprint.bottomLine || blueprint.facts.length || blueprint.issues.length || blueprint.finalConclusion
    ? blueprint
    : null;
}

export class LegalRetrievalWorkflow {
  constructor({ config, courtListenerService, usageLogger = null }) {
    this.config = config;
    this.courtListenerService = courtListenerService;
    this.usageLogger = usageLogger;
  }

  async retrieve({
    adapter,
    model,
    providerConfig,
    context,
    transcript,
    userInput,
    courtlistenerConfig,
    sourceTypes = ['o'],
    workspace,
    generateText,
    assertProviderReady
  }) {
    if (!this.courtListenerService) {
      return {
        status: 'unavailable',
        query: '',
        queriedTypes: [],
        sources: [],
        strategy: 'multi-step'
      };
    }

    const issuePlan = await this.#planIssue({
      adapter,
      model,
      providerConfig,
      context,
      transcript,
      userInput,
      workspace,
      generateText,
      assertProviderReady
    });
    const candidateRetrieval = await this.courtListenerService.retrieveFromIssuePlan({
      issuePlan,
      userInput,
      courtlistenerConfig,
      sourceTypes
    });
    const sourceSelection = candidateRetrieval.sources.length
      ? await this.#selectSources({
          adapter,
          model,
          providerConfig,
          context,
          issuePlan,
          candidates: candidateRetrieval.sources,
          workspace,
          generateText,
          assertProviderReady
        })
      : {
          sources: [],
          analysisBlueprint: null,
          selectionSummary: ''
        };
    const sources = sourceSelection.sources.slice(0, MAX_SELECTED_SOURCES);
    const status = sources.length
      ? 'grounded'
      : candidateRetrieval.status === 'grounded'
        ? 'no-results'
        : candidateRetrieval.status;

    return {
      status,
      query: candidateRetrieval.query || issuePlan.issue,
      queriedTypes: candidateRetrieval.queriedTypes,
      sources,
      issue: issuePlan.issue,
      currentFocus: issuePlan.currentFocus,
      jurisdictionMode: issuePlan.jurisdictionMode,
      stateVariation: issuePlan.stateVariation,
      jurisdictionNotes: issuePlan.jurisdictionNotes,
      strategy: 'multi-step',
      selectionSummary: sourceSelection.selectionSummary,
      analysisBlueprint: sourceSelection.analysisBlueprint,
      candidateSourceCount: candidateRetrieval.sources.length
    };
  }

  async #planIssue({
    adapter,
    model,
    providerConfig,
    context,
    transcript,
    userInput,
    workspace,
    generateText,
    assertProviderReady
  }) {
    const planningInput = buildPlanningInput({
      context,
      transcript,
      userInput,
      workspace
    });
    const planningRequest = adapter.normalizeRequest(
      {
        purpose: 'legal-planning',
        scenario: context,
        model,
        systemPrompt: getLegalIssuePlanningPrompt({ workspace }),
        transcript: [
          createWorkflowMessage(planningInput)
        ],
        providerConfig
      },
      this.config
    );

    assertProviderReady?.(adapter, planningRequest);

    const result = await generateText({
      adapter,
      request: planningRequest,
      contextId: context?.id
    });
    const rawPlan = parseJsonObjectFromText(result.text);

    this.#log({
      type: 'legal_retrieval_issue_plan',
      payload: {
        workspace,
        providerId: adapter.id,
        model: planningRequest.model,
        parsed: Boolean(rawPlan)
      }
    });

    return normalizeIssuePlan(rawPlan, userInput, planningInput);
  }

  async #selectSources({
    adapter,
    model,
    providerConfig,
    context,
    issuePlan,
    candidates,
    workspace,
    generateText,
    assertProviderReady
  }) {
    const selectionRequest = adapter.normalizeRequest(
      {
        purpose: 'legal-selection',
        scenario: context,
        model,
        systemPrompt: getLegalSourceSelectionPrompt(),
        transcript: [
          createWorkflowMessage(
            buildSelectionInput({
              issuePlan,
              candidates
            })
          )
        ],
        providerConfig
      },
      this.config
    );

    assertProviderReady?.(adapter, selectionRequest);

    const result = await generateText({
      adapter,
      request: selectionRequest,
      contextId: context?.id
    });
    const selectionPlan = parseJsonObjectFromText(result.text);
    const selectedSources = applySelection(candidates, selectionPlan);
    const analysisBlueprint = normalizeAnalysisBlueprint(selectionPlan?.analysisBlueprint);
    const selectionSummary = cleanOptionalString(selectionPlan?.selectionSummary);

    this.#log({
      type: 'legal_retrieval_source_selection',
      payload: {
        workspace,
        providerId: adapter.id,
        model: selectionRequest.model,
        parsed: Boolean(selectionPlan),
        candidateCount: candidates.length,
        selectedCount: selectedSources.length,
        hasAnalysisBlueprint: Boolean(analysisBlueprint)
      }
    });

    return {
      sources: selectedSources,
      analysisBlueprint,
      selectionSummary
    };
  }

  #log(event) {
    this.usageLogger?.log(event);
  }
}
