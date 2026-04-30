import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { createConfig } from './config/env.js';

function createFetchResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(payload);
    }
  };
}

describe('backend app', () => {
  let app;
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    app = createApp({
      config: createConfig({
        APP_MODE: 'live',
        DEFAULT_PROVIDER: 'openai-compatible',
        OPENAI_COMPATIBLE_API_KEY: '',
        GEMINI_API_KEY: '',
        COURTLISTENER_API_TOKEN: 'server-courtlistener-token'
      })
    });
  });

  it('returns health status', async () => {
    const response = await request(app).get('/api/health');

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.appMode).toBe('live');
  });

  it('returns bootstrap data with provider defaults and courtlistener status', async () => {
    const response = await request(app).get('/api/bootstrap');

    expect(response.statusCode).toBe(200);
    expect(response.body.defaultScenarioId).toBe('traffic-stop-backpack-search');
    expect(response.body.providers).toHaveLength(3);
    expect(response.body.providerStatus['ollama'].defaultModel).toBeTruthy();
    expect(response.body.providerStatus['openai-compatible'].defaultBaseUrl).toBeTruthy();
    expect(response.body.courtlistenerStatus.configured).toBe(true);
    expect(response.body.courtlistenerStatus.supportsBrowserToken).toBe(true);
  });

  it('returns opening transcript for simulator reset', async () => {
    const response = await request(app)
      .post('/api/simulator/reset')
      .send({
        scenarioId: 'knock-and-talk-home-entry',
        providerId: 'gemini',
        model: 'gemini-2.5-flash'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.scenarioId).toBe('knock-and-talk-home-entry');
    expect(response.body.transcript).toHaveLength(2);
    expect(response.body.transcript[1].channel).toBe('scenario');
    expect(response.body.transcript[1].content).toContain('come in');
  });

  it('returns opening transcript for legal research reset', async () => {
    const response = await request(app)
      .post('/api/chat/reset')
      .send({
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.providerId).toBe('openai-compatible');
    expect(response.body.transcript).toHaveLength(2);
    expect(response.body.transcript[1].channel).toBe('chat');
    expect(response.body.transcript[1].content).toContain('Ask any legal question');
  });

  it('requires an API key for providers that need one', async () => {
    const response = await request(app)
      .post('/api/simulator/turn')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        transcript: [],
        userInput: 'I do not consent to a search.'
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toContain('API key');
  });

  it('can invent a new scenario on the fly', async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                id: 'generated-bus-sweep-consent',
                title: 'Bus Sweep Consent Search',
                summary: 'Practice responding when officers ask to search your bag during a bus sweep.',
                institutionalActor: 'police officer',
                seedPrompt:
                  'An officer boards a bus and pressures the learner to consent to a bag search in a cramped, intimidating setting.',
                legalFocus: [
                  'consent under pressure',
                  'whether a reasonable person would feel free to refuse'
                ],
                analysisFocus: [
                  'what makes consent less than voluntary',
                  'what facts would matter later'
                ],
                scenarioFacts: [
                  'The learner is seated on a bus.',
                  'An officer asks to inspect a bag without a warrant.'
                ],
                openingMessage:
                  '"We are doing quick checks. Hand me the bag so I can take a look inside."'
              })
            }
          }
        ]
      })
    );

    const response = await request(app)
      .post('/api/simulator/invent-scenario')
      .send({
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'test-key'
        },
        promptIdea: 'bus sweep consent search'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.scenario.id).toBe('generated-bus-sweep-consent');
    expect(response.body.scenarioSummary.title).toBe('Bus Sweep Consent Search');
  });

  it('advances simulator roleplay without generating analysis', async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        choices: [
          {
            message: {
              content:
                'The officer keeps one hand near the flashlight. "I am asking for the bag. Are you refusing consent?"'
            }
          }
        ]
      })
    );

    const response = await request(app)
      .post('/api/simulator/turn')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'test-key'
        },
        transcript: [
          {
            id: 'analysis-previous',
            role: 'assistant',
            channel: 'analysis',
            content: 'Older analysis should not be sent back into roleplay.'
          },
          {
            id: 'scenario-previous',
            role: 'assistant',
            channel: 'scenario',
            content: 'The officer first asks to see the backpack.'
          }
        ],
        userInput: 'I do not consent to a search. What is your probable cause?'
      });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.body.transcript.at(-2).role).toBe('user');
    expect(response.body.transcript.at(-1).channel).toBe('scenario');
    expect(response.body.transcript.some((message) => message.channel === 'analysis')).toBe(true);

    const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(
      firstCallBody.messages.some((message) =>
        String(message.content).includes('[analysis]')
      )
    ).toBe(false);
    expect(
      firstCallBody.messages.some((message) =>
        String(message.content).includes('The officer first asks to see the backpack.')
      )
    ).toBe(true);
  });

  it('emits usage log events for simulator turns without leaking API keys', async () => {
    const usageLogger = {
      log: vi.fn()
    };

    app = createApp({
      config: createConfig({
        APP_MODE: 'live',
        DEFAULT_PROVIDER: 'openai-compatible'
      }),
      usageLogger
    });
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        choices: [
          {
            message: {
              content: '"I hear you refusing consent. I am going to ask why you are nervous."'
            }
          }
        ]
      })
    );

    const response = await request(app)
      .post('/api/simulator/turn')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'super-secret-test-key'
        },
        transcript: [],
        userInput: 'I do not consent to a search.'
      });

    expect(response.statusCode).toBe(200);

    const loggedEvents = usageLogger.log.mock.calls.map(([event]) => event);

    expect(loggedEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(['user_query', 'inference_call', 'police_response'])
    );
    expect(
      loggedEvents.some((event) => event.payload?.text === 'I do not consent to a search.')
    ).toBe(true);
    expect(
      loggedEvents.some((event) => event.payload?.providerId === 'openai-compatible')
    ).toBe(true);
    expect(
      loggedEvents.some((event) => String(event.payload?.text || '').includes('refusing consent'))
    ).toBe(true);
    expect(JSON.stringify(loggedEvents)).not.toContain('super-secret-test-key');
  });

  it('cleans echoed transcript labels from simulator roleplay replies', async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        choices: [
          {
            message: {
              content:
                '[scenario] Look, I understand you want to leave, but I am asking whether you consent to the search.'
            }
          }
        ]
      })
    );

    const response = await request(app)
      .post('/api/simulator/turn')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'test-key'
        },
        transcript: [
          {
            id: 'scenario-previous',
            role: 'assistant',
            channel: 'scenario',
            content: 'Mind if I take a quick look in your car?'
          }
        ],
        userInput: 'I do not consent.'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.transcript.at(-1).content).toBe(
      'Look, I understand you want to leave, but I am asking whether you consent to the search.'
    );
  });

  it('grounds simulator legal analysis in CourtListener and frames both sides from the transcript', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: [
            {
              absolute_url: '/opinion/1/terry-v-ohio/',
              caseName: 'Terry v. Ohio',
              caseNameFull: 'Terry v. Ohio',
              citation: ['392 U.S. 1'],
              cluster_id: 1,
              court: 'Supreme Court of the United States',
              dateFiled: '1968-06-10',
              docketNumber: '67',
              opinions: [
                {
                  id: 1,
                  download_url: 'https://example.com/terry.pdf',
                  snippet: 'Reasonable suspicion can justify a brief investigatory stop.'
                }
              ]
            },
            {
              absolute_url: '/opinion/2/california-v-acevedo/',
              caseName: 'California v. Acevedo',
              caseNameFull: 'California v. Acevedo',
              citation: ['500 U.S. 565'],
              cluster_id: 2,
              court: 'Supreme Court of the United States',
              dateFiled: '1991-05-30',
              docketNumber: '89-1690',
              opinions: [
                {
                  id: 2,
                  download_url: 'https://example.com/acevedo.pdf',
                  snippet: 'The automobile exception permits a warrantless search of a vehicle container when probable cause supports it.'
                }
              ]
            },
            {
              absolute_url: '/opinion/3/rodriguez-v-united-states/',
              caseName: 'Rodriguez v. United States',
              caseNameFull: 'Rodriguez v. United States',
              citation: ['575 U.S. 348'],
              cluster_id: 3,
              court: 'Supreme Court of the United States',
              dateFiled: '2015-04-21',
              docketNumber: '13-9972',
              opinions: [
                {
                  id: 3,
                  download_url: 'https://example.com/rodriguez.pdf',
                  snippet: 'A traffic stop may not be prolonged beyond its mission without independent reasonable suspicion.'
                }
              ]
            }
          ]
        });
      }

      return createFetchResponse({
        choices: [
          {
            message: {
              content: [
                {
                  type: 'text',
                  text: [
                    "## Officer's position",
                    'The officer can argue officer safety and reasonable suspicion under **Terry v. Ohio** based on the transcript statements about fidgeting and the location.',
                    '',
                    "## User's position",
                    'The user can argue those facts do not create probable cause for a backpack search and can refuse consent.',
                    '',
                    '## How the cited cases apply',
                    '- **Supports the user:** Terry requires articulable suspicion, not just a hunch.',
                    '- **Supports the officer if facts change:** Acevedo would matter if probable cause developed for the vehicle or container.',
                    '',
                    '## Authorities',
                    '- **Terry v. Ohio**, 392 U.S. 1: brief investigative detention requires reasonable suspicion.',
                    '- **California v. Acevedo**, 500 U.S. 565: automobile searches require probable cause for the place searched.',
                    '',
                    '## Notes',
                    'No K9 unit appears in this transcript, so K9-delay analysis is not applied.'
                  ].join('\n')
                }
              ]
            }
          }
        ]
      });
    });

    const response = await request(app)
      .post('/api/simulator/analyze')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'test-key'
        },
        transcript: [
          {
            id: 'scenario-previous',
            role: 'assistant',
            channel: 'scenario',
            content:
              'You seemed fidgety and this area has had thefts, so I want to ask a few more questions.'
          },
          {
            id: 'user-previous',
            role: 'user',
            channel: 'scenario',
            content:
              'Me being fidgety and driving through this area are not grounds for probable cause for a Terry stop, right?'
          },
          {
            id: 'analysis-previous',
            role: 'assistant',
            channel: 'analysis',
            content: 'Older analysis should not be sent back into the new analysis.'
          }
        ]
      });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.body.transcript.at(-1).channel).toBe('analysis');
    expect(response.body.transcript.at(-1).content).toContain("Officer's position");
    expect(response.body.transcript.at(-1).content).toContain("User's position");
    expect(response.body.transcript.at(-1).meta.retrieval.status).toBe('grounded');
    expect(response.body.transcript.at(-1).meta.sources).toHaveLength(3);

    const courtListenerUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(courtListenerUrl.searchParams.get('q')).toContain('Terry');
    expect(courtListenerUrl.searchParams.get('q')).toContain('automobile exception');

    const analysisCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const systemPrompt = analysisCallBody.messages[0].content;

    expect(systemPrompt).toContain('Use the following CourtListener sources as citation grounding');
    expect(systemPrompt).toContain('You may use established legal knowledge');
    expect(systemPrompt).toContain('Terry v. Ohio');
    expect(systemPrompt).toContain('California v. Acevedo');
    expect(systemPrompt).toContain("## Officer's position");
    expect(systemPrompt).toContain("## User's position");
    expect(systemPrompt).toContain('## How the cited cases apply');
    expect(systemPrompt).toContain('Supports the officer');
    expect(systemPrompt).toContain('Supports the user');
    expect(systemPrompt).toContain('distinguishes');
    expect(systemPrompt).toContain('Do not introduce facts');

    expect(
      analysisCallBody.messages.some((message) =>
        String(message.content).includes('You seemed fidgety')
      )
    ).toBe(true);
    expect(
      analysisCallBody.messages.some((message) =>
        String(message.content).includes('Older analysis')
      )
    ).toBe(false);
  });

  it('returns readable provider errors without using a gateway status code', async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse(
        {
          error: {
            message: 'OpenRouter is temporarily overloaded.'
          }
        },
        {
          ok: false,
          status: 503
        }
      )
    );

    const response = await request(app)
      .post('/api/simulator/turn')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'openrouter/free',
        providerConfig: {
          apiKey: 'test-key',
          baseUrl: 'https://openrouter.ai/api/v1'
        },
        transcript: [],
        userInput: 'I do not consent to a search.'
      });

    expect(response.statusCode).toBe(424);
    expect(response.body.error).toContain('OpenRouter is temporarily overloaded.');
  });

  it('uses server OpenAI-compatible defaults when a browser has stale base URL settings but no browser API key', async () => {
    app = createApp({
      config: createConfig({
        APP_MODE: 'live',
        DEFAULT_PROVIDER: 'openai-compatible',
        OPENAI_COMPATIBLE_BASE_URL: 'https://openrouter.ai/api/v1',
        OPENAI_COMPATIBLE_API_KEY: 'server-openrouter-key',
        OPENAI_COMPATIBLE_MODEL: 'openrouter/free',
        GEMINI_API_KEY: '',
        COURTLISTENER_API_TOKEN: 'server-courtlistener-token'
      })
    });
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({
        choices: [
          {
            message: {
              content: 'Stay calm and ask whether this is a request or a demand.'
            }
          }
        ]
      })
    );

    const response = await request(app)
      .post('/api/simulator/turn')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: ''
        },
        transcript: [],
        userInput: 'Is that a request or demand?'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.model).toBe('openrouter/free');
    expect(response.body.transcript.at(-1).meta.model).toBe('openrouter/free');
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://openrouter.ai/api/v1/chat/completions'
    );

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(callBody.model).toBe('openrouter/free');
  });

  it('keeps Gemini analysis requests valid when the transcript ends with an assistant turn', async () => {
    app = createApp({
      config: createConfig({
        APP_MODE: 'live',
        DEFAULT_PROVIDER: 'gemini',
        OPENAI_COMPATIBLE_API_KEY: '',
        GEMINI_API_KEY: 'server-gemini-key',
        GEMINI_VERTEX_PROJECT: '',
        COURTLISTENER_API_TOKEN: 'server-courtlistener-token'
      })
    });
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: []
        });
      }

      return createFetchResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: [
                    "## Officer's position",
                    'The officer may ask questions at the door.',
                    '',
                    "## User's position",
                    'The user can decline to open the door.',
                    '',
                    '## How the cited cases apply',
                    '- **Supports the user:** consent is not implied by silence.',
                    '',
                    '## Authorities',
                    '- No CourtListener authorities were available for this analysis turn.',
                    '',
                    '## Notes',
                    'Keep the door closed if you are refusing entry.'
                  ].join('\n')
                }
              ]
            }
          }
        ]
      });
    });

    const response = await request(app)
      .post('/api/simulator/analyze')
      .send({
        scenarioId: 'knock-and-talk-home-entry',
        providerId: 'gemini',
        model: 'gemini-2.5-flash',
        transcript: [
          {
            id: 'scenario-1',
            role: 'assistant',
            channel: 'scenario',
            content: 'Can you open the door so we can talk?'
          }
        ]
      });

    expect(response.statusCode).toBe(200);

    const geminiCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);

    expect(geminiCallBody.contents.at(-1).role).toBe('user');
    expect(geminiCallBody.contents.at(-1).parts[0].text).toContain(
      'Provide the requested legal analysis'
    );
  });

  it('runs simulator legal analysis as a pollable background job', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: [
            {
              absolute_url: '/opinion/2/california-v-acevedo/',
              caseName: 'California v. Acevedo',
              caseNameFull: 'California v. Acevedo',
              citation: ['500 U.S. 565'],
              cluster_id: 2,
              court: 'Supreme Court of the United States',
              dateFiled: '1991-05-30',
              docketNumber: '89-1690',
              opinions: [
                {
                  id: 2,
                  snippet:
                    'The automobile exception permits a warrantless search when probable cause supports it.'
                }
              ]
            }
          ]
        });
      }

      return createFetchResponse({
        choices: [
          {
            message: {
              content: [
                "## Officer's position",
                'The officer needs probable cause or voluntary consent.',
                '',
                "## User's position",
                'The user can preserve the refusal of consent.',
                '',
                '## How the cited cases apply',
                '- **Supports the user:** Acevedo requires probable cause for a container search.',
                '',
                '## Authorities',
                '- **California v. Acevedo**, 500 U.S. 565.',
                '',
                '## Notes',
                'If the user allows the search, the officer will argue consent.'
              ].join('\n')
            }
          }
        ]
      });
    });

    const startResponse = await request(app)
      .post('/api/simulator/analyze-jobs')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'test-key'
        },
        transcript: [
          {
            id: 'scenario-1',
            role: 'assistant',
            channel: 'scenario',
            content: 'Mind if I take a quick look in your car?'
          },
          {
            id: 'user-1',
            role: 'user',
            channel: 'scenario',
            content: 'I do not consent to a search.'
          }
        ]
      });

    expect(startResponse.statusCode).toBe(202);
    expect(startResponse.body.jobId).toBeTruthy();
    expect(startResponse.body.status).toMatch(/queued|running/);
    expect(startResponse.body.statusUrl).toBe(
      `/api/simulator/analyze-jobs/${startResponse.body.jobId}`
    );

    let pollResponse;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      pollResponse = await request(app).get(startResponse.body.statusUrl);

      if (pollResponse.body.status === 'completed') {
        break;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }

    expect(pollResponse.statusCode).toBe(200);
    expect(pollResponse.body.status).toBe('completed');
    expect(pollResponse.body.result.transcript.at(-1).channel).toBe('analysis');
    expect(pollResponse.body.result.transcript.at(-1).content).toContain(
      'If the user allows the search'
    );
  });

  it('keeps usable unstructured analysis text instead of showing an internal fallback message', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: []
        });
      }

      return createFetchResponse({
        choices: [
          {
            message: {
              content:
                'The officer has a consent argument if the driver agrees, but the user has a strong position if they clearly refuse and no probable cause exists.'
            }
          }
        ]
      });
    });

    const response = await request(app)
      .post('/api/simulator/analyze')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'test-key'
        },
        transcript: [
          {
            id: 'scenario-1',
            role: 'assistant',
            channel: 'scenario',
            content: 'Mind if I take a quick look in your car?'
          },
          {
            id: 'user-1',
            role: 'user',
            channel: 'scenario',
            content: 'I refuse consent.'
          }
        ]
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.transcript.at(-1).content).toContain('## Notes');
    expect(response.body.transcript.at(-1).content).toContain(
      'The officer has a consent argument'
    );
    expect(response.body.transcript.at(-1).content).not.toContain(
      'The analyzer returned an unstructured response'
    );
  });

  it('keeps CourtListener source snippets compact while linking to the full opinion', async () => {
    const longSnippet = [
      'The automobile exception permits a warrantless vehicle search when officers have probable cause.',
      'This long excerpt continues with procedural history and factual background that should not take over the simulator transcript.',
      'The source card should provide a compact excerpt while the full CourtListener opinion remains linked for deeper reading.',
      'Extra details belong behind the full-case link instead of occupying the teaching flow.'
    ].join(' ');

    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: [
            {
              absolute_url: '/opinion/2/california-v-acevedo/',
              caseName: 'California v. Acevedo',
              caseNameFull: 'California v. Acevedo',
              citation: ['500 U.S. 565'],
              cluster_id: 2,
              court: 'Supreme Court of the United States',
              dateFiled: '1991-05-30',
              docketNumber: '89-1690',
              opinions: [
                {
                  id: 2,
                  download_url: 'https://example.com/acevedo.pdf',
                  snippet: longSnippet
                }
              ]
            }
          ]
        });
      }

      return createFetchResponse({
        choices: [
          {
            message: {
              content: [
                "## Officer's position",
                'The officer can discuss probable cause if facts support it.',
                '',
                "## User's position",
                'The user can refuse consent.',
                '',
                '## How the cited cases apply',
                '- **Supports the user unless facts change:** Acevedo needs probable cause.',
                '',
                '## Authorities',
                '- **California v. Acevedo**, 500 U.S. 565.',
                '',
                '## Notes',
                'Educational information.'
              ].join('\n')
            }
          }
        ]
      });
    });

    const response = await request(app)
      .post('/api/simulator/analyze')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'test-key'
        },
        transcript: [
          {
            id: 'scenario-1',
            role: 'assistant',
            channel: 'scenario',
            content: 'Mind if I take a quick look in your car?'
          }
        ]
      });

    const source = response.body.transcript.at(-1).meta.sources[0];

    expect(response.statusCode).toBe(200);
    expect(source.url).toContain('/opinion/2/california-v-acevedo/');
    expect(source.snippet.length).toBeLessThanOrEqual(260);
    expect(source.snippet).toContain('...');
  });

  it('uses opinion-only CourtListener search for simulator analysis without dumping raw dialogue into the query', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: [
            {
              absolute_url: '/opinion/2/california-v-acevedo/',
              caseName: 'California v. Acevedo',
              caseNameFull: 'California v. Acevedo',
              citation: ['500 U.S. 565'],
              cluster_id: 2,
              court: 'Supreme Court of the United States',
              dateFiled: '1991-05-30',
              docketNumber: '89-1690',
              opinions: [
                {
                  id: 2,
                  download_url: 'https://example.com/acevedo.pdf',
                  snippet:
                    'The automobile exception permits a warrantless search of a vehicle container when probable cause supports it.'
                }
              ]
            }
          ]
        });
      }

      return createFetchResponse({
        choices: [
          {
            message: {
              content: [
                "## Officer's position",
                'The officer can argue consent or probable cause depending on the transcript facts.',
                '',
                "## User's position",
                'The user can argue refusal to consent and lack of probable cause.',
                '',
                '## Authorities',
                '- **California v. Acevedo**, 500 U.S. 565.',
                '',
                '## Notes',
                'This is educational information.'
              ].join('\n')
            }
          }
        ]
      });
    });

    const response = await request(app)
      .post('/api/simulator/analyze')
      .send({
        scenarioId: 'traffic-stop-backpack-search',
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'test-key'
        },
        transcript: [
          {
            id: 'scenario-1',
            role: 'assistant',
            channel: 'scenario',
            content:
              "Alright, license and registration check out. Everything's in order there. Mind if I take a quick look in your car?"
          },
          {
            id: 'user-1',
            role: 'user',
            channel: 'scenario',
            content: "You can't search me without a warrant."
          }
        ]
      });

    expect(response.statusCode).toBe(200);

    const courtListenerUrl = new URL(String(fetchMock.mock.calls[0][0]));

    expect(courtListenerUrl.searchParams.get('type')).toBe('o');
    expect(courtListenerUrl.searchParams.get('q')).toContain('automobile exception');
    expect(courtListenerUrl.searchParams.get('q')).not.toContain("Everything's in order");
    expect(courtListenerUrl.searchParams.get('q')).not.toContain("You can't search me");
    expect(response.body.transcript.at(-1).meta.retrieval.queriedTypes).toEqual(['o']);
  });

  it('grounds legal research answers in courtlistener sources and honors browser token override', async () => {
    fetchMock.mockImplementation(async (url, options = {}) => {
      if (String(url).includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: [
            {
              absolute_url: '/opinion/123/terry-v-ohio/',
              caseName: 'Terry v. Ohio',
              caseNameFull: 'Terry v. Ohio',
              citation: ['392 U.S. 1'],
              cluster_id: 123,
              court: 'Supreme Court of the United States',
              dateFiled: '1968-06-10',
              docketNumber: '67',
              opinions: [
                {
                  id: 999,
                  download_url: 'https://example.com/terry.pdf',
                  snippet: 'This Court recognized a brief investigatory <mark>stop</mark>.'
                }
              ]
            }
          ]
        });
      }

      return createFetchResponse({
        choices: [
          {
            message: {
              content: 'Terry v. Ohio recognized the brief investigatory stop as a distinct Fourth Amendment encounter.'
            }
          }
        ]
      });
    });

    const response = await request(app)
      .post('/api/chat/turn')
      .send({
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'test-key'
        },
        courtlistenerConfig: {
          apiToken: 'browser-token'
        },
        transcript: [],
        userInput: 'What is a Terry stop?'
      });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(response.body.transcript.at(-1).channel).toBe('chat');
    expect(response.body.transcript.at(-1).meta.retrieval.status).toBe('grounded');
    expect(response.body.transcript.at(-1).meta.sources).toHaveLength(2);
    expect(response.body.transcript.at(-1).meta.retrieval.queriedTypes).toEqual(['o', 'r']);

    const searchCall = fetchMock.mock.calls[0];

    expect(String(searchCall[0])).toContain('/api/rest/v4/search/');
    expect(searchCall[1].headers.Authorization).toBe('Token browser-token');
  });

  it('returns a legal research answer even when courtlistener is unavailable', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/api/rest/v4/search/')) {
        return createFetchResponse(
          {
            detail: 'Service unavailable'
          },
          {
            ok: false,
            status: 503
          }
        );
      }

      return createFetchResponse({
        choices: [
          {
            message: {
              content: 'I could not confirm CourtListener authorities for this turn, but generally a motion to suppress challenges the legality of the evidence collection.'
            }
          }
        ]
      });
    });

    const response = await request(app)
      .post('/api/chat/turn')
      .send({
        providerId: 'openai-compatible',
        model: 'gpt-4.1-mini',
        providerConfig: {
          apiKey: 'test-key'
        },
        transcript: [],
        userInput: 'What does a motion to suppress do?'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.transcript.at(-1).meta.retrieval.status).toBe('unavailable');
    expect(response.body.transcript.at(-1).meta.sources).toHaveLength(0);
  });
});
