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

const COURTLISTENER_OPINION_URL_PATTERN = /(?:courtlistener\.com)?\/opinion\/(\d+)(?:\/|\b)/gi;
const LEGAL_CITATION_PATTERN =
  /\b\d{1,4}\s+(?:U\.S\.|S\. ?Ct\.|L\. ?Ed\. ?(?:2d)?|F\. ?(?:2d|3d|4th|Supp\. ?(?:2d|3d)?)|Mass\.|N\.E\. ?(?:2d|3d)?|N\.Y\. ?(?:2d|3d)?|A\. ?(?:2d|3d)|Cal\. ?(?:App\. ?(?:4th|5th)|[45]th)?)\s+\d{1,6}\b/gi;

function extractPatternMatches(value, pattern) {
  const matches = [];
  const text = cleanOptionalString(value);
  let match;

  pattern.lastIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1] || match[0]);
  }

  return dedupeStrings(matches);
}

function extractCourtListenerOpinionIds(value) {
  return extractPatternMatches(value, COURTLISTENER_OPINION_URL_PATTERN);
}

function extractLegalCitations(value) {
  return extractPatternMatches(value, LEGAL_CITATION_PATTERN);
}

function allowsOpinionExactLookup(forcedSourceTypes) {
  return forcedSourceTypes.length === 0 || forcedSourceTypes.includes('o');
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

function normalizeIssuePlanArray(value, maxItems = 8) {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeStrings(value).slice(0, maxItems);
}

function normalizeCourtIds(value) {
  return normalizeIssuePlanArray(value, 5).map((courtId) => courtId.toLowerCase());
}

function shouldPreferScotus(issuePlan, fallbackQuery) {
  const combinedText = [
    issuePlan?.issue,
    issuePlan?.currentFocus,
    issuePlan?.jurisdictionNotes,
    fallbackQuery
  ]
    .filter(Boolean)
    .join(' ');

  return (
    issuePlan?.jurisdictionMode === 'federal' ||
    /\b(fourth amendment|traffic stop|terry|police|search|seizure|frisk|driver|passenger)\b/i.test(
      combinedText
    )
  );
}

function getPrimaryCourtId(issuePlan, fallbackQuery) {
  const preferredCourtIds = normalizeCourtIds(issuePlan?.preferredCourtIds);

  if (preferredCourtIds.includes('scotus')) {
    return 'scotus';
  }

  if (preferredCourtIds.length > 0) {
    return preferredCourtIds[0];
  }

  return shouldPreferScotus(issuePlan, fallbackQuery) ? 'scotus' : '';
}

function withCourtFilter(query, courtId) {
  const cleanedQuery = cleanOptionalString(query);
  const cleanedCourtId = cleanOptionalString(courtId);

  if (!cleanedQuery || !cleanedCourtId || cleanedQuery.includes('court_id:')) {
    return cleanedQuery;
  }

  return `court_id:${cleanedCourtId} ${cleanedQuery}`;
}

function buildCaseNameQuery(caseName, courtId) {
  const cleanedCaseName = cleanOptionalString(caseName);

  if (!cleanedCaseName) {
    return '';
  }

  return withCourtFilter(`caseName:(${cleanedCaseName})`, courtId);
}

function addSearchSpec(specs, seen, spec) {
  const query = cleanOptionalString(spec.query);
  const type = cleanOptionalString(spec.type) || 'o';

  if (!query || type !== 'o') {
    return;
  }

  const semantic = Boolean(spec.semantic);
  const orderBy = cleanOptionalString(spec.orderBy);
  const key = [type, query, semantic, orderBy].join('|');

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  specs.push({
    query,
    type,
    semantic,
    orderBy,
    queriedType: spec.queriedType || (semantic ? 'o-semantic' : 'o-keyword'),
    limit: spec.limit || 4
  });
}

function buildPlannedSearchSpecs({ issuePlan, fallbackQuery, semanticFallback = false } = {}) {
  const specs = [];
  const seen = new Set();
  const preferredCourtId = getPrimaryCourtId(issuePlan, fallbackQuery);
  const candidateCaseNames = normalizeIssuePlanArray(issuePlan?.candidateCaseNames, 8);
  const searchQueries = normalizeIssuePlanArray(issuePlan?.searchQueries, 8);
  const baseQueries = searchQueries.length
    ? searchQueries
    : [issuePlan?.issue, issuePlan?.currentFocus, fallbackQuery];

  candidateCaseNames.forEach((caseName) => {
    addSearchSpec(specs, seen, {
      query: buildCaseNameQuery(caseName, preferredCourtId),
      type: 'o',
      semantic: false,
      queriedType: 'o-case-name',
      limit: 4
    });
    addSearchSpec(specs, seen, {
      query: `caseName:(${caseName})`,
      type: 'o',
      semantic: false,
      queriedType: 'o-case-name',
      limit: 4
    });
  });

  baseQueries.forEach((query) => {
    const filteredQuery = withCourtFilter(query, preferredCourtId);

    addSearchSpec(specs, seen, {
      query: filteredQuery,
      type: 'o',
      semantic: false,
      queriedType: 'o-keyword',
      limit: 5
    });
    addSearchSpec(specs, seen, {
      query: filteredQuery,
      type: 'o',
      semantic: false,
      orderBy: 'citeCount desc',
      queriedType: 'o-citation-count',
      limit: 5
    });

    if (semanticFallback) {
      addSearchSpec(specs, seen, {
        query,
        type: 'o',
        semantic: true,
        queriedType: 'o-semantic',
        limit: 5
      });
    }
  });

  return specs;
}

function getSourceClusterId(source) {
  const match = cleanOptionalString(source?.id).match(/^o-(\d+)$/);

  return match ? match[1] : '';
}

function buildCitationGraphSpecs(sources) {
  const specs = [];
  const seen = new Set();

  sources.slice(0, 3).forEach((source) => {
    const clusterId = getSourceClusterId(source);

    if (!clusterId) {
      return;
    }

    addSearchSpec(specs, seen, {
      query: `cites:${clusterId}`,
      type: 'o',
      semantic: false,
      queriedType: 'o-citation-graph',
      limit: 4
    });
  });

  return specs;
}

function cleanSnippet(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return stripHtml(value).trim();
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16))
    )
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)));
}

