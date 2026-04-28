/**
 * @typedef {string} ScenarioId
 */

/**
 * @typedef {Object} ScenarioSummary
 * @property {ScenarioId} id
 * @property {string} title
 * @property {string} summary
 */

/**
 * @typedef {ScenarioSummary & {
 *   institutionalActor: string,
 *   seedPrompt: string,
 *   legalFocus: string[],
 *   analysisFocus: string[],
 *   scenarioFacts: string[],
 *   openingMessage: string
 * }} ScenarioDefinition
 */

export const SCENARIO_IDS = {
  TRAFFIC_STOP_BACKPACK_SEARCH: 'traffic-stop-backpack-search',
  KNOCK_AND_TALK_HOME_ENTRY: 'knock-and-talk-home-entry'
};

export const SCENARIO_SUMMARIES = [
  {
    id: SCENARIO_IDS.TRAFFIC_STOP_BACKPACK_SEARCH,
    title: 'Traffic Stop Backpack Search',
    summary:
      'Practice responding when an officer tries to search a backpack during a traffic stop.'
  },
  {
    id: SCENARIO_IDS.KNOCK_AND_TALK_HOME_ENTRY,
    title: 'Knock And Talk Home Entry',
    summary:
      'Practice responding when officers knock at your door and try to turn a conversation into consent to enter.'
  }
];

export function isScenarioId(value) {
  return Object.values(SCENARIO_IDS).includes(value);
}

export function getScenarioSummary(scenarioId) {
  return SCENARIO_SUMMARIES.find((scenario) => scenario.id === scenarioId) ?? null;
}
