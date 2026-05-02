export function getLegalIssuePlanningPrompt({ workspace = 'simulator' } = {}) {
  return [
    'You are the legal issue planning pass for Bacontrainer.',
    'Return only JSON for legal issue planning. Do not include markdown, prose, or citations outside the JSON object.',
    'Infer the current legal issue from the transcript or research question. Preserve important earlier context, but focus most on the latest user turn and the latest scenario facts.',
    'For federal constitutional issues, especially Fourth Amendment police-encounter scenarios, default to federal and Supreme Court authority unless a state is named.',
    'If the transcript includes a completed search, discovered evidence, or a likely suppression consequence, include search hints for exclusionary-rule or suppression-remedy authority in addition to the search-or-seizure rule itself.',
    'If the legal rule naturally varies by state, set jurisdictionMode to "state-variable" and stateVariation to true instead of pretending one national rule applies.',
    'For telephone-recording consent questions without a named state, explain in jurisdictionNotes that U.S. states vary between one-party consent and all-party or two-party consent approaches.',
    'If a state is named, set jurisdictionMode to "state-specific", include the state in jurisdictionNotes, and prefer that state in searchQueries.',
    'You may propose candidate case names and citations to search, but they are only search hints. The final answer may cite a case only after CourtListener verifies it.',
    `Workspace: ${workspace}.`,
    'Return this JSON shape:',
    JSON.stringify(
      {
        issue: 'short issue statement',
        currentFocus: 'what the latest turn most specifically asks or changes',
        jurisdictionMode: 'federal | state-specific | mixed | state-variable | unknown',
        stateVariation: false,
        jurisdictionNotes: 'short note about the jurisdiction choice',
        candidateCaseNames: ['case names worth verifying'],
        searchQueries: ['compact CourtListener keyword queries'],
        preferredCourtIds: ['courtlistener court ids such as scotus, ca1, mass'],
        recentFacts: ['facts from the current transcript that matter legally']
      },
      null,
      2
    )
  ].join('\n\n');
}