function stripHtml(value) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' '));
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
    citationCount: Number(result.citeCount ?? result.cite_count ?? 0) || 0,
    snippet: compactSnippet(leadOpinion?.snippet || result.syllabus)
  };
}

function formatCitation(citation) {
  if (typeof citation === 'string') {
    return citation.trim();
  }

  if (!citation || typeof citation !== 'object') {
    return '';
  }

  return [citation.volume, citation.reporter, citation.page]
    .map((part) => cleanOptionalString(String(part ?? '')))
    .filter(Boolean)
    .join(' ');
}

function extractOpinionSnippet(opinion) {
  if (!opinion || typeof opinion !== 'object') {
    return '';
  }

  return (
    cleanOptionalString(opinion.snippet) ||
    cleanOptionalString(opinion.plain_text) ||
    cleanOptionalString(opinion.html_with_citations) ||
    cleanOptionalString(opinion.html) ||
    cleanOptionalString(opinion.xml_harvard)
  );
}

function normalizeClusterSource(cluster, config, snippet = '') {
  const citations = dedupeStrings(
    (Array.isArray(cluster.citations) ? cluster.citations : []).map(formatCitation)
  );
  const clusterId = stripEmpty(String(cluster.id ?? cluster.cluster_id ?? ''));

  if (!clusterId) {
    return null;
  }

  return {
    id: `o-${clusterId}`,
    type: 'o',
    title:
      stripEmpty(cluster.case_name_full) ||
      stripEmpty(cluster.caseNameFull) ||
      stripEmpty(cluster.case_name) ||
      stripEmpty(cluster.caseName) ||
      'Untitled opinion',
    url: buildAbsoluteUrl(config.baseUrl, cluster.absolute_url),
    downloadUrl: '',
    court: stripEmpty(cluster.court),
    date: stripEmpty(cluster.date_filed) || stripEmpty(cluster.dateFiled),
    docketNumber: stripEmpty(cluster.docketNumber),
    citations,
    citationCount: Number(cluster.citeCount ?? cluster.cite_count ?? 0) || 0,
    snippet: compactSnippet(snippet || cluster.syllabus || cluster.summary)
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
    const exactResults = await this.#retrieveExactOpinionSources(
      query,
      runtimeConfig,
      forcedSourceTypes
    );

    if (exactResults.sources.length > 0) {
      return {
        status: 'grounded',
        query,
        queriedTypes: exactResults.queriedTypes,
        sources: exactResults.sources.slice(0, 6)
      };
    }

    const primaryResults = await this.#searchTypes(route.primaryTypes, query, runtimeConfig);
    let typeBuckets = primaryResults.typeBuckets;
    let failures = [...exactResults.failures, ...primaryResults.failures];

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

  async retrieveFromIssuePlan({ issuePlan, userInput, courtlistenerConfig, sourceTypes } = {}) {
    const fallbackQuery =
      cleanOptionalString(issuePlan?.issue) ||
      cleanOptionalString(issuePlan?.currentFocus) ||
      cleanOptionalString(userInput);
    const runtimeConfig = {
      apiToken:
        cleanOptionalString(courtlistenerConfig?.apiToken) ||
        cleanOptionalString(this.config.courtlistener.apiToken),
      baseUrl: this.config.courtlistener.baseUrl
    };
    const forcedSourceTypes = normalizeSourceTypes(sourceTypes);
    const exactQuery = dedupeStrings([
      userInput,
      issuePlan?.issue,
      issuePlan?.currentFocus,
      issuePlan?.jurisdictionNotes,
      ...(Array.isArray(issuePlan?.candidateCaseNames) ? issuePlan.candidateCaseNames : []),
      ...(Array.isArray(issuePlan?.searchQueries) ? issuePlan.searchQueries : [])
    ]).join(' ');
    const exactResults = await this.#retrieveExactOpinionSources(
      exactQuery,
      runtimeConfig,
      forcedSourceTypes
    );
    const nonSemanticResults = await this.#searchQuerySpecs(
      buildPlannedSearchSpecs({
        issuePlan,
        fallbackQuery,
        semanticFallback: false
      }),
      runtimeConfig
    );
    let sources = dedupeSources([
      ...exactResults.sources,
      ...nonSemanticResults.sources
    ]);
    let failures = [...exactResults.failures, ...nonSemanticResults.failures];
    let queriedTypes = dedupeStrings([
      ...exactResults.queriedTypes,
      ...nonSemanticResults.queriedTypes
    ]);

    if (sources.length > 0 && sources.length < 6) {
      const graphResults = await this.#searchQuerySpecs(buildCitationGraphSpecs(sources), runtimeConfig);

      sources = dedupeSources([...sources, ...graphResults.sources]);
      failures = [...failures, ...graphResults.failures];
      queriedTypes = dedupeStrings([...queriedTypes, ...graphResults.queriedTypes]);
    }

    if (sources.length < 3) {
      const semanticResults = await this.#searchQuerySpecs(
        buildPlannedSearchSpecs({
          issuePlan,
          fallbackQuery,
          semanticFallback: true
        }).filter((spec) => spec.semantic),
        runtimeConfig
      );

      sources = dedupeSources([...sources, ...semanticResults.sources]);
      failures = [...failures, ...semanticResults.failures];
      queriedTypes = dedupeStrings([...queriedTypes, ...semanticResults.queriedTypes]);
    }

    const cappedSources = sources.slice(0, 18);

    if (cappedSources.length > 0) {
      return {
        status: 'grounded',
        query: fallbackQuery,
        queriedTypes,
        sources: cappedSources,
        issue: issuePlan?.issue,
        jurisdictionMode: issuePlan?.jurisdictionMode,
        strategy: 'multi-step'
      };
    }

    if (failures.length > 0) {
      return {
        status: classifyFailure(failures[0]),
        query: fallbackQuery,
        queriedTypes,
        sources: [],
        issue: issuePlan?.issue,
        jurisdictionMode: issuePlan?.jurisdictionMode,
        strategy: 'multi-step'
      };
    }

    return {
      status: 'no-results',
      query: fallbackQuery,
      queriedTypes,
      sources: [],
      issue: issuePlan?.issue,
      jurisdictionMode: issuePlan?.jurisdictionMode,
      strategy: 'multi-step'
    };
  }

  #countSources(typeBuckets, types) {
    return types.reduce((total, type) => total + (typeBuckets[type]?.length || 0), 0);
  }

  async #retrieveExactOpinionSources(query, runtimeConfig, forcedSourceTypes) {
    if (!allowsOpinionExactLookup(forcedSourceTypes)) {
      return {
        sources: [],
        failures: [],
        queriedTypes: []
      };
    }

    const opinionIds = extractCourtListenerOpinionIds(query);
    const citationSources =
      opinionIds.length > 0 ? [] : await this.#lookupCitationSources(query, runtimeConfig);
    const urlSources = await Promise.all(
      opinionIds.map((clusterId) => this.#retrieveClusterSource(clusterId, query, runtimeConfig))
    );
    const sources = dedupeSources([
      ...urlSources.flatMap((result) => result.sources),
      ...citationSources.flatMap((result) => result.sources)
    ]);
    const failures = [
      ...urlSources.flatMap((result) => result.failures),
      ...citationSources.flatMap((result) => result.failures)
    ];
    const queriedTypes = [
      ...(opinionIds.length > 0 ? ['o-url'] : []),
      ...(citationSources.length > 0 ? ['o-citation'] : [])
    ];

    return {
      sources,
      failures,
      queriedTypes
    };
  }

  async #lookupCitationSources(query, runtimeConfig) {
    const citations = extractLegalCitations(query);

    if (citations.length === 0) {
      return [];
    }

    const startedAt = Date.now();

    try {
      const payload = await this.client.lookupCitations({
        text: query,
        apiToken: runtimeConfig.apiToken
      });
      const clusters = (Array.isArray(payload) ? payload : [])
        .filter((result) => result?.status === 200 || Array.isArray(result?.clusters))
        .flatMap((result) => (Array.isArray(result.clusters) ? result.clusters : []));
      const sourceCandidates = await Promise.all(
        clusters.map(async (cluster) => {
          const leadOpinion = await this.#retrieveLeadOpinion(cluster, runtimeConfig);

          return normalizeClusterSource(
            cluster,
            runtimeConfig,
            extractOpinionSnippet(leadOpinion)
          );
        })
      );
      const sources = dedupeSources(
        sourceCandidates.filter(Boolean)
      );

      this.#log({
        type: 'case_retrieval_call',
        payload: {
          provider: 'courtlistener',
          query,
          sourceType: 'o-citation',
          semantic: false,
          resultCount: sources.length,
          durationMs: Date.now() - startedAt,
          success: true
        }
      });

      return [
        {
          sources,
          failures: []
        }
      ];
    } catch (error) {
      this.#log({
        type: 'case_retrieval_call',
        payload: {
          provider: 'courtlistener',
          query,
          sourceType: 'o-citation',
          semantic: false,
          resultCount: 0,
          durationMs: Date.now() - startedAt,
          success: false,
          error: error.message,
          upstreamStatus: error?.details?.upstreamStatus
        }
      });

      return [
        {
          sources: [],
          failures: [error]
        }
      ];
    }
  }

  async #retrieveClusterSource(clusterId, query, runtimeConfig) {
    const startedAt = Date.now();

    try {
      const cluster = await this.client.getCluster({
        clusterId,
        apiToken: runtimeConfig.apiToken
      });
      const leadOpinion = await this.#retrieveLeadOpinion(cluster, runtimeConfig);
      const source = normalizeClusterSource(
        cluster,
        runtimeConfig,
        extractOpinionSnippet(leadOpinion)
      );

      this.#log({
        type: 'case_retrieval_call',
        payload: {
          provider: 'courtlistener',
          query,
          sourceType: 'o-url',
          semantic: false,
          resultCount: source ? 1 : 0,
          durationMs: Date.now() - startedAt,
          success: true
        }
      });

      return {
        sources: source ? [source] : [],
        failures: []
      };
    } catch (error) {
      this.#log({
        type: 'case_retrieval_call',
        payload: {
          provider: 'courtlistener',
          query,
          sourceType: 'o-url',
          semantic: false,
          resultCount: 0,
          durationMs: Date.now() - startedAt,
          success: false,
          error: error.message,
          upstreamStatus: error?.details?.upstreamStatus
        }
      });

      return {
        sources: [],
        failures: [error]
      };
    }
  }

  async #retrieveLeadOpinion(cluster, runtimeConfig) {
    const opinionUrls = Array.isArray(cluster?.sub_opinions) ? cluster.sub_opinions : [];
    const leadOpinionUrl = opinionUrls.find((url) => typeof url === 'string' && url.trim());

    if (!leadOpinionUrl) {
      return null;
    }

    try {
      return await this.client.getApiResource({
        resourceUrl: leadOpinionUrl,
        apiToken: runtimeConfig.apiToken
      });
    } catch {
      return null;
    }
  }

  async #searchQuerySpecs(specs, runtimeConfig) {
    if (!specs.length) {
      return {
        sources: [],
        failures: [],
        queriedTypes: []
      };
    }

    const responses = await Promise.all(
      specs.map(async (spec) => {
        const startedAt = Date.now();

        try {
          const payload = await this.client.search({
            query: spec.query,
            type: spec.type,
            semantic: spec.semantic,
            highlight: true,
            orderBy: spec.orderBy,
            apiToken: runtimeConfig.apiToken
          });
          const rawResults = Array.isArray(payload?.results) ? payload.results : [];
          const sources = rawResults
            .slice(0, spec.limit)
            .map((item) => normalizeSource(item, spec.type, runtimeConfig))
            .filter(Boolean);

          this.#log({
            type: 'case_retrieval_call',
            payload: {
              provider: 'courtlistener',
              query: spec.query,
              sourceType: spec.queriedType,
              semantic: spec.semantic,
              resultCount: rawResults.length,
              durationMs: Date.now() - startedAt,
              success: true
            }
          });

          return {
            spec,
            sources
          };
        } catch (error) {
          this.#log({
            type: 'case_retrieval_call',
            payload: {
              provider: 'courtlistener',
              query: spec.query,
              sourceType: spec.queriedType,
              semantic: spec.semantic,
              resultCount: 0,
              durationMs: Date.now() - startedAt,
              success: false,
              error: error.message,
              upstreamStatus: error?.details?.upstreamStatus
            }
          });

          return {
            spec,
            error
          };
        }
      })
    );
    const failures = [];
    const sources = [];

    responses.forEach((result) => {
      if (result.error) {
        failures.push(result.error);
        return;
      }

      sources.push(...result.sources);
    });

    return {
      sources: dedupeSources(sources),
      failures,
      queriedTypes: dedupeStrings(responses.map((result) => result.spec.queriedType))
    };
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
