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

  if (source.selectionRole) {
    lines.push(`Selection role: ${source.selectionRole}`);
  }

  if (source.selectionReason) {
    lines.push(`Selection reason: ${source.selectionReason}`);
  }

  if (source.snippet) {
    lines.push(`Snippet: ${source.snippet}`);
  }

  return lines.join('\n');
}

function formatAnalysisBlueprint(blueprint) {
  if (!blueprint || typeof blueprint !== 'object') {
    return '';
  }

  const lines = ['Analysis blueprint from the source-selection pass:'];

  if (blueprint.bottomLine) {
    lines.push(`Bottom line: ${blueprint.bottomLine}`);
  }

  if (Array.isArray(blueprint.facts) && blueprint.facts.length) {
    lines.push('Facts to include in chronological order:');
    blueprint.facts.forEach((fact) => {
      lines.push(`- ${fact}`);
    });
  }

  if (Array.isArray(blueprint.issues) && blueprint.issues.length) {
    lines.push('Issues to analyze:');
    blueprint.issues.forEach((issue) => {
      lines.push(`- ${issue.title || 'Issue'}`);

      if (issue.recordAssessment) {
        lines.push(`  Record assessment: ${issue.recordAssessment}`);
      }

      if (issue.analysis) {
        lines.push(`  Analysis: ${issue.analysis}`);
      }
    });
  }

  if (blueprint.finalConclusion) {
    lines.push(`Final conclusion: ${blueprint.finalConclusion}`);
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
    `CourtListener source types queried: ${retrieval.queriedTypes.join(', ') || 'none'}.`,
    retrieval.strategy ? `Retrieval strategy: ${retrieval.strategy}.` : '',
    retrieval.issue ? `Inferred issue: ${retrieval.issue}.` : '',
    retrieval.currentFocus ? `Current turn focus: ${retrieval.currentFocus}.` : '',
    retrieval.jurisdictionMode ? `Jurisdiction mode: ${retrieval.jurisdictionMode}.` : '',
    retrieval.jurisdictionNotes ? `Jurisdiction notes: ${retrieval.jurisdictionNotes}` : '',
    retrieval.stateVariation
      ? 'If the issue varies by state, explain the variation instead of forcing a single national rule.'
      : ''
  ]
    .filter(Boolean)
    .join('\n');

  if (!sources.length) {
    return [
      retrievalSummary,
      formatAnalysisBlueprint(retrieval.analysisBlueprint),
      'No CourtListener sources were available. You may still explain established legal doctrine from general legal knowledge, but say that citations were not grounded by CourtListener in this run.'
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    retrievalSummary,
    formatAnalysisBlueprint(retrieval.analysisBlueprint),
    'Use the following CourtListener sources as citation grounding for the legal claims they support:',
    sources.map(formatSource).join('\n\n')
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function getAnalysisSystemPrompt(scenario, { retrieval = null, sources = [] } = {}) {
  return [
    'You are the explainer layer in a legal literacy simulator.',
    'You are not roleplaying as the officer. Do not continue the scene. Do not speak in the officer\'s voice.',
    'Explain what just happened in a thorough, educational way using constitutional principles, statutes, case law, and regulations where relevant, while making clear that this is educational information and not formal legal advice.',
    'Treat the learner\'s innocence or guilt as irrelevant unless the transcript itself raises a specific doctrine that makes facts independently significant.',
    'Do not introduce facts, threats, police statements, procedural events, K9 units, searches, arrests, admissions, or contraband unless they appear in the scenario transcript.',
    'If a CourtListener source discusses facts outside this transcript, use only the legal rule from that source. Do not imply those source facts happened in this run.',
    'Write like a compact court ruling or legal opinion: organize the answer around the factual record and the live legal issues, not around opposing debate-team positions.',
    'You may use established legal knowledge to explain famous doctrine, but use CourtListener sources to solidify and ground citations when they are available.',
    'When CourtListener sources are available, cite only the verified CourtListener sources for case citations. Do not claim a proposition is grounded by CourtListener unless it appears in the provided sources.',
    'Do not cite or name unretrieved cases unless you explicitly say they were not verified in this run; prefer omitting unretrieved case names when verified sources are available.',
    'In the Facts section, present the roleplay story as a neutral chronological list of facts from the scenario record and transcript.',
    'In the Analysis section, apply the law to each material issue raised by the facts. Use issue subheadings or bullets when that makes the ruling easier to scan.',
    'Explain likely procedural consequences when the facts support them, such as suppression of evidence after an unlawful search.',
    'Keep jurisdiction-dependent issues, such as badge-number or supervisor-request rules, carefully framed and avoid overstating them as federal constitutional rules unless the retrieved sources support that.',
    'When consent is the practical issue, state the consequence plainly: if the user allows the search, the officer will likely argue voluntary consent; if the user clearly refuses, the officer needs an independent legal justification such as probable cause.',
    'Return markdown-style text with exactly these headings in this order:',
    '## Bottom Line',
    '## Facts',
    '## Analysis',
    '## Final Conclusion',
    'Use only those four top-level headings. Do not use the old headings "Officer\'s position" or "User\'s position".',
    'When sources are available, end the Final Conclusion with an "Authorities checked:" list using only the verified CourtListener sources provided to you.',
    'Be educational. Use short paragraphs and bullet lists where helpful.',
    'Bold key doctrine names, case names, or distinctions when genuinely useful, for example **consent**, **probable cause**, or **Miranda**.',
    `Current scenario: ${scenario.title}.`,
    `Pay attention to these friction points: ${scenario.analysisFocus.join(', ')}.`,
    `Scenario facts: ${scenario.scenarioFacts.join(' ')}`,
    buildRetrievalContext({ retrieval, sources })
  ].join('\n\n');
}
