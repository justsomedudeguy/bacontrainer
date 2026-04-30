import { VertexAI } from '@google-cloud/vertexai';
import { PROVIDER_IDS } from '@bacontrainer/shared';
import {
  cleanOptionalString,
  joinContentParts
} from './requestUtils.js';
import { HttpError } from '../utils/httpError.js';

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_GEMINI_API_VERSION = 'v1beta';

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

function toGeminiSystemInstruction(systemPrompt) {
  const text = cleanOptionalString(systemPrompt);

  return text
    ? {
        role: 'system',
        parts: [
          {
            text
          }
        ]
      }
    : undefined;
}

function buildGeminiApiUrl(baseUrl, modelName) {
  const normalizedBaseUrl = (cleanOptionalString(baseUrl) || DEFAULT_GEMINI_BASE_URL)
    .replace(/\/+$/, '');
  const apiRoot = /\/v\d+(?:beta\d*)?$/i.test(normalizedBaseUrl)
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/${DEFAULT_GEMINI_API_VERSION}`;
  const modelPath = modelName.startsWith('models/') ? modelName : `models/${modelName}`;

  return `${apiRoot}/${modelPath}:generateContent`;
}

function extractGeminiText(response) {
  const text = response?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!text) {
    throw new HttpError(502, 'Gemini Error: The Gemini response did not include text.');
  }

  return text;
}

async function readJsonResponse(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return {
      rawText
    };
  }
}

async function generateWithApiKey(request) {
  const response = await fetch(request.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': request.runtimeConfig.apiKey
    },
    body: JSON.stringify({
      contents: request.messages,
      ...(request.context.systemInstruction
        ? { systemInstruction: request.context.systemInstruction }
        : {}),
      generationConfig: {
        temperature: resolveTemperature(request.purpose)
      }
    })
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new HttpError(
      424,
      `Gemini Error: ${
        payload.error?.message ||
        payload.message ||
        payload.rawText ||
        `Gemini API request failed with status ${response.status}`
      }`
    );
  }

  return {
    text: extractGeminiText(payload),
    raw: payload
  };
}

async function generateWithVertex(request) {
  const { vertexProject, vertexLocation } = request.runtimeConfig;

  if (!vertexProject) {
    throw new HttpError(
      400,
      'Gemini Error: Set GEMINI_VERTEX_PROJECT or GOOGLE_CLOUD_PROJECT for Vertex AI.'
    );
  }

  const vertexAI = new VertexAI({
    project: vertexProject,
    location: vertexLocation
  });
  const model = vertexAI.getGenerativeModel({
    model: request.model,
    ...(request.context.systemInstruction
      ? { systemInstruction: request.context.systemInstruction }
      : {})
  });
  const result = await model.generateContent({
    contents: request.messages,
    generationConfig: {
      temperature: resolveTemperature(request.purpose)
    }
  });
  const response = await result.response;

  return {
    text: extractGeminiText(response),
    raw: response
  };
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
    const usesApiKey = Boolean(providerConfig.apiKey);
    const usesVertex = Boolean(providerConfig.vertexProject);

    return {
      configured: usesApiKey || usesVertex,
      summary: usesVertex
        ? `Vertex AI project: ${providerConfig.vertexProject}. Location: ${providerConfig.vertexLocation}. Default model: ${providerConfig.defaultModel}`
        : usesApiKey
          ? `Gemini API key configured. Default model: ${providerConfig.defaultModel}`
          : `Vertex AI project not set. Default model: ${providerConfig.defaultModel}`
    };
  },
  normalizeRequest(request, config) {
    const providerConfig = config.providers[this.id];
    const resolvedModel = request.model?.trim() || providerConfig.defaultModel;
    const browserApiKey = cleanOptionalString(request.providerConfig?.apiKey);
    const usesVertexDefault = !browserApiKey && Boolean(providerConfig.vertexProject);
    const apiKey = usesVertexDefault ? '' : browserApiKey || providerConfig.apiKey;
    const systemInstruction = toGeminiSystemInstruction(request.systemPrompt);
    const runtimeConfig = {
      baseUrl: providerConfig.baseUrl,
      apiKey,
      vertexProject: providerConfig.vertexProject,
      vertexLocation: providerConfig.vertexLocation
    };

    return {
      providerId: this.id,
      purpose: request.purpose,
      model: resolvedModel,
      endpoint: apiKey
        ? buildGeminiApiUrl(providerConfig.baseUrl, resolvedModel)
        : `vertex://${runtimeConfig.vertexLocation}/${resolvedModel}`,
      systemPrompt: request.systemPrompt,
      messages: toGeminiMessages(request.transcript, request.purpose),
      runtimeConfig,
      context: {
        scenarioId: request.scenario.id,
        scenarioTitle: request.scenario.title,
        systemInstruction
      }
    };
  },
  async generateText(request, config) {
    try {
      if (request.runtimeConfig?.apiKey) {
        return await generateWithApiKey(request);
      }

      return await generateWithVertex(request);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(error.statusCode || 500, `Gemini Error: ${error.message}`);
    }
  }
};
