import { HttpError } from '../utils/httpError.js';

function cleanOptionalString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
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

function extractErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  if (typeof payload.detail === 'string') {
    return payload.detail;
  }

  if (typeof payload.error === 'string') {
    return payload.error;
  }

  if (payload.error && typeof payload.error.message === 'string') {
    return payload.error.message;
  }

  if (typeof payload.rawText === 'string') {
    return payload.rawText.trim();
  }

  return '';
}

export class CourtListenerClient {
  constructor({ baseUrl, apiToken } = {}) {
    this.baseUrl = cleanOptionalString(baseUrl) || 'https://www.courtlistener.com';
    this.apiToken = cleanOptionalString(apiToken);
  }

  async search({ query, type, semantic = false, highlight = true, apiToken } = {}) {
    const endpoint = new URL('/api/rest/v4/search/', this.baseUrl);

    endpoint.searchParams.set('q', query ?? '');

    if (type) {
      endpoint.searchParams.set('type', type);
    }

    if (highlight) {
      endpoint.searchParams.set('highlight', 'on');
    }

    if (semantic) {
      endpoint.searchParams.set('semantic', 'true');
    }

    const resolvedToken = cleanOptionalString(apiToken) || this.apiToken;
    const headers = {
      Accept: 'application/json'
    };

    if (resolvedToken) {
      headers.Authorization = `Token ${resolvedToken}`;
    }

    let response;

    try {
      response = await fetch(endpoint, {
        method: 'GET',
        headers
      });
    } catch {
      throw new HttpError(502, 'Unable to reach CourtListener.', {
        upstreamStatus: 502
      });
    }

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      throw new HttpError(
        502,
        extractErrorMessage(payload) || `CourtListener returned status ${response.status}.`,
        {
          upstreamStatus: response.status
        }
      );
    }

    return payload;
  }
}
