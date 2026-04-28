import { SCENARIO_IDS, getScenarioSummary } from '@bacontrainer/shared';

const summary = getScenarioSummary(SCENARIO_IDS.TRAFFIC_STOP_BACKPACK_SEARCH);

export const trafficStopBackpackSearchScenario = {
  ...summary,
  institutionalActor: 'police officer',
  seedPrompt:
    'A police officer has already handled the ordinary traffic-stop basics and is now trying to turn the stop into a consent search of a backpack, with room for classic overreach around prolonging the stop, implying suspicion, and blurring the line between a request and a command.',
  legalFocus: [
    'Fourth Amendment limits on warrantless searches during traffic stops',
    'Consent searches, prolonged stops, and the difference between refusing consent and physically interfering',
    'The officer may invoke nervousness, odor, officer safety, probable cause, or vehicle-search doctrines',
    'The learner should focus on constitutional principles rather than innocence or reassuring the officer'
  ],
  analysisFocus: [
    'whether the officer is asking for consent or claiming legal authority',
    'how to refuse consent clearly without escalating physically',
    'what facts the officer is relying on for suspicion, prolongation, or probable cause',
    'what details would matter if the legality of the search were later challenged',
    'when Miranda is irrelevant because this is not necessarily custodial interrogation'
  ],
  scenarioFacts: [
    'The learner has been pulled over for a minor traffic issue at night.',
    'A backpack is sitting in plain view on the passenger seat.',
    'The officer says the backpack looks suspicious and wants to look inside.',
    'The officer has not started with a warrant and has not clearly articulated probable cause.',
    'The officer may pivot between casual consent language and more authoritative commands in the style of a classic classroom hypothetical.',
    'The encounter should stay grounded in realistic roadside police dialogue rather than turning into a lecture.'
  ],
  openingMessage: [
    'Red-and-blue lights still flicker across the windshield while the officer stands beside the half-open driver window.',
    '"Ok, well, let\'s take a look inside that suspicious-looking backpack on the passenger seat."',
    '"If there is nothing in there, this will be quick. Go ahead and hand it to me, and do not make this harder than it needs to be."'
  ].join('\n\n')
};
