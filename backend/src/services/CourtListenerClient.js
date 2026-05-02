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

  async search({ query, type, semantic = false, highlight = true, orderBy, apiToken } = {}) {
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

    if (orderBy) {
      endpoint.searchParams.set('order_by', orderBy);
    }

    return this.#requestJson(endpoint, {
      method: 'GET',
      apiToken
    });
  }

  async getCluster({ clusterId, apiToken } = {}) {
    const cleanedClusterId = cleanOptionalString(String(clusterId ?? ''));
    const endpoint = new URL(
      `/api/rest/v4/clusters/${encodeURIComponent(cleanedClusterId)}/`,
      this.baseUrl
    );

    return this.#requestJson(endpoint, {
      method: 'GET',
      apiToken
    });
  }

  async getApiResource({ resourceUrl, apiToken } = {}) {
    const cleanedResourceUrl = cleanOptionalString(resourceUrl);
    const endpoint = new URL(cleanedResourceUrl, this.baseUrl);

    return this.#requestJson(endpoint, {
      method: 'GET',
      apiToken
    });
  }

  async lookupCitations({ text, apiToken } = {}) {
    const endpoint = new URL('/api/rest/v4/citation-lookup/', this.baseUrl);
    const body = new URLSearchParams();

    body.set('text', text ?? '');

    return this.#requestJson(endpoint, {
      method: 'POST',
      apiToken,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
  }

  async #requestJson(endpoint, { method, apiToken, headers = {}, body } = {}) {
    const resolvedToken = cleanOptionalString(apiToken) || this.apiToken;
    const requestHeaders = {
      Accept: 'application/json',
      ...headers
    };

    if (resolvedToken) {
      requestHeaders.Authorization = `Token ${resolvedToken}`;
    }

    let response;

    try {
      response = await fetch(endpoint, {
        method,
        headers: requestHeaders,
        ...(typeof body === 'string' ? { body } : {})
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
