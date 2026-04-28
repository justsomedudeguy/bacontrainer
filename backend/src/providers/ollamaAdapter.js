import { PROVIDER_IDS } from '@bacontrainer/shared';
import {
  cleanOptionalString,
  normalizeOpenAIMessageContent,
  postJson
} from './requestUtils.js';

function toOllamaMessages(systemPrompt, transcript) {
  return [
    { role: 'system', content: systemPrompt },
    ...transcript
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: `[${message.channel}] ${message.content}`
      }))
  ];
}

function resolveTemperature(purpose) {
  return purpose === 'analysis' || purpose === 'legal-research' ? 0.35 : 0.65;
}

export const ollamaAdapter = {
  id: PROVIDER_IDS.OLLAMA,
  label: 'Ollama-Compatible',
  requiresApiKey: false,
  supportsCustomBaseUrl: true,
  getDefaultModel(config) {
    return config.providers[this.id].defaultModel;
  },
  getDefaultBaseUrl(config) {
    return config.providers[this.id].baseUrl;
  },
  getStatus(config) {
    const providerConfig = config.providers[this.id];
    return {
      configured: Boolean(providerConfig.baseUrl),
      summary: `Default base URL: ${providerConfig.baseUrl}`
    };
  },
  normalizeRequest(request, config) {
    const providerConfig = config.providers[this.id];
    const resolvedModel = request.model?.trim() || providerConfig.defaultModel;
    const runtimeConfig = {
      baseUrl:
        cleanOptionalString(request.providerConfig?.baseUrl) || providerConfig.baseUrl,
      apiKey:
        cleanOptionalString(request.providerConfig?.apiKey) || providerConfig.apiKey
    };

    return {
      providerId: this.id,
      purpose: request.purpose,
      model: resolvedModel,
      endpoint: `${runtimeConfig.baseUrl.replace(/\/$/, '')}/api/chat`,
      systemPrompt: request.systemPrompt,
      messages: toOllamaMessages(request.systemPrompt, request.transcript),
      runtimeConfig,
      context: {
        scenarioId: request.scenario.id,
        scenarioTitle: request.scenario.title,
        local: true
      }
    };
  },
  async generateText(request) {
    const headers = {};

    if (request.runtimeConfig?.apiKey) {
      headers.Authorization = `Bearer ${request.runtimeConfig.apiKey}`;
    }

    const payload = await postJson(request.endpoint, {
      providerLabel: this.label,
      headers,
      body: {
        model: request.model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: resolveTemperature(request.purpose)
        }
      }
    });

    const text = normalizeOpenAIMessageContent(payload?.message?.content);

    return {
      text,
      raw: payload
    };
  }
};
