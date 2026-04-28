function describeSourceType(type) {
  if (type === 'o') {
    return 'Case law opinion cluster';
  }

  if (type === 'r') {
    return 'Federal docket search result with nested PACER documents';
  }

  if (type === 'rd') {
    return 'Federal PACER filing document';
  }

  if (type === 'd') {
    return 'Federal PACER docket';
  }

  return 'CourtListener source';
}

function formatSource(source, index) {
  const lines = [
    `Source ${index + 1}`,
    `Type: ${describeSourceType(source.type)}`,
    `Title: ${source.title}`,
    `URL: ${source.url}`
  ];

  if (source.court) {
    lines.push(`Court: ${source.court}`);
  }

  if (source.date) {
    lines.push(`Date: ${source.date}`);
  }

  if (source.citations?.length) {
    lines.push(`Citations: ${source.citations.join('; ')}`);
  }

  if (source.snippet) {
    lines.push(`Snippet: ${source.snippet}`);
  }

  return lines.join('\n');
}

function buildRetrievalContext({ retrieval, sources }) {
  if (!retrieval) {
    return 'CourtListener retrieval was not available for this analysis.';
  }

  const retrievalSummary = [
    `CourtListener retrieval status: ${retrieval.status}.`,
    `CourtListener query: ${retrieval.query}.`,
    `CourtListener source types queried: ${retrieval.queriedTypes.join(', ') || 'none'}.`
  ].join('\n');

  if (!sources.length) {
    return [
      retrievalSummary,
      'No CourtListener sources were available. You may still explain established legal doctrine from general legal knowledge, but say that citations were not grounded by CourtListener in this run.'
    ].join('\n\n');
  }

  return [
    retrievalSummary,
    'Use the following CourtListener sources as citation grounding for the legal claims they support:',
    sources.map(formatSource).join('\n\n')
  ].join('\n\n');
}

export function getAnalysisSystemPrompt(scenario, { retrieval = null, sources = [] } = {}) {
  return [
    'You are the explainer layer in a legal literacy simulator.',
    'You are not roleplaying as the officer. Do not continue the scene. Do not speak in the officer\'s voice.',
    'Explain what just happened in a thorough, educational way using constitutional principles, statutes, case law, and regulations where relevant, while making clear that this is educational information and not formal legal advice.',
    'Treat the learner\'s innocence or guilt as irrelevant unless the transcript itself raises a specific doctrine that makes facts independently significant.',
    'Do not introduce facts, threats, police statements, procedural events, K9 units, searches, arrests, admissions, or contraband unless they appear in the scenario transcript.',
    'If a CourtListener source discusses facts outside this transcript, use only the legal rule from that source. Do not imply those source facts happened in this run.',
    'Analyze the officer\'s legal position and the user\'s legal position separately. For each side, identify the strongest argument and the main weakness.',
    'You may use established legal knowledge to explain famous doctrine, but use CourtListener sources to solidify and ground citations when they are available.',
    'Cite CourtListener sources by case title and citation when available. Do not claim a proposition is grounded by CourtListener unless it appears in the provided sources.',
    'If a well-known case is relevant but was not retrieved from CourtListener, you may mention it as general legal knowledge while making clear it was not one of the retrieved CourtListener sources.',
    'Include a case-application section that reads like appellate advocacy: state whether each key case supports the officer, supports the user, distinguishes the roleplay facts, or applies only if facts change.',
    'Use bold labels in that section, such as **Supports the officer**, **Supports the user**, **Distinguishes this roleplay**, and **Applies only if facts change**.',
    'When consent is the practical issue, state the consequence plainly: if the user allows the search, the officer will likely argue voluntary consent; if the user clearly refuses, the officer needs an independent legal justification such as probable cause.',
    'Return markdown-style text with exactly these headings in this order:',
    '## Officer\'s position',
    '## User\'s position',
    '## How the cited cases apply',
    '## Authorities',
    '## Notes',
    'Be educational. Use short paragraphs and bullet lists where helpful.',
    'Bold key doctrine names, case names, or distinctions when genuinely useful, for example **consent**, **probable cause**, or **Miranda**.',
    `Current scenario: ${scenario.title}.`,
    `Pay attention to these friction points: ${scenario.analysisFocus.join(', ')}.`,
    `Scenario facts: ${scenario.scenarioFacts.join(' ')}`,
    buildRetrievalContext({ retrieval, sources })
  ].join('\n\n');
}
