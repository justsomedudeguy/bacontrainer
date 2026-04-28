const JSON_HEADERS = {
  'Content-Type': 'application/json'
};
const DEFAULT_ANALYSIS_POLL_INTERVAL_MS = 2000;
const DEFAULT_ANALYSIS_TIMEOUT_MS = 10 * 60 * 1000;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: JSON_HEADERS,
    ...options
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json();
      errorMessage = payload.error || errorMessage;
    } catch {
      // Ignore JSON parse failures and fall back to the status code.
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export function fetchBootstrap() {
  return request('/api/bootstrap');
}

export function resetScenario(payload) {
  return request('/api/simulator/reset', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function submitTurn(payload) {
  return request('/api/simulator/turn', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

function startAnalysisJob(payload) {
  return request('/api/simulator/analyze-jobs', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function pollAnalysisJob(
  statusUrl,
  {
    pollIntervalMs = DEFAULT_ANALYSIS_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_ANALYSIS_TIMEOUT_MS
  } = {}
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const job = await request(statusUrl, {
      method: 'GET'
    });

    if (job.status === 'completed') {
      return job.result;
    }

    if (job.status === 'failed') {
      throw new Error(job.error?.message || 'Legal analysis failed.');
    }

    await wait(pollIntervalMs);
  }

  throw new Error('Legal analysis is still running. Try again in a moment.');
}

export async function analyzeScenario(payload, options) {
  const job = await startAnalysisJob(payload);
  const statusUrl =
    job.statusUrl ||
    (job.jobId ? `/api/simulator/analyze-jobs/${job.jobId}` : '');

  if (job.status === 'completed' && job.result) {
    return job.result;
  }

  if (job.status === 'failed') {
    throw new Error(job.error?.message || 'Legal analysis failed.');
  }

  if (!statusUrl) {
    throw new Error('Legal analysis did not return a job URL.');
  }

  return pollAnalysisJob(statusUrl, options);
}

export function inventScenario(payload) {
  return request('/api/simulator/invent-scenario', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function resetChat(payload) {
  return request('/api/chat/reset', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function submitChatTurn(payload) {
  return request('/api/chat/turn', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
