function cleanOptionalString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function stripEmpty(value) {
  const cleaned = cleanOptionalString(value);
  return cleaned || '';
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

function dedupeSources(sources) {
  return Array.from(
    new Map(
      sources
        .filter(Boolean)
        .map((source) => [source.id, source])
    ).values()
  );
}

function buildAbsoluteUrl(baseUrl, absoluteUrl) {
  if (!absoluteUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(absoluteUrl)) {
    return absoluteUrl;
  }

  return new URL(absoluteUrl, baseUrl).toString();
}

function looksLikeJudgeQuestion(userInput) {
  return /\b(judge|justice|nomination|appointed|appointer|biography|bio|career|confirmation)\b/i.test(
    userInput
  );
}

function looksLikeOralArgumentQuestion(userInput) {
  return /\b(oral argument|hearing audio|audio recording|recording|listen to argument|argument audio)\b/i.test(
    userInput
  );
}

function looksLikeDocketQuestion(userInput) {
  return /\b(docket|case number|docket number|procedural posture|procedural history|status of the case|case status)\b/i.test(
    userInput
  );
}

function looksLikeFilingQuestion(userInput) {
  return /\b(filing|filed|motion|complaint|brief|petition|order|memorandum|affidavit|declaration)\b/i.test(
    userInput
  );
}

function looksLikeFederalCaseFileQuestion(userInput) {
  return /\b(pacer|recap|federal case file|federal docket|district court filing|case file)\b/i.test(
    userInput
  );
}

function routeIntent(userInput) {
  if (looksLikeJudgeQuestion(userInput)) {
    return {
      primaryTypes: ['p'],
      fallbackTypes: ['o']
    };
  }

  if (looksLikeOralArgumentQuestion(userInput)) {
    return {
      primaryTypes: ['oa'],
      fallbackTypes: ['o']
    };
  }

  if (looksLikeDocketQuestion(userInput)) {
    return {
      primaryTypes: ['d'],
      fallbackTypes: ['r']
    };
  }

  if (looksLikeFilingQuestion(userInput)) {
    return {
      primaryTypes: ['rd'],
      fallbackTypes: ['r']
    };
  }

  if (looksLikeFederalCaseFileQuestion(userInput)) {
    return {
      primaryTypes: ['r'],
      fallbackTypes: ['d', 'rd']
    };
  }

  return {
    primaryTypes: ['o'],
    fallbackTypes: ['r']
  };
}

function normalizeSourceTypes(sourceTypes) {
  if (!Array.isArray(sourceTypes)) {
    return [];
  }

  return dedupeStrings(sourceTypes).filter((type) =>
    ['o', 'r', 'rd', 'd', 'p', 'oa'].includes(type)
  );
}

function cleanSnippet(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function compactSnippet(value, maxLength = 240) {
  const cleaned = cleanSnippet(value).replace(/\s+/g, ' ');

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const hardLimit = Math.max(0, maxLength - 3);
  const sentenceBreak = cleaned.lastIndexOf('.', hardLimit);
  const wordBreak = cleaned.lastIndexOf(' ', hardLimit);
  const cutIndex = sentenceBreak >= 80 ? sentenceBreak + 1 : Math.max(wordBreak, hardLimit);

  return `${cleaned.slice(0, cutIndex).trim()}...`;
}

function normalizeOpinionSource(result, config) {
  const citations = dedupeStrings([
    ...(Array.isArray(result.citation) ? result.citation : []),
    result.neutralCite,
    result.lexisCite
  ]);
  const leadOpinion = Array.isArray(result.opinions) ? result.opinions[0] : null;

  return {
    id: `o-${result.cluster_id}`,
    type: 'o',
    title: stripEmpty(result.caseNameFull) || stripEmpty(result.caseName) || 'Untitled opinion',
    url: buildAbsoluteUrl(config.baseUrl, result.absolute_url),
    downloadUrl: stripEmpty(leadOpinion?.download_url),
    court: stripEmpty(result.court),
    date: stripEmpty(result.dateFiled) || stripEmpty(result.dateArgued),
    docketNumber: stripEmpty(result.docketNumber),
    citations,
    snippet: compactSnippet(leadOpinion?.snippet || result.syllabus)
  };
}

function normalizeDocketSource(result, config, type) {
  const firstDocument = Array.isArray(result.recap_documents) ? result.recap_documents[0] : null;
  const snippet = compactSnippet(firstDocument?.snippet || firstDocument?.description);

  return {
    id: `${type}-${result.docket_id}`,
    type,
    title: stripEmpty(result.case_name_full) || stripEmpty(result.caseName) || 'Untitled docket',
    url: buildAbsoluteUrl(config.baseUrl, result.docket_absolute_url || result.absolute_url),
    downloadUrl: '',
    court: stripEmpty(result.court),
    date: stripEmpty(result.dateFiled) || stripEmpty(result.dateArgued),
    docketNumber: stripEmpty(result.docketNumber),
    citations: [],
    snippet
  };
}

function normalizeDocumentSource(result, config) {
  return {
    id: `rd-${result.id}`,
    type: 'rd',
    title:
      stripEmpty(result.short_description) ||
      stripEmpty(result.description) ||
      `PACER document ${stripEmpty(String(result.document_number ?? result.id))}`,
    url: buildAbsoluteUrl(config.baseUrl, result.absolute_url),
    downloadUrl: '',
    court: '',
    date: stripEmpty(result.entry_date_filed),
    docketNumber: stripEmpty(String(result.docket_id ?? '')),
    citations: [],
    snippet: compactSnippet(result.snippet || result.description)
  };
}

function normalizeJudgeSource(result, config) {
  const latestPosition = Array.isArray(result.positions) ? result.positions[0] : null;

  return {
    id: `p-${result.id}`,
    type: 'p',
    title: stripEmpty(result.name) || 'Judge profile',
    url: buildAbsoluteUrl(config.baseUrl, result.absolute_url),
    downloadUrl: '',
    court: stripEmpty(latestPosition?.court_full_name || latestPosition?.court),
    date: stripEmpty(latestPosition?.date_start) || stripEmpty(result.dob),
    docketNumber: '',
    citations: [],
    snippet: compactSnippet(
      [latestPosition?.position_type, latestPosition?.court_full_name, latestPosition?.appointer]
        .filter(Boolean)
        .join(' | ')
    )
  };
}

function normalizeAudioSource(result, config) {
  return {
    id: `oa-${result.id}`,
    type: 'oa',
    title: stripEmpty(result.caseName) || 'Oral argument audio',
    url: buildAbsoluteUrl(config.baseUrl, result.absolute_url),
    downloadUrl: stripEmpty(result.download_url),
    court: stripEmpty(result.court),
    date: stripEmpty(result.dateArgued),
    docketNumber: stripEmpty(result.docketNumber),
    citations: [],
    snippet: compactSnippet(result.snippet)
  };
}

function normalizeSource(result, type, config) {
  if (type === 'o') {
    return normalizeOpinionSource(result, config);
  }

  if (type === 'r' || type === 'd') {
    return normalizeDocketSource(result, config, type);
  }

  if (type === 'rd') {
    return normalizeDocumentSource(result, config);
  }

  if (type === 'p') {
    return normalizeJudgeSource(result, config);
  }

  if (type === 'oa') {
    return normalizeAudioSource(result, config);
  }

  return null;
}

function classifyFailure(error) {
  const upstreamStatus = error?.details?.upstreamStatus;

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return 'unauthorized';
  }

  if (upstreamStatus === 429) {
    return 'rate-limited';
  }

  return 'unavailable';
}

export class CourtListenerService {
  constructor({ client, config, usageLogger = null }) {
    this.client = client;
    this.config = config;
    this.usageLogger = usageLogger;
  }

  getStatus() {
    return {
      configured: Boolean(cleanOptionalString(this.config.courtlistener.apiToken)),
      defaultBaseUrl: this.config.courtlistener.baseUrl,
      supportsBrowserToken: true,
      summary: `Default base URL: ${this.config.courtlistener.baseUrl}`
    };
  }

  async retrieve({ userInput, courtlistenerConfig, sourceTypes } = {}) {
    const query = cleanOptionalString(userInput);
    const runtimeConfig = {
      apiToken:
        cleanOptionalString(courtlistenerConfig?.apiToken) ||
        cleanOptionalString(this.config.courtlistener.apiToken),
      baseUrl: this.config.courtlistener.baseUrl
    };
    const forcedSourceTypes = normalizeSourceTypes(sourceTypes);
    const route = forcedSourceTypes.length
      ? {
          primaryTypes: forcedSourceTypes,
          fallbackTypes: []
        }
      : routeIntent(query);
    const orderedTypes = [...route.primaryTypes, ...route.fallbackTypes];
    const searchedTypes = [...route.primaryTypes];

    const primaryResults = await this.#searchTypes(route.primaryTypes, query, runtimeConfig);
    let typeBuckets = primaryResults.typeBuckets;
    let failures = [...primaryResults.failures];

    if (this.#countSources(typeBuckets, route.primaryTypes) < 3 && route.fallbackTypes.length > 0) {
      searchedTypes.push(...route.fallbackTypes);
      const fallbackResults = await this.#searchTypes(route.fallbackTypes, query, runtimeConfig);
      typeBuckets = {
        ...typeBuckets,
        ...fallbackResults.typeBuckets
      };
      failures = [...failures, ...fallbackResults.failures];
    }

    const sources = orderedTypes
      .flatMap((type) => typeBuckets[type] || [])
      .slice(0, 6);

    if (sources.length > 0) {
      return {
        status: 'grounded',
        query,
        queriedTypes: searchedTypes,
        sources
      };
    }

    if (failures.length > 0) {
      return {
        status: classifyFailure(failures[0]),
        query,
        queriedTypes: orderedTypes,
        sources: []
      };
    }

    return {
      status: 'no-results',
      query,
      queriedTypes: orderedTypes,
      sources: []
    };
  }

  #countSources(typeBuckets, types) {
    return types.reduce((total, type) => total + (typeBuckets[type]?.length || 0), 0);
  }

  async #searchTypes(types, query, runtimeConfig) {
    const responses = await Promise.all(
      types.map(async (type) => {
        const startedAt = Date.now();

        try {
          const payload = await this.client.search({
            query,
            type,
            semantic: type === 'o',
            highlight: true,
            apiToken: runtimeConfig.apiToken
          });

          this.#log({
            type: 'case_retrieval_call',
            payload: {
              provider: 'courtlistener',
              query,
              sourceType: type,
              semantic: type === 'o',
              resultCount: Array.isArray(payload?.results) ? payload.results.length : 0,
              durationMs: Date.now() - startedAt,
              success: true
            }
          });

          return {
            type,
            payload
          };
        } catch (error) {
          this.#log({
            type: 'case_retrieval_call',
            payload: {
              provider: 'courtlistener',
              query,
              sourceType: type,
              semantic: type === 'o',
              resultCount: 0,
              durationMs: Date.now() - startedAt,
              success: false,
              error: error.message,
              upstreamStatus: error?.details?.upstreamStatus
            }
          });

          return {
            type,
            error
          };
        }
      })
    );

    const typeBuckets = {};
    const failures = [];

    responses.forEach((result) => {
      if (result.error) {
        failures.push(result.error);
        return;
      }

      typeBuckets[result.type] = dedupeSources(
        (Array.isArray(result.payload?.results) ? result.payload.results : [])
          .slice(0, 3)
          .map((item) => normalizeSource(item, result.type, runtimeConfig))
          .filter(Boolean)
      );
    });

    return {
      typeBuckets,
      failures
    };
  }

  #log(event) {
    this.usageLogger?.log(event);
  }
}
