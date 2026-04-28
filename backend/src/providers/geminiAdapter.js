import { PROVIDER_IDS } from '@bacontrainer/shared';
import {
  cleanOptionalString,
  joinContentParts,
  postJson
} from './requestUtils.js';
import { HttpError } from '../utils/httpError.js';

function toGeminiMessages(transcript, purpose) {
  if (purpose === 'analysis') {
    const transcriptText = transcript
      .filter((message) => message.role !== 'system')
      .map((message) => `[${message.channel}] ${message.content}`)
      .join('\n');

    return [
      {
        role: 'user',
        parts: [
          {
            text: [
              transcriptText,
              'Provide the requested legal analysis for this simulator transcript.'
            ]
              .filter(Boolean)
              .join('\n\n')
          }
        ]
      }
    ];
  }

  return transcript
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text: `[${message.channel}] ${message.content}`
        }
      ]
    }));
}

function resolveTemperature(purpose) {
  return purpose === 'analysis' || purpose === 'legal-research' ? 0.35 : 0.65;
}

export const geminiAdapter = {
  id: PROVIDER_IDS.GEMINI,
  label: 'Gemini',
  requiresApiKey: true,
  supportsCustomBaseUrl: false,
  getDefaultModel(config) {
    return config.providers[this.id].defaultModel;
  },
  getDefaultBaseUrl(config) {
    return config.providers[this.id].baseUrl;
  },
  getStatus(config) {
    const providerConfig = config.providers[this.id];
    return {
      configured: Boolean(providerConfig.apiKey),
      summary: `Default base URL: ${providerConfig.baseUrl}`
    };
  },
  normalizeRequest(request, config) {
    const providerConfig = config.providers[this.id];
    const resolvedModel = request.model?.trim() || providerConfig.defaultModel;
    const runtimeConfig = {
      baseUrl: providerConfig.baseUrl,
      apiKey:
        cleanOptionalString(request.providerConfig?.apiKey) || providerConfig.apiKey
    };

    return {
      providerId: this.id,
      purpose: request.purpose,
      model: resolvedModel,
      endpoint: `${runtimeConfig.baseUrl.replace(/\/$/, '')}/v1beta/models/${resolvedModel}:generateContent`,
      systemPrompt: request.systemPrompt,
      messages: toGeminiMessages(request.transcript, request.purpose),
      runtimeConfig,
      context: {
        scenarioId: request.scenario.id,
        scenarioTitle: request.scenario.title,
        systemInstruction: request.systemPrompt
      }
    };
  },
  async generateText(request) {
    const payload = await postJson(request.endpoint, {
      providerLabel: this.label,
      headers: {
        'x-goog-api-key': request.runtimeConfig?.apiKey || ''
      },
      body: {
        systemInstruction: {
          parts: [
            {
              text: request.systemPrompt
            }
          ]
        },
        contents: request.messages,
        generationConfig: {
          temperature: resolveTemperature(request.purpose)
        }
      }
    });

    const text = joinContentParts(payload?.candidates?.[0]?.content?.parts);

    if (!text) {
      throw new HttpError(502, 'Gemini returned an empty response.');
    }

    return {
      text,
      raw: payload
    };
  }
};
