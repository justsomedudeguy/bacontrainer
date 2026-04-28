import { randomUUID } from 'node:crypto';

const DEFAULT_RETENTION_MS = 60 * 60 * 1000;

function serializeError(error) {
  return {
    message: error?.message || 'Unexpected analysis error.',
    ...(Number.isInteger(error?.statusCode) ? { statusCode: error.statusCode } : {})
  };
}

export class AnalysisJobService {
  constructor({ retentionMs = DEFAULT_RETENTION_MS } = {}) {
    this.retentionMs = retentionMs;
    this.jobs = new Map();
  }

  createJob(task) {
    this.#cleanup();

    const now = new Date().toISOString();
    const job = {
      id: randomUUID(),
      status: 'queued',
      createdAt: now,
      updatedAt: now
    };

    this.jobs.set(job.id, job);

    Promise.resolve().then(async () => {
      this.#updateJob(job.id, {
        status: 'running'
      });

      try {
        const result = await task();

        this.#updateJob(job.id, {
          status: 'completed',
          result
        });
      } catch (error) {
        this.#updateJob(job.id, {
          status: 'failed',
          error: serializeError(error)
        });
      }
    });

    return this.#presentJob(job);
  }

  getJob(id) {
    this.#cleanup();

    const job = this.jobs.get(id);

    return job ? this.#presentJob(job) : null;
  }

  #updateJob(id, patch) {
    const job = this.jobs.get(id);

    if (!job) {
      return;
    }

    Object.assign(job, patch, {
      updatedAt: new Date().toISOString()
    });
  }

  #cleanup() {
    const cutoff = Date.now() - this.retentionMs;

    for (const [id, job] of this.jobs.entries()) {
      if (Date.parse(job.updatedAt) < cutoff) {
        this.jobs.delete(id);
      }
    }
  }

  #presentJob(job) {
    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      ...(job.result ? { result: job.result } : {}),
      ...(job.error ? { error: job.error } : {})
    };
  }
}
