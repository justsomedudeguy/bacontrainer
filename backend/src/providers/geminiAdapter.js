import { VertexAI } from '@google-cloud/vertexai';
import GoogleGenerativeAIModule from '@google-ai/generativelanguage';
const { GoogleGenerativeAI } = GoogleGenerativeAIModule;
import { PROVIDER_IDS } from '@bacontrainer/shared';
import {
  cleanOptionalString,
  joinContentParts
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
  requiresApiKey: false,
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
      configured: true,
      summary: `Default model: ${providerConfig.defaultModel}`
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
      endpoint: resolvedModel, // For SDK, we use model name
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
  async generateText(request, config) {
    const apiKey = request.runtimeConfig?.apiKey;
    const modelName = request.model;

    try {
      if (apiKey) {
        // CASE A: User provided their own key (AI Studio path)
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: request.systemPrompt
        });

        const result = await model.generateContent({
          contents: request.messages,
          generationConfig: {
            temperature: resolveTemperature(request.purpose)
          }
        });

        const text = result.response.text();
        return { text, raw: result.response };
      } else {
        // CASE B: User left key blank (Vertex AI path - Uses GCP Credits)
        const vertexAI = new VertexAI({
          project: 'orbital-lantern-348309',
          location: 'us-central1'
        });
        const model = vertexAI.getGenerativeModel({
          model: modelName,
          systemInstruction: request.systemPrompt
        });

        const result = await model.generateContent({
          contents: request.messages,
          generationConfig: {
            temperature: resolveTemperature(request.purpose)
          }
        });

        const response = await result.response;
        const text = response.candidates[0].content.parts[0].text;
        return { text, raw: response };
      }
    } catch (error) {
      throw new HttpError(error.statusCode || 500, `Gemini Error: ${error.message}`);
    }
  }
};
