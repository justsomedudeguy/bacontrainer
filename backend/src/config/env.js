import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PROVIDER_IDS, isProviderId } from '@bacontrainer/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.join(repoRoot, '.env') });

function normalizePort(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeProviderId(value) {
  return isProviderId(value) ? value : PROVIDER_IDS.OPENAI_COMPATIBLE;
}

export function createConfig(overrides = {}) {
  const source = { ...process.env, ...overrides };

  return {
    nodeEnv: source.NODE_ENV ?? 'development',
    port: normalizePort(source.PORT, 4000),
    frontendOrigin: source.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    appMode: source.APP_MODE ?? 'live',
    usageLogDirectory: source.USAGE_LOG_DIRECTORY ?? path.join(repoRoot, 'logs'),
    defaultProviderId: normalizeProviderId(source.DEFAULT_PROVIDER),
    courtlistener: {
      baseUrl: source.COURTLISTENER_BASE_URL ?? 'https://www.courtlistener.com',
      apiToken: source.COURTLISTENER_API_TOKEN ?? ''
    },
    providers: {
      [PROVIDER_IDS.OPENAI_COMPATIBLE]: {
        baseUrl: source.OPENAI_COMPATIBLE_BASE_URL ?? 'https://api.openai.com/v1',
        apiKey: source.OPENAI_COMPATIBLE_API_KEY ?? '',
        defaultModel: source.OPENAI_COMPATIBLE_MODEL ?? 'gpt-4.1-mini'
      },
      [PROVIDER_IDS.OLLAMA]: {
        baseUrl: source.OLLAMA_BASE_URL ?? 'http://localhost:11434',
        apiKey: '',
        defaultModel: source.OLLAMA_MODEL ?? 'llama3.2'
      },
      [PROVIDER_IDS.GEMINI]: {
        baseUrl:
          source.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com',
        apiKey: source.GEMINI_API_KEY ?? '',
        defaultModel: source.GEMINI_MODEL ?? 'gemini-1.5-flash'
      }
    }
  };
}

const env = createConfig();

export default env;
