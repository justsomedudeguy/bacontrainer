import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createConfig } from '../config/env.js';

const vertexMocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  getGenerativeModel: vi.fn(),
  VertexAI: vi.fn()
}));

vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: vertexMocks.VertexAI
}));

const { geminiAdapter } = await import('./geminiAdapter.js');

describe('gemini adapter', () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vertexMocks.getGenerativeModel.mockReturnValue({
      generateContent: vertexMocks.generateContent
    });
    vertexMocks.VertexAI.mockReturnValue({
      getGenerativeModel: vertexMocks.getGenerativeModel
    });
  });

  it('uses Vertex AI when no Gemini API key is configured', async () => {
    vertexMocks.generateContent.mockResolvedValueOnce({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Vertex reply'
                }
              ]
            }
          }
        ]
      }
    });
    const config = createConfig({
      DEFAULT_PROVIDER: 'gemini',
      GEMINI_API_KEY: '',
      GEMINI_MODEL: 'gemini-2.5-flash-lite',
      GEMINI_VERTEX_PROJECT: 'test-project',
      GEMINI_VERTEX_LOCATION: 'us-east1'
    });
    const request = geminiAdapter.normalizeRequest(
      {
        purpose: 'scenario',
        scenario: {
          id: 'test-scenario',
          title: 'Test Scenario'
        },
        model: '',
        systemPrompt: 'Stay in role.',
        transcript: [
          {
            role: 'user',
            channel: 'scenario',
            content: 'I do not consent.'
          }
        ],
        providerConfig: {}
      },
      config
    );

    const result = await geminiAdapter.generateText(request, config);

    expect(vertexMocks.VertexAI).toHaveBeenCalledWith({
      project: 'test-project',
      location: 'us-east1'
    });
    expect(vertexMocks.getGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: {
        role: 'system',
        parts: [
          {
            text: 'Stay in role.'
          }
        ]
      }
    });
    expect(vertexMocks.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: '[scenario] I do not consent.'
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.65
        }
      })
    );
    expect(result.text).toBe('Vertex reply');
  });

  it('keeps Vertex AI as the server default when a server API key also exists', async () => {
    vertexMocks.generateContent.mockResolvedValueOnce({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Vertex default reply'
                }
              ]
            }
          }
        ]
      }
    });
    const config = createConfig({
      DEFAULT_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'server-api-key',
      GEMINI_MODEL: 'gemini-2.5-flash-lite',
      GEMINI_VERTEX_PROJECT: 'test-project',
      GEMINI_VERTEX_LOCATION: 'us-east1'
    });
    const request = geminiAdapter.normalizeRequest(
      {
        purpose: 'scenario',
        scenario: {
          id: 'test-scenario',
          title: 'Test Scenario'
        },
        model: '',
        systemPrompt: 'Stay in role.',
        transcript: [
          {
            role: 'user',
            channel: 'scenario',
            content: 'I do not consent.'
          }
        ],
        providerConfig: {}
      },
      config
    );

    const result = await geminiAdapter.generateText(request, config);

    expect(request.endpoint).toBe('vertex://us-east1/gemini-2.5-flash-lite');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vertexMocks.VertexAI).toHaveBeenCalledWith({
      project: 'test-project',
      location: 'us-east1'
    });
    expect(result.text).toBe('Vertex default reply');
  });

  it('uses a browser-entered Gemini API key as an override to the Vertex default', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      async text() {
        return JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Browser key reply'
                  }
                ]
              }
            }
          ]
        });
      }
    });
    const config = createConfig({
      DEFAULT_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'server-api-key',
      GEMINI_MODEL: 'gemini-2.5-flash-lite',
      GEMINI_VERTEX_PROJECT: 'test-project',
      GEMINI_VERTEX_LOCATION: 'us-east1'
    });
    const request = geminiAdapter.normalizeRequest(
      {
        purpose: 'scenario',
        scenario: {
          id: 'test-scenario',
          title: 'Test Scenario'
        },
        model: '',
        systemPrompt: 'Stay in role.',
        transcript: [
          {
            role: 'user',
            channel: 'scenario',
            content: 'I do not consent.'
          }
        ],
        providerConfig: {
          apiKey: 'browser-api-key'
        }
      },
      config
    );

    const result = await geminiAdapter.generateText(request, config);

    expect(request.endpoint).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'
    );
    expect(vertexMocks.VertexAI).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      request.endpoint,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-goog-api-key': 'browser-api-key'
        })
      })
    );
    expect(result.text).toBe('Browser key reply');
  });
});
