import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@bacontrainer/shared';
import { createConfig } from './env.js';

describe('environment config', () => {
  it('defaults Gemini to the lowest-cost Vertex-supported Flash model', () => {
    const config = createConfig({
      GEMINI_MODEL: undefined
    });

    expect(config.providers[PROVIDER_IDS.GEMINI].defaultModel).toBe(
      'gemini-2.5-flash-lite'
    );
  });
});
