import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeScenario } from './api.js';

function createJsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    }
  };
}

describe('frontend api', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts simulator analysis as a job and polls until it completes', async () => {
    fetch
      .mockResolvedValueOnce(
        createJsonResponse({
          jobId: 'analysis-job-1',
          status: 'queued',
          statusUrl: '/api/simulator/analyze-jobs/analysis-job-1'
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          jobId: 'analysis-job-1',
          status: 'running'
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          jobId: 'analysis-job-1',
          status: 'completed',
          result: {
            transcript: [
              {
                id: 'analysis-1',
                role: 'assistant',
                channel: 'analysis',
                content: "## Officer's position"
              }
            ]
          }
        })
      );

    const resultPromise = analyzeScenario(
      {
        scenarioId: 'traffic-stop-backpack-search'
      },
      {
        pollIntervalMs: 25,
        timeoutMs: 1000
      }
    );

    await vi.advanceTimersByTimeAsync(25);
    await vi.advanceTimersByTimeAsync(25);

    await expect(resultPromise).resolves.toEqual({
      transcript: [
        {
          id: 'analysis-1',
          role: 'assistant',
          channel: 'analysis',
          content: "## Officer's position"
        }
      ]
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/simulator/analyze-jobs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          scenarioId: 'traffic-stop-backpack-search'
        })
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/simulator/analyze-jobs/analysis-job-1',
      expect.objectContaining({
        method: 'GET'
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/simulator/analyze-jobs/analysis-job-1',
      expect.objectContaining({
        method: 'GET'
      })
    );
  });
});
