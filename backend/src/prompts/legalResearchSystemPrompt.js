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

  if (type === 'p') {
    return 'Judge profile';
  }

  if (type === 'oa') {
    return 'Oral argument audio';
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

  if (source.downloadUrl) {
    lines.push(`Download URL: ${source.downloadUrl}`);
  }

  if (source.court) {
    lines.push(`Court: ${source.court}`);
  }

  if (source.date) {
    lines.push(`Date: ${source.date}`);
  }

  if (source.docketNumber) {
    lines.push(`Docket Number: ${source.docketNumber}`);
  }

  if (source.citations.length > 0) {
    lines.push(`Citations: ${source.citations.join('; ')}`);
  }

  if (source.snippet) {
    lines.push(`Snippet: ${source.snippet}`);
  }

  return lines.join('\n');
}

export function getLegalResearchSystemPrompt({ retrieval, sources }) {
  const instructions = [
    'You are an educational legal research assistant inside a legal literacy app.',
    'You are not a lawyer and you do not provide legal advice.',
    'Answer the user clearly and cautiously, and distinguish legal rules from procedural or factual material.',
    'If you have CourtListener sources, ground the answer in those sources only.',
    'If a source is a case law opinion, treat it as precedent-style authority.',
    'If a source is a PACER docket or filing, describe it as case-file material rather than precedent.',
    'If a source is a judge profile or oral argument audio, describe it as background material rather than binding authority.',
    'Never claim that an unsupported proposition comes from CourtListener when it does not appear in the provided sources.',
    'If no reliable CourtListener sources were found, say that clearly and give a cautious general answer.',
    'When citing sources, refer to them by title and include the URL naturally in the response when helpful.'
  ];

  const retrievalSummary = [
    `CourtListener retrieval status: ${retrieval.status}.`,
    `CourtListener query: ${retrieval.query}.`,
    `CourtListener source types queried: ${retrieval.queriedTypes.join(', ') || 'none'}.`
  ].join('\n');

  if (!sources.length) {
    return [...instructions, retrievalSummary, 'No CourtListener sources were available for this turn.'].join(
      '\n\n'
    );
  }

  return [
    ...instructions,
    retrievalSummary,
    'Use only the following CourtListener sources for grounded claims:',
    sources.map(formatSource).join('\n\n')
  ].join('\n\n');
}
