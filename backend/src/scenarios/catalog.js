import { SCENARIO_SUMMARIES } from '@bacontrainer/shared';
import { HttpError } from '../utils/httpError.js';
import { knockAndTalkHomeEntryScenario } from './knockAndTalkHomeEntry.js';
import { trafficStopBackpackSearchScenario } from './trafficStopBackpackSearch.js';

const scenarioCatalog = [
  trafficStopBackpackSearchScenario,
  knockAndTalkHomeEntryScenario
];

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${fieldName} must be an array of strings.`);
  }

  const normalized = value
    .map((entry) => cleanString(entry))
    .filter(Boolean)
    .slice(0, 8);

  if (normalized.length === 0) {
    throw new HttpError(400, `${fieldName} must include at least one item.`);
  }

  return normalized;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function getScenarios() {
  return scenarioCatalog;
}

export function getScenarioById(scenarioId) {
  return scenarioCatalog.find((scenario) => scenario.id === scenarioId) ?? null;
}

export function getScenarioSummaries() {
  return SCENARIO_SUMMARIES;
}

export function getDefaultScenario() {
  return scenarioCatalog[0];
}

export function toScenarioSummary(scenario) {
  return {
    id: scenario.id,
    title: scenario.title,
    summary: scenario.summary
  };
}

export function normalizeScenarioDefinition(candidate, { generated = false } = {}) {
  if (!candidate || typeof candidate !== 'object') {
    throw new HttpError(400, 'Scenario details are required.');
  }

  const title = cleanString(candidate.title);
  const summary = cleanString(candidate.summary);
  const seedPrompt = cleanString(candidate.seedPrompt);
  const institutionalActor =
    cleanString(candidate.institutionalActor) || 'police officer';
  const openingMessage = cleanString(candidate.openingMessage);

  if (!title || !summary || !seedPrompt || !openingMessage) {
    throw new HttpError(
      400,
      'Scenario details must include title, summary, seedPrompt, and openingMessage.'
    );
  }

  const baseId =
    cleanString(candidate.id) ||
    `${generated ? 'generated-' : ''}${slugify(title) || 'scenario'}`;
  const id = generated && !baseId.startsWith('generated-')
    ? `generated-${baseId}`
    : baseId;

  return {
    id,
    title,
    summary,
    institutionalActor,
    seedPrompt,
    legalFocus: cleanStringArray(candidate.legalFocus, 'legalFocus'),
    analysisFocus: cleanStringArray(candidate.analysisFocus, 'analysisFocus'),
    scenarioFacts: cleanStringArray(candidate.scenarioFacts, 'scenarioFacts'),
    openingMessage
  };
}
