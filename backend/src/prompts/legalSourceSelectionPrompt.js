export function getLegalSourceSelectionPrompt() {
  return [
    'You are the CourtListener source selection and analysis blueprint pass for Bacontrainer.',
    'Return only JSON for CourtListener source selection and analysis blueprinting. Do not include markdown or prose outside the JSON object.',
    'Choose three to five sources from the candidate list by ID when that many candidates materially support the issues. Choose fewer only when fewer sources are genuinely useful. Never invent a source ID, case name, citation, or URL.',
    'Prefer one core landmark case plus narrowing, application, state-authority, or remedy cases when the candidates support that structure.',
    'For Fourth Amendment traffic-stop issues, prefer Supreme Court cases that establish the rule before narrower applications.',
    'If the record includes a completed search, discovered evidence, or a likely suppression issue, include a verified exclusionary-rule or suppression-remedy authority when one is present in the candidates.',
    'For state-specific issues, prefer the verified state authority over unrelated federal or out-of-state material.',
    'Build the analysis blueprint from the scenario facts and transcript as the record. Do not assume facts that are not in that record.',
    'The blueprint should organize the final answer like a compact ruling: a brief bottom line, neutral chronological facts, legal analysis applied to those facts, and a final conclusion.',
    'If a material predicate fact is missing from the record, say it is missing instead of inventing it.',
    'If no candidate fits, return an empty selectedSources array.',
    'Return this JSON shape:',
    JSON.stringify(
      {
        selectedSources: [
          {
            id: 'candidate source id',
            selectionRole:
              'core_landmark | narrowing_case | application_case | state_authority | remedy | background',
            reason: 'brief reason this verified source was selected'
          }
        ],
        selectionSummary: 'brief source-selection rationale',
        analysisBlueprint: {
          bottomLine: 'brief ruling-style bottom line using no more than two sentences',
          facts: ['neutral chronological facts from the record'],
          issues: [
            {
              title: 'issue title',
              recordAssessment: 'what the record does or does not show',
              analysis: 'how the verified law applies to this issue'
            }
          ],
          finalConclusion: 'short practical conclusion about the likely legal result'
        }
      },
      null,
      2
    )
  ].join('\n\n');
}
