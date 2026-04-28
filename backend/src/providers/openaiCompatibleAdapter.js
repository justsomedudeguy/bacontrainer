import { PROVIDER_IDS } from '@bacontrainer/shared';
import {
  cleanOptionalString,
  normalizeOpenAIMessageContent,
  postJson
} from './requestUtils.js';

function toOpenAIStyleMessages(systemPrompt, transcript) {
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

export const openaiCompatibleAdapter = {
  id: PROVIDER_IDS.OPENAI_COMPATIBLE,
  label: 'OpenAI-Compatible',
  requiresApiKey: true,
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
      configured: Boolean(providerConfig.apiKey),
      summary: `Default base URL: ${providerConfig.baseUrl}`
    };
  },
  normalizeRequest(request, config) {
    const providerConfig = config.providers[this.id];
    const browserApiKey = cleanOptionalString(request.providerConfig?.apiKey);
    const useBrowserRuntime = Boolean(browserApiKey);
    const resolvedModel = useBrowserRuntime
      ? request.model?.trim() || providerConfig.defaultModel
      : providerConfig.defaultModel;
    const runtimeConfig = {
      baseUrl: useBrowserRuntime
        ? cleanOptionalString(request.providerConfig?.baseUrl) || providerConfig.baseUrl
        : providerConfig.baseUrl,
      apiKey: browserApiKey || providerConfig.apiKey
    };

    return {
      providerId: this.id,
      purpose: request.purpose,
      model: resolvedModel,
      endpoint: `${runtimeConfig.baseUrl.replace(/\/$/, '')}/chat/completions`,
      systemPrompt: request.systemPrompt,
      messages: toOpenAIStyleMessages(request.systemPrompt, request.transcript),
      runtimeConfig,
      context: {
        scenarioId: request.scenario.id,
        scenarioTitle: request.scenario.title
      }
    };
  },
  async generateText(request) {
    const payload = await postJson(request.endpoint, {
      providerLabel: this.label,
      headers: {
        Authorization: `Bearer ${request.runtimeConfig?.apiKey || ''}`
      },
      body: {
        model: request.model,
        messages: request.messages,
        temperature: resolveTemperature(request.purpose)
      }
    });

    const text = normalizeOpenAIMessageContent(payload?.choices?.[0]?.message?.content);

    return {
      text,
      raw: payload
    };
  }
};
