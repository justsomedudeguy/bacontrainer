import { HttpError } from '../utils/httpError.js';

export function cleanOptionalString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

export function joinContentParts(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

function extractErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  if (typeof payload.error === 'string') {
    return payload.error;
  }

  if (payload.error && typeof payload.error.message === 'string') {
    return payload.error.message;
  }

  if (typeof payload.message === 'string') {
    return payload.message;
  }

  if (
    Array.isArray(payload.candidates) &&
    payload.candidates[0]?.finishReason &&
    payload.candidates[0].finishReason !== 'STOP'
  ) {
    return `Generation stopped with reason ${payload.candidates[0].finishReason}.`;
  }

  return '';
}

async function parseResponsePayload(response) {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return {
      rawText
    };
  }
}

export async function postJson(endpoint, { providerLabel, headers = {}, body }) {
  let response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new HttpError(
      424,
      `Unable to reach ${providerLabel}. Check the provider settings and try again.`
    );
  }

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw new HttpError(
      424,
      extractErrorMessage(payload) ||
        `${providerLabel} returned status ${response.status}.`
    );
  }

  return payload;
}

export function normalizeOpenAIMessageContent(content) {
  const text = joinContentParts(content);

  if (!text) {
    throw new HttpError(424, 'The model returned an empty response.');
  }

  return text;
}
