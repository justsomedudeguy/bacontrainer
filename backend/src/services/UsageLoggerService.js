import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const SECRET_KEY_PATTERN = /(?:api[-_]?key|api[-_]?token|authorization|password|secret|token)/i;

function toDateStamp(date) {
  return date.toISOString().slice(0, 10);
}

function redactSecrets(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? '[redacted]' : redactSecrets(item)
    ])
  );
}

export class UsageLoggerService {
  constructor({ logDirectory = 'logs', enabled = true } = {}) {
    this.logDirectory = logDirectory;
    this.enabled = enabled;
  }

  log(event = {}) {
    if (!this.enabled) {
      return;
    }

    const timestamp = new Date();
    const record = {
      id: randomUUID(),
      timestamp: timestamp.toISOString(),
      type: event.type || 'usage_event',
      payload: redactSecrets(event.payload || {})
    };
    const filePath = path.join(
      this.logDirectory,
      `usage-${toDateStamp(timestamp)}.jsonl`
    );

    try {
      fs.mkdirSync(this.logDirectory, { recursive: true });
      fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
    } catch (error) {
      console.warn(`Unable to write usage log: ${error.message}`);
    }
  }
}
