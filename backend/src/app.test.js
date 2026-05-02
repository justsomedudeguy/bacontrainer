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

function createOpenAiTextResponse(content) {
  return createFetchResponse({
    choices: [
      {
        message: {
          content
        }
      }
    ]
  });
}

function createOpinionSearchResult({
  clusterId,
  caseName,
  citation,
  court = 'Supreme Court of the United States',
  dateFiled = '1970-01-01',
  snippet = ''
}) {
  const slug = caseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    absolute_url: `/opinion/${clusterId}/${slug}/`,
    caseName,
    caseNameFull: caseName,
    citation: Array.isArray(citation) ? citation : [citation].filter(Boolean),
    cluster_id: clusterId,
    court,
    dateFiled,
    docketNumber: String(clusterId),
    opinions: [
      {
        id: clusterId,
        snippet
      }
    ]
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
    expect(response.body.transcript.at(-1).channel).toBe('analysis');
    expect(response.body.transcript.at(-1).content).toContain("Officer's position");
    expect(response.body.transcript.at(-1).content).toContain("User's position");
    expect(response.body.transcript.at(-1).meta.retrieval.status).toBe('grounded');
    expect(response.body.transcript.at(-1).meta.sources).toHaveLength(3);

    const courtListenerUrls = fetchMock.mock.calls
      .filter(([url]) => String(url).includes('/api/rest/v4/search/'))
      .map(([url]) => new URL(String(url)));
    const courtListenerQueries = courtListenerUrls.map((url) => url.searchParams.get('q') || '');

    expect(courtListenerQueries.some((query) => query.includes('Terry'))).toBe(true);
    expect(courtListenerQueries.some((query) => query.includes('automobile exception'))).toBe(
      true
    );

    const analysisCallBody = fetchMock.mock.calls
      .filter(([url]) => String(url).includes('/chat/completions'))
      .map(([, options]) => JSON.parse(options.body))
      .at(-1);
    const systemPrompt = analysisCallBody.messages[0].content;

    expect(systemPrompt).toContain('Use the following CourtListener sources as citation grounding');
    expect(systemPrompt).toContain('You may use established legal knowledge');
    expect(systemPrompt).toContain('Terry v. Ohio');
    expect(systemPrompt).toContain('California v. Acevedo');
    expect(systemPrompt).toContain('## Bottom Line');
    expect(systemPrompt).toContain('## Facts');
    expect(systemPrompt).toContain('## Analysis');
    expect(systemPrompt).toContain('## Final Conclusion');
    expect(systemPrompt).toContain('compact court ruling');
    expect(systemPrompt).toContain('suppression');
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

  it('uses issue planning and verified source selection for simulator analysis', async () => {
    const sourcesByCase = {
      mimms: createOpinionSearchResult({
        clusterId: 101,
        caseName: 'Pennsylvania v. Mimms',
        citation: '434 U.S. 106',
        dateFiled: '1977-12-05',
        snippet: 'An officer may order a driver out of a lawfully stopped vehicle.'
      }),
      wilson: createOpinionSearchResult({
        clusterId: 102,
        caseName: 'Maryland v. Wilson',
        citation: '519 U.S. 408',
        dateFiled: '1997-02-19',
        snippet: 'The same traffic-stop safety rule extends to passengers.'
      }),
      johnson: createOpinionSearchResult({
        clusterId: 103,
        caseName: 'Arizona v. Johnson',
        citation: '555 U.S. 323',
        dateFiled: '2009-01-26',
        snippet: 'A passenger frisk requires reasonable suspicion that the person is armed and dangerous.'
      })
    };

    fetchMock.mockImplementation(async (url, options = {}) => {
      const urlText = String(url);

      if (urlText.includes('/api/rest/v4/search/')) {
        const query = new URL(urlText).searchParams.get('q') || '';
        const results = [];

        if (/mimms|driver|step out/i.test(query)) {
          results.push(sourcesByCase.mimms);
        }

        if (/wilson|passenger/i.test(query)) {
          results.push(sourcesByCase.wilson);
        }

        if (/johnson|frisk|armed/i.test(query)) {
          results.push(sourcesByCase.johnson);
        }

        if (results.length === 0 && /traffic stop|fourth amendment/i.test(query)) {
          results.push(sourcesByCase.mimms, sourcesByCase.wilson, sourcesByCase.johnson);
        }

        return createFetchResponse({ results });
      }

      const requestBody = JSON.parse(options.body);
      const systemPrompt = requestBody.messages?.[0]?.content || '';

      if (systemPrompt.includes('legal issue planning')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            issue:
              'Whether police may order a driver out of a stopped car and frisk a passenger during a traffic stop.',
            currentFocus: 'The latest turn asks whether the driver must step out.',
            jurisdictionMode: 'federal',
            stateVariation: false,
            candidateCaseNames: [
              'Pennsylvania v. Mimms',
              'Maryland v. Wilson',
              'Arizona v. Johnson'
            ],
            searchQueries: [
              'Fourth Amendment traffic stop order driver step out passenger frisk'
            ],
            preferredCourtIds: ['scotus']
          })
        );
      }

      if (systemPrompt.includes('CourtListener source selection')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            selectedSources: [
              {
                id: 'o-101',
                selectionRole: 'core_landmark',
                reason: 'Core Supreme Court driver-exit rule.'
              },
              {
                id: 'o-fake',
                selectionRole: 'narrowing_case',
                reason: 'This source was not actually retrieved.'
              },
              {
                id: 'o-102',
                selectionRole: 'narrowing_case',
                reason: 'Passenger-exit extension.'
              },
              {
                id: 'o-103',
                selectionRole: 'application_case',
                reason: 'Passenger frisk limitation.'
              }
            ]
          })
        );
      }

      return createOpenAiTextResponse(
        [
          "## Officer's position",
          'Mimms supports ordering the driver out during a lawful traffic stop.',
          '',
          "## User's position",
          'Johnson limits a frisk to facts suggesting the person is armed and dangerous.',
          '',
          '## How the cited cases apply',
          '- **Supports the officer:** Pennsylvania v. Mimms addresses the driver-exit order.',
          '- **Supports the user:** Arizona v. Johnson requires additional frisk facts.',
          '',
          '## Authorities',
          '- Pennsylvania v. Mimms; Maryland v. Wilson; Arizona v. Johnson.',
          '',
          '## Notes',
          'This is educational information.'
        ].join('\n')
      );
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
            content: 'Step out of the car. I also need your passenger to stand over here.'
          },
          {
            id: 'user-1',
            role: 'user',
            channel: 'scenario',
            content: 'Do I have to step out, and can you frisk us?'
          }
        ]
      });

    const analysisMessage = response.body.transcript.at(-1);
    const sourceTitles = analysisMessage.meta.sources.map((source) => source.title);
    const providerBodies = fetchMock.mock.calls
      .filter(([url]) => String(url).includes('/chat/completions'))
      .map(([, options]) => JSON.parse(options.body));
    const finalPrompt = providerBodies.at(-1).messages[0].content;

    expect(response.statusCode).toBe(200);
    expect(analysisMessage.meta.retrieval.status).toBe('grounded');
    expect(analysisMessage.meta.retrieval.strategy).toBe('multi-step');
    expect(analysisMessage.meta.retrieval.issue).toContain('driver out');
    expect(analysisMessage.meta.retrieval.jurisdictionMode).toBe('federal');
    expect(sourceTitles).toEqual([
      'Pennsylvania v. Mimms',
      'Maryland v. Wilson',
      'Arizona v. Johnson'
    ]);
    expect(analysisMessage.meta.sources[0].selectionRole).toBe('core_landmark');
    expect(sourceTitles).not.toContain('Invented v. Source');
    expect(providerBodies[0].messages[0].content).toContain('legal issue planning');
    expect(providerBodies[1].messages[0].content).toContain('CourtListener source selection');
    expect(finalPrompt).toContain('Pennsylvania v. Mimms');
    expect(finalPrompt).toContain('Selection role: core_landmark');
  });

  it('carries up to five verified authorities into the final simulator analysis prompt', async () => {
    const sourcesByCase = {
      terry: createOpinionSearchResult({
        clusterId: 401,
        caseName: 'Terry v. Ohio',
        citation: '392 U.S. 1',
        dateFiled: '1968-06-10',
        snippet: 'A brief investigatory stop requires reasonable suspicion.'
      }),
      ross: createOpinionSearchResult({
        clusterId: 402,
        caseName: 'United States v. Ross',
        citation: '456 U.S. 798',
        dateFiled: '1982-06-01',
        snippet: 'Probable cause can justify a vehicle search including containers.'
      }),
      acevedo: createOpinionSearchResult({
        clusterId: 403,
        caseName: 'California v. Acevedo',
        citation: '500 U.S. 565',
        dateFiled: '1991-05-30',
        snippet: 'The automobile exception applies to vehicle containers when probable cause exists.'
      }),
      mapp: createOpinionSearchResult({
        clusterId: 404,
        caseName: 'Mapp v. Ohio',
        citation: '367 U.S. 643',
        dateFiled: '1961-06-19',
        snippet: 'The exclusionary rule applies to state criminal prosecutions.'
      }),
      wongSun: createOpinionSearchResult({
        clusterId: 405,
        caseName: 'Wong Sun v. United States',
        citation: '371 U.S. 471',
        dateFiled: '1963-01-14',
        snippet: 'Evidence derived from unlawful police conduct may be suppressed as fruit of the poisonous tree.'
      })
    };

    fetchMock.mockImplementation(async (url, options = {}) => {
      const urlText = String(url);

      if (urlText.includes('/api/rest/v4/search/')) {
        const query = new URL(urlText).searchParams.get('q') || '';
        const results = [];

        if (/terry|traffic stop|reasonable suspicion|fourth amendment/i.test(query)) {
          results.push(sourcesByCase.terry);
        }

        if (/ross|automobile|vehicle|container|backpack|probable cause/i.test(query)) {
          results.push(sourcesByCase.ross);
        }

        if (/acevedo|container|backpack|vehicle/i.test(query)) {
          results.push(sourcesByCase.acevedo);
        }

        if (/mapp|exclusionary|suppression|unlawful search|evidence/i.test(query)) {
          results.push(sourcesByCase.mapp);
        }

        if (/wong sun|fruit|suppression|unlawful search|evidence/i.test(query)) {
          results.push(sourcesByCase.wongSun);
        }

        return createFetchResponse({ results });
      }

      const requestBody = JSON.parse(options.body);
      const systemPrompt = requestBody.messages?.[0]?.content || '';

      if (systemPrompt.includes('legal issue planning')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            issue:
              'Whether a traffic stop and warrantless backpack search violated the Fourth Amendment and whether discovered evidence should be suppressed.',
            currentFocus:
              'The officer searched the backpack after consent was refused and found possible contraband.',
            jurisdictionMode: 'federal',
            stateVariation: false,
            candidateCaseNames: [
              'Terry v. Ohio',
              'United States v. Ross',
              'California v. Acevedo',
              'Mapp v. Ohio',
              'Wong Sun v. United States'
            ],
            searchQueries: [
              'Fourth Amendment traffic stop backpack vehicle container search evidence suppression exclusionary rule'
            ],
            preferredCourtIds: ['scotus']
          })
        );
      }

      if (systemPrompt.includes('CourtListener source selection')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            selectedSources: [
              {
                id: 'o-401',
                selectionRole: 'core_landmark',
                reason: 'Core stop and reasonable-suspicion authority.'
              },
              {
                id: 'o-402',
                selectionRole: 'narrowing_case',
                reason: 'Vehicle-container probable-cause rule.'
              },
              {
                id: 'o-403',
                selectionRole: 'application_case',
                reason: 'Container-specific automobile exception rule.'
              },
              {
                id: 'o-404',
                selectionRole: 'remedy',
                reason: 'Suppression and exclusionary-rule authority.'
              },
              {
                id: 'o-405',
                selectionRole: 'remedy',
                reason: 'Derivative-evidence suppression authority.'
              }
            ],
            analysisBlueprint: {
              bottomLine: 'The backpack search and resulting evidence are vulnerable.',
              facts: [
                'The user refused consent.',
                'The officer searched the backpack anyway.',
                'The officer found possible contraband.'
              ],
              issues: [
                {
                  title: 'Backpack search and suppression',
                  analysis:
                    'The final answer should address both the search rule and the likely suppression consequence.'
                }
              ],
              finalConclusion: 'The evidence would likely face a suppression motion.'
            }
          })
        );
      }

      return createOpenAiTextResponse(
        [
          '## Bottom Line',
          'The search likely fails.',
          '',
          '## Facts',
          '- The user refused consent.',
          '- The officer searched anyway.',
          '',
          '## Analysis',
          'The analysis cites only verified CourtListener sources.',
          '',
          '## Final Conclusion',
          'The evidence would likely face suppression.'
        ].join('\n')
      );
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
            content: 'I am going to search the backpack now.'
          },
          {
            id: 'user-1',
            role: 'user',
            channel: 'scenario',
            content: 'I do not consent.'
          },
          {
            id: 'scenario-2',
            role: 'assistant',
            channel: 'scenario',
            content: 'The officer searches the backpack and finds a baggie.'
          }
        ]
      });

    const analysisMessage = response.body.transcript.at(-1);
    const finalPrompt = fetchMock.mock.calls
      .filter(([url]) => String(url).includes('/chat/completions'))
      .map(([, options]) => JSON.parse(options.body))
      .at(-1).messages[0].content;

    expect(response.statusCode).toBe(200);
    expect(analysisMessage.meta.sources.map((source) => source.title)).toEqual([
      'Terry v. Ohio',
      'United States v. Ross',
      'California v. Acevedo',
      'Mapp v. Ohio',
      'Wong Sun v. United States'
    ]);
    expect(finalPrompt).toContain('cite only the verified CourtListener sources');
    expect(finalPrompt).toContain('Authorities checked');
    expect(finalPrompt).toContain('Mapp v. Ohio');
    expect(finalPrompt).toContain('Wong Sun v. United States');
    expect(analysisMessage.content).toContain('Authorities checked:');
    expect(analysisMessage.content).toContain('Mapp v. Ohio');
  });

  it('adds suppression remedy retrieval hints when the transcript search produces evidence', async () => {
    const ross = createOpinionSearchResult({
      clusterId: 501,
      caseName: 'United States v. Ross',
      citation: '456 U.S. 798',
      dateFiled: '1982-06-01',
      snippet: 'Probable cause can justify a vehicle search including containers.'
    });
    const mapp = createOpinionSearchResult({
      clusterId: 502,
      caseName: 'Mapp v. Ohio',
      citation: '367 U.S. 643',
      dateFiled: '1961-06-19',
      snippet: 'The exclusionary rule applies to state criminal prosecutions.'
    });

    fetchMock.mockImplementation(async (url, options = {}) => {
      const urlText = String(url);

      if (urlText.includes('/api/rest/v4/search/')) {
        const query = new URL(urlText).searchParams.get('q') || '';
        const results = [];

        if (/ross|automobile|container|backpack|probable cause/i.test(query)) {
          results.push(ross);
        }

        if (/mapp|exclusionary|suppression|unlawful search|evidence/i.test(query)) {
          results.push(mapp);
        }

        return createFetchResponse({ results });
      }

      const requestBody = JSON.parse(options.body);
      const systemPrompt = requestBody.messages?.[0]?.content || '';

      if (systemPrompt.includes('legal issue planning')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            issue: 'Whether the backpack search was lawful under the automobile exception.',
            currentFocus: 'The officer searched the backpack after consent was refused.',
            jurisdictionMode: 'federal',
            stateVariation: false,
            candidateCaseNames: ['United States v. Ross'],
            searchQueries: ['Fourth Amendment vehicle container backpack probable cause'],
            preferredCourtIds: ['scotus']
          })
        );
      }

      if (systemPrompt.includes('CourtListener source selection')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            selectedSources: [
              {
                id: 'o-501',
                selectionRole: 'core_landmark',
                reason: 'Vehicle-container search rule.'
              },
              {
                id: 'o-502',
                selectionRole: 'remedy',
                reason: 'Suppression remedy for unlawfully obtained evidence.'
              }
            ]
          })
        );
      }

      return createOpenAiTextResponse(
        [
          '## Bottom Line',
          'The search likely fails.',
          '',
          '## Facts',
          '- The officer searched the backpack and found a baggie.',
          '',
          '## Analysis',
          'The final answer can discuss suppression because a remedy source was verified.',
          '',
          '## Final Conclusion',
          'Suppression would likely be litigated.'
        ].join('\n')
      );
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
            content: 'The officer searches the backpack and finds a baggie inside.'
          }
        ]
      });

    const searchQueries = fetchMock.mock.calls
      .filter(([url]) => String(url).includes('/api/rest/v4/search/'))
      .map(([url]) => new URL(String(url)).searchParams.get('q') || '');
    const sourceTitles = response.body.transcript.at(-1).meta.sources.map(
      (source) => source.title
    );

    expect(response.statusCode).toBe(200);
    expect(searchQueries.some((query) => /suppression|exclusionary/i.test(query))).toBe(true);
    expect(sourceTitles).toContain('Mapp v. Ohio');
  });

  it('asks for ruling-style analysis sections without user-visible syllabus or position headings', async () => {
    fetchMock.mockImplementation(async (url, options = {}) => {
      const urlText = String(url);

      if (urlText.includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: [
            createOpinionSearchResult({
              clusterId: 301,
              caseName: 'California v. Acevedo',
              citation: '500 U.S. 565',
              dateFiled: '1991-05-30',
              snippet: 'Vehicle-container searches require probable cause.'
            })
          ]
        });
      }

      const requestBody = JSON.parse(options.body);
      const systemPrompt = requestBody.messages?.[0]?.content || '';

      if (systemPrompt.includes('legal issue planning')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            issue:
              'Whether a warrantless backpack search during a traffic stop was lawful.',
            currentFocus: 'The officer searched the backpack after consent was refused.',
            jurisdictionMode: 'federal',
            stateVariation: false,
            candidateCaseNames: ['California v. Acevedo'],
            searchQueries: ['Fourth Amendment warrantless backpack search traffic stop'],
            preferredCourtIds: ['scotus'],
            recentFacts: [
              'The user refused consent.',
              'The officer said he would search the backpack anyway.'
            ]
          })
        );
      }

      if (systemPrompt.includes('CourtListener source selection')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            selectedSources: [
              {
                id: 'o-301',
                selectionRole: 'core_landmark',
                reason: 'Vehicle-container search rule.'
              }
            ],
            analysisBlueprint: {
              bottomLine:
                'Likely unlawful backpack search on this record because consent was refused and no probable cause was articulated.',
              facts: [
                'The user was stopped for a traffic issue.',
                'The officer asked to search a backpack.',
                'The user refused consent.',
                'The officer searched the backpack anyway.'
              ],
              issues: [
                {
                  title: 'Backpack search',
                  analysis:
                    'Without consent or articulated probable cause, the search is vulnerable to suppression.'
                }
              ],
              finalConclusion:
                'Evidence found in the backpack would likely face suppression on this record.'
            }
          })
        );
      }

      return createOpenAiTextResponse(
        [
          '## Bottom Line',
          'Likely unlawful backpack search.',
          '',
          '## Facts',
          '- The user refused consent.',
          '- The officer searched anyway.',
          '',
          '## Analysis',
          'The search lacks consent and articulated probable cause.',
          '',
          '## Final Conclusion',
          'Suppression would likely be the main court consequence.'
        ].join('\n')
      );
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
            content: 'I am going to search the backpack now.'
          },
          {
            id: 'user-1',
            role: 'user',
            channel: 'scenario',
            content: 'I do not consent to any searches.'
          }
        ]
      });

    const analysisMessage = response.body.transcript.at(-1);
    const providerBodies = fetchMock.mock.calls
      .filter(([url]) => String(url).includes('/chat/completions'))
      .map(([, options]) => JSON.parse(options.body));
    const finalPrompt = providerBodies.at(-1).messages[0].content;

    expect(response.statusCode).toBe(200);
    expect(finalPrompt).toContain('## Bottom Line');
    expect(finalPrompt).toContain('## Facts');
    expect(finalPrompt).toContain('## Analysis');
    expect(finalPrompt).toContain('## Final Conclusion');
    expect(finalPrompt).not.toContain('Syllabus');
    expect(finalPrompt).not.toContain("## Officer's position");
    expect(finalPrompt).not.toContain("## User's position");
    expect(analysisMessage.content).toContain('## Bottom Line');
    expect(analysisMessage.content).not.toContain('## Syllabus');
  });

  it('surfaces Rodriguez for dog-sniff prolongation facts', async () => {
    fetchMock.mockImplementation(async (url, options = {}) => {
      const urlText = String(url);

      if (urlText.includes('/api/rest/v4/search/')) {
        const query = new URL(urlText).searchParams.get('q') || '';

        return createFetchResponse({
          results: /rodriguez|dog|sniff|prolong/i.test(query)
            ? [
                createOpinionSearchResult({
                  clusterId: 201,
                  caseName: 'Rodriguez v. United States',
                  citation: '575 U.S. 348',
                  dateFiled: '2015-04-21',
                  snippet:
                    'A traffic stop may not be prolonged beyond its mission without independent reasonable suspicion.'
                })
              ]
            : []
        });
      }

      const requestBody = JSON.parse(options.body);
      const systemPrompt = requestBody.messages?.[0]?.content || '';

      if (systemPrompt.includes('legal issue planning')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            issue:
              'Whether an officer may prolong a completed traffic stop for a dog sniff.',
            currentFocus: 'The latest turn asks about waiting for a K9 after the traffic mission ended.',
            jurisdictionMode: 'federal',
            stateVariation: false,
            candidateCaseNames: ['Rodriguez v. United States'],
            searchQueries: ['Fourth Amendment traffic stop dog sniff prolonged stop'],
            preferredCourtIds: ['scotus']
          })
        );
      }

      if (systemPrompt.includes('CourtListener source selection')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            selectedSources: [
              {
                id: 'o-201',
                selectionRole: 'core_landmark',
                reason: 'Supreme Court prolonged-stop dog-sniff rule.'
              }
            ]
          })
        );
      }

      return createOpenAiTextResponse(
        [
          "## Officer's position",
          'The officer needs independent reasonable suspicion to prolong the stop.',
          '',
          "## User's position",
          'Rodriguez supports the user if the traffic mission was complete.',
          '',
          '## How the cited cases apply',
          '- **Supports the user:** Rodriguez limits dog-sniff delay.',
          '',
          '## Authorities',
          '- Rodriguez v. United States.',
          '',
          '## Notes',
          'This is educational information.'
        ].join('\n')
      );
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
              'Your ticket is done, but wait here while I call a K9 unit for a dog sniff.'
          },
          {
            id: 'user-1',
            role: 'user',
            channel: 'scenario',
            content: 'Can you keep me here for a dog sniff after the stop is over?'
          }
        ]
      });

    const analysisMessage = response.body.transcript.at(-1);

    expect(response.statusCode).toBe(200);
    expect(analysisMessage.meta.sources[0]).toEqual(
      expect.objectContaining({
        id: 'o-201',
        title: 'Rodriguez v. United States',
        selectionRole: 'core_landmark'
      })
    );
    expect(analysisMessage.meta.retrieval.issue).toContain('dog sniff');
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

    const geminiCallBody = fetchMock.mock.calls
      .map(([, options]) => (options?.body ? JSON.parse(options.body) : null))
      .filter(Boolean)
      .find((body) =>
        body.contents?.some((message) =>
          message.parts?.some((part) =>
            String(part.text).includes('Provide the requested legal analysis')
          )
        )
      );

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
    expect(response.body.transcript.at(-1).content).toContain('## Analysis');
    expect(response.body.transcript.at(-1).content).toContain('## Final Conclusion');
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

    const courtListenerUrl = new URL(
      String(fetchMock.mock.calls.find(([url]) => String(url).includes('/api/rest/v4/search/'))[0])
    );

    expect(courtListenerUrl.searchParams.get('type')).toBe('o');
    expect(courtListenerUrl.searchParams.get('q')).toContain('automobile exception');
    expect(courtListenerUrl.searchParams.get('q')).not.toContain("Everything's in order");
    expect(courtListenerUrl.searchParams.get('q')).not.toContain("You can't search me");
    expect(
      response.body.transcript.at(-1).meta.retrieval.queriedTypes.every((type) =>
        type.startsWith('o')
      )
    ).toBe(true);
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
    expect(response.body.transcript.at(-1).channel).toBe('chat');
    expect(response.body.transcript.at(-1).meta.retrieval.status).toBe('grounded');
    expect(response.body.transcript.at(-1).meta.sources).toHaveLength(1);
    expect(
      response.body.transcript.at(-1).meta.retrieval.queriedTypes.every((type) =>
        type.startsWith('o')
      )
    ).toBe(true);

    const searchCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/api/rest/v4/search/')
    );

    expect(String(searchCall[0])).toContain('/api/rest/v4/search/');
    expect(searchCall[1].headers.Authorization).toBe('Token browser-token');
  });

  it('recovers Hemingway landlord-tenant authority through planned case-name retrieval', async () => {
    fetchMock.mockImplementation(async (url, options = {}) => {
      const urlText = String(url);

      if (urlText.includes('/api/rest/v4/search/')) {
        const query = new URL(urlText).searchParams.get('q') || '';

        if (/hemingway|habitability|landlord tenant/i.test(query)) {
          return createFetchResponse({
            results: [
              createOpinionSearchResult({
                clusterId: 2000597,
                caseName: 'Boston Housing Authority v. Hemingway',
                citation: '363 Mass. 184',
                court: 'Supreme Judicial Court of Massachusetts',
                dateFiled: '1973-03-05',
                snippet:
                  'The case recognized an implied warranty of habitability in residential leases.'
              })
            ]
          });
        }

        return createFetchResponse({
          results: [
            createOpinionSearchResult({
              clusterId: 999,
              caseName: 'Unrelated Housing Authority Case',
              citation: '1 A.3d 1',
              court: 'Example Court',
              snippet: 'This is not the Massachusetts habitability case.'
            })
          ]
        });
      }

      const requestBody = JSON.parse(options.body);
      const systemPrompt = requestBody.messages?.[0]?.content || '';

      if (systemPrompt.includes('legal issue planning')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            issue:
              'Whether Massachusetts landlord-tenant law recognizes an implied warranty of habitability.',
            currentFocus: 'The user typed Hemenway and is asking for the landmark case.',
            jurisdictionMode: 'state-specific',
            stateVariation: false,
            candidateCaseNames: ['Boston Housing Authority v. Hemingway'],
            searchQueries: [
              'Massachusetts landlord tenant implied warranty habitability Hemingway Hemenway'
            ],
            preferredCourtIds: ['mass']
          })
        );
      }

      if (systemPrompt.includes('CourtListener source selection')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            selectedSources: [
              {
                id: 'o-2000597',
                selectionRole: 'core_landmark',
                reason: 'Massachusetts implied warranty of habitability landmark.'
              }
            ]
          })
        );
      }

      return createOpenAiTextResponse(
        'Boston Housing Authority v. Hemingway is the retrieved Massachusetts landlord-tenant source.'
      );
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
        userInput: 'Is there any Massachusetts landlord tenant case with Hemenway in the name?'
      });

    const assistantMessage = response.body.transcript.at(-1);

    expect(response.statusCode).toBe(200);
    expect(assistantMessage.meta.retrieval.strategy).toBe('multi-step');
    expect(assistantMessage.meta.retrieval.issue).toContain('habitability');
    expect(assistantMessage.meta.sources).toHaveLength(1);
    expect(assistantMessage.meta.sources[0]).toEqual(
      expect.objectContaining({
        id: 'o-2000597',
        title: 'Boston Housing Authority v. Hemingway',
        selectionRole: 'core_landmark'
      })
    );
    expect(assistantMessage.meta.sources[0].title).not.toContain('Unrelated');
  });

  it('flags telephone-recording consent as state-variable when no state is selected', async () => {
    fetchMock.mockImplementation(async (url, options = {}) => {
      const urlText = String(url);

      if (urlText.includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: []
        });
      }

      const requestBody = JSON.parse(options.body);
      const systemPrompt = requestBody.messages?.[0]?.content || '';

      if (systemPrompt.includes('legal issue planning')) {
        return createOpenAiTextResponse(
          JSON.stringify({
            issue:
              'Whether recording a telephone conversation requires consent of one party or all parties.',
            currentFocus: 'The user asks about recording calls without naming a state.',
            jurisdictionMode: 'state-variable',
            stateVariation: true,
            jurisdictionNotes:
              'U.S. states vary between one-party consent and all-party consent approaches.',
            candidateCaseNames: [],
            searchQueries: [
              'telephone recording consent one party all party state law wiretap'
            ],
            preferredCourtIds: []
          })
        );
      }

      return createOpenAiTextResponse(
        'This varies by state: one-party consent states usually allow recording if one participant consents, while all-party consent states generally require every participant to consent.'
      );
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
        userInput: 'Can I record a telephone conversation?'
      });

    const assistantMessage = response.body.transcript.at(-1);

    expect(response.statusCode).toBe(200);
    expect(assistantMessage.content).toContain('varies by state');
    expect(assistantMessage.meta.retrieval.jurisdictionMode).toBe('state-variable');
    expect(assistantMessage.meta.retrieval.stateVariation).toBe(true);
    expect(assistantMessage.meta.sources).toHaveLength(0);
  });

  it('looks up CourtListener opinion URLs directly instead of relying on broad search', async () => {
    fetchMock.mockImplementation(async (url) => {
      const urlText = String(url);

      if (urlText.includes('/api/rest/v4/clusters/2000597/')) {
        return createFetchResponse({
          id: 2000597,
          absolute_url: '/opinion/2000597/boston-housing-authority-v-hemingway/',
          case_name: 'Boston Housing Authority v. Hemingway',
          case_name_full:
            'Boston Housing Authority vs. Ruth Hemingway (And a Companion Case)',
          citations: [
            {
              volume: '363',
              reporter: 'Mass.',
              page: '184'
            }
          ],
          date_filed: '1973-03-05',
          docket: 'https://www.courtlistener.com/api/rest/v4/dockets/1828559/',
          sub_opinions: [
            'https://www.courtlistener.com/api/rest/v4/opinions/9516192/'
          ]
        });
      }

      if (urlText.includes('/api/rest/v4/opinions/9516192/')) {
        return createFetchResponse({
          html_with_citations:
            '<p>The case discusses the implied warranty of habitability in residential leases.</p>'
        });
      }

      if (urlText.includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: [
            {
              absolute_url: '/opinion/10677563/housing-auth-city-of-pgh/',
              caseName: 'Housing Auth. City of Pgh.',
              cluster_id: 10677563,
              court: 'Supreme Court of Pennsylvania',
              dateFiled: '2025-09-25',
              opinions: [
                {
                  snippet: 'Irrelevant housing authority result.'
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
              content:
                'Boston Housing Authority v. Hemingway is the retrieved CourtListener source.'
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
        userInput:
          'Does this case exist https://www.courtlistener.com/opinion/2000597/boston-housing-authority-v-hemingway/'
      });

    expect(response.statusCode).toBe(200);
    expect(fetchMock.mock.calls.some(([url]) =>
      String(url).includes('/api/rest/v4/clusters/2000597/')
    )).toBe(true);

    const sources = response.body.transcript.at(-1).meta.sources;

    expect(sources[0]).toEqual(
      expect.objectContaining({
        id: 'o-2000597',
        title: 'Boston Housing Authority vs. Ruth Hemingway (And a Companion Case)',
        url: 'https://www.courtlistener.com/opinion/2000597/boston-housing-authority-v-hemingway/',
        citations: ['363 Mass. 184']
      })
    );
    expect(sources[0].snippet).toContain('implied warranty of habitability');
  });

  it('uses CourtListener citation lookup before broad search for cited cases', async () => {
    fetchMock.mockImplementation(async (url) => {
      const urlText = String(url);

      if (urlText.includes('/api/rest/v4/citation-lookup/')) {
        return createFetchResponse([
          {
            citation: '371 Mass. 661',
            normalized_citations: ['371 Mass. 661'],
            status: 200,
            error_message: '',
            clusters: [
              {
                id: 2043647,
                case_name: 'McCue v. Prudential Insurance Co. of America',
                case_name_full:
                  'Marion McCue & Another vs. the Prudential Insurance Company of America',
                absolute_url:
                  '/opinion/2043647/mccue-v-prudential-insurance-co-of-america/',
                citations: [
                  {
                    volume: '371',
                    reporter: 'Mass.',
                    page: '659'
                  }
                ],
                date_filed: '1976-12-21',
                sub_opinions: []
              }
            ]
          }
        ]);
      }

      if (urlText.includes('/api/rest/v4/search/')) {
        return createFetchResponse({
          results: []
        });
      }

      return createFetchResponse({
        choices: [
          {
            message: {
              content:
                'The cited page resolves to McCue, not Boston Housing Authority v. Hemingway.'
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
        userInput:
          'Boston Housing Authority v. Hemenway, 371 Mass. 661 (1977)'
      });

    expect(response.statusCode).toBe(200);
    expect(fetchMock.mock.calls.some(([url]) =>
      String(url).includes('/api/rest/v4/citation-lookup/')
    )).toBe(true);
    expect(response.body.transcript.at(-1).meta.sources[0]).toEqual(
      expect.objectContaining({
        id: 'o-2043647',
        title:
          'Marion McCue & Another vs. the Prudential Insurance Company of America',
        citations: ['371 Mass. 659']
      })
    );
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
