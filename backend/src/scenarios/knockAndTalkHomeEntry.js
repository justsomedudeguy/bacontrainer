import { SCENARIO_IDS, getScenarioSummary } from '@bacontrainer/shared';

const summary = getScenarioSummary(SCENARIO_IDS.KNOCK_AND_TALK_HOME_ENTRY);

export const knockAndTalkHomeEntryScenario = {
  ...summary,
  institutionalActor: 'police officer',
  seedPrompt:
    'Police officers are at the learner\'s front door for a knock-and-talk and are trying to convert a doorstep conversation into consent to enter, inspect, or step past the threshold, including classic overreach moves like implying they can get a warrant anyway or suggesting cooperation is mandatory.',
  legalFocus: [
    'Fourth Amendment protections for the home and curtilage',
    'Consent to enter versus a warrant, exigent circumstances, or another claimed exception',
    'How officers may use social pressure, urgency, implied authority, or false inevitability',
    'The learner should focus on constitutional limits rather than trying to prove innocence or appear helpful'
  ],
  analysisFocus: [
    'whether entry is being requested as consent or asserted as legal authority',
    'whether the learner can keep the exchange brief and at the threshold',
    'what risks come from consenting to entry or making broad statements',
    'what facts could matter for a later suppression issue or civil-rights claim',
    'when Miranda is not the central issue because the immediate question is search or entry'
  ],
  scenarioFacts: [
    'Two officers knock on the learner\'s front door in the evening.',
    'They say they are following up on a neighborhood report and want to ask a few questions.',
    'They quickly pivot to asking to come inside and take a quick look around.',
    'They do not start by presenting a warrant.',
    'The officers may imply that refusing entry will only delay the inevitable or make the learner look suspicious.',
    'The encounter should feel like a realistic knock-and-talk rather than a legal lecture.'
  ],
  openingMessage: [
    'Two officers stand on the front step while the porch light spills across the doorway.',
    '"We are following up on a report from this block, and it would be easier if we talked inside for a minute."',
    '"Open up a little more and let us come in so we can clear this up quickly. If there is no problem in there, this should be simple."'
  ].join('\n\n')
};
