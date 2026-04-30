import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import {
  fetchBootstrap,
  analyzeScenario,
  inventScenario,
  resetChat,
  resetScenario,
  submitChatTurn,
  submitTurn
} from './lib/api.js';

vi.mock('./lib/api.js', () => ({
  fetchBootstrap: vi.fn(),
  analyzeScenario: vi.fn(),
  inventScenario: vi.fn(),
  resetScenario: vi.fn(),
  submitTurn: vi.fn(),
  resetChat: vi.fn(),
  submitChatTurn: vi.fn()
}));

const STORAGE_KEY = 'legalsim.local.settings.v2';

const bootstrapFixture = {
  appMode: 'live',
  defaultScenarioId: 'traffic-stop-backpack-search',
  defaultProviderId: 'openai-compatible',
  scenarios: [
    {
      id: 'traffic-stop-backpack-search',
      title: 'Traffic Stop Backpack Search',
      summary:
        'Practice responding when an officer tries to search a backpack during a traffic stop.'
    },
    {
      id: 'knock-and-talk-home-entry',
      title: 'Knock And Talk Home Entry',
      summary:
        'Practice responding when officers knock at your door and try to turn a conversation into consent to enter.'
    }
  ],
  providers: [
    {
      id: 'openai-compatible',
      label: 'OpenAI-Compatible',
      description: 'OpenAI-style endpoint',
      builtIn: false,
      configured: false,
      defaultModel: 'gpt-4.1-mini',
      defaultBaseUrl: 'https://api.openai.com/v1',
      requiresApiKey: true,
      supportsCustomBaseUrl: true
    },
    {
      id: 'ollama',
      label: 'Ollama-Compatible',
      description: 'Local endpoint',
      builtIn: false,
      configured: true,
      defaultModel: 'llama3.2',
      defaultBaseUrl: 'http://localhost:11434',
      requiresApiKey: false,
      supportsCustomBaseUrl: true
    },
    {
      id: 'gemini',
      label: 'Gemini',
      description: 'Server-side Gemini',
      builtIn: true,
      configured: false,
      defaultModel: 'gemini-2.5-flash-lite',
      defaultBaseUrl: 'https://generativelanguage.googleapis.com',
      requiresApiKey: false,
      supportsCustomBaseUrl: false
    }
  ],
  providerStatus: {
    'openai-compatible': {
      configured: false,
      defaultModel: 'gpt-4.1-mini',
      defaultBaseUrl: 'https://api.openai.com/v1',
      requiresApiKey: true,
      supportsCustomBaseUrl: true,
      summary: 'Default base URL: https://api.openai.com/v1'
    },
    ollama: {
      configured: true,
      defaultModel: 'llama3.2',
      defaultBaseUrl: 'http://localhost:11434',
      requiresApiKey: false,
      supportsCustomBaseUrl: true,
      summary: 'Default base URL: http://localhost:11434'
    },
    gemini: {
      configured: false,
      defaultModel: 'gemini-2.5-flash-lite',
      defaultBaseUrl: 'https://generativelanguage.googleapis.com',
      requiresApiKey: false,
      supportsCustomBaseUrl: false,
      summary: 'Default base URL: https://generativelanguage.googleapis.com'
    }
  },
  courtlistenerStatus: {
    configured: false,
    defaultBaseUrl: 'https://www.courtlistener.com',
    supportsBrowserToken: true,
    summary: 'Default base URL: https://www.courtlistener.com'
  }
};

const resetFixture = {
  transcript: [
    {
      id: 'system-1',
      role: 'system',
      channel: 'system',
      content: 'Scenario reset: Traffic Stop Backpack Search.'
    },
    {
      id: 'scenario-1',
      role: 'assistant',
      channel: 'scenario',
      content: 'Ok, well, let\'s take a look inside that suspicious-looking backpack.'
    }
  ]
};

const chatResetFixture = {
  transcript: [
    {
      id: 'chat-system-1',
      role: 'system',
      channel: 'system',
      content: 'Legal research chat reset.'
    },
    {
      id: 'chat-assistant-1',
      role: 'assistant',
      channel: 'chat',
      content: 'Ask any legal question.'
    }
  ]
};

const generatedScenarioFixture = {
  id: 'generated-bus-sweep-consent',
  title: 'Bus Sweep Consent Search',
  summary: 'Practice responding when officers ask to search a bag during a bus sweep.',
  institutionalActor: 'police officer',
  seedPrompt:
    'An officer boards a bus and pressures the learner to consent to a bag search in a cramped setting.',
  legalFocus: ['consent under pressure', 'whether a reasonable person feels free to refuse'],
  analysisFocus: ['what undercuts voluntariness', 'what facts matter later'],
  scenarioFacts: ['The learner is seated on a bus.', 'The officer asks to inspect a bag.'],
  openingMessage:
    '"We are doing quick checks. Hand me the bag so I can take a look inside."'
};

function createMemoryStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true
    });
    fetchBootstrap.mockResolvedValue(bootstrapFixture);
    inventScenario.mockResolvedValue({
      scenario: generatedScenarioFixture,
      scenarioSummary: {
        id: generatedScenarioFixture.id,
        title: generatedScenarioFixture.title,
        summary: generatedScenarioFixture.summary
      }
    });
    resetScenario.mockResolvedValue(resetFixture);
    resetChat.mockResolvedValue(chatResetFixture);
    submitTurn.mockResolvedValue({
      transcript: [
        ...resetFixture.transcript,
        {
          id: 'user-1',
          role: 'user',
          channel: 'scenario',
          content: 'I do not consent to a search. What is your probable cause?'
        },
        {
          id: 'scenario-2',
          role: 'assistant',
          channel: 'scenario',
          content: 'The officer presses the issue and asks again for the bag.'
        }
      ]
    });
    analyzeScenario.mockResolvedValue({
      transcript: [
        ...resetFixture.transcript,
        {
          id: 'user-1',
          role: 'user',
          channel: 'scenario',
          content: 'I do not consent to a search. What is your probable cause?'
        },
        {
          id: 'scenario-2',
          role: 'assistant',
          channel: 'scenario',
          content: 'The officer presses the issue and asks again for the bag.'
        },
        {
          id: 'analysis-1',
          role: 'assistant',
          channel: 'analysis',
          content: [
            "## Officer's position",
            'The officer can argue reasonable suspicion under **Terry v. Ohio**.',
            '',
            "## User's position",
            'The user can argue fidgeting and location alone do not create probable cause for a backpack search.',
            '',
            '## How the cited cases apply',
            '- **Supports the user:** Terry requires more than a hunch before prolonging the stop.',
            '- **Supports the officer if facts change:** Acevedo would matter only if probable cause developed for the vehicle or container.',
            '',
            '## Authorities',
            '- **Terry v. Ohio**, 392 U.S. 1.',
            '- **California v. Acevedo**, 500 U.S. 565.',
            '',
            '## Notes',
            'This is educational information.'
          ].join('\n'),
          meta: {
            retrieval: {
              status: 'grounded',
              queriedTypes: ['o'],
              query: 'Terry v. Ohio automobile exception traffic stop'
            },
            sources: [
              {
                id: 'o-terry',
                type: 'o',
                title: 'Terry v. Ohio',
                url: 'https://www.courtlistener.com/opinion/1/terry-v-ohio/',
                downloadUrl: 'https://example.com/terry.pdf',
                court: 'Supreme Court of the United States',
                date: '1968-06-10',
                docketNumber: '67',
                citations: ['392 U.S. 1'],
                snippet: 'A brief investigatory <mark>stop</mark> may be justified.'
              },
              {
                id: 'o-acevedo',
                type: 'o',
                title: 'California v. Acevedo',
                url: 'https://www.courtlistener.com/opinion/2/california-v-acevedo/',
                downloadUrl: 'https://example.com/acevedo.pdf',
                court: 'Supreme Court of the United States',
                date: '1991-05-30',
                docketNumber: '89-1690',
                citations: ['500 U.S. 565'],
                snippet: 'The automobile exception can apply when probable cause supports a vehicle container search.'
              }
            ]
          }
        }
      ]
    });
    submitChatTurn.mockResolvedValue({
      transcript: [
        ...chatResetFixture.transcript,
        {
          id: 'chat-user-1',
          role: 'user',
          channel: 'chat',
          content: 'What is a Terry stop?'
        },
        {
          id: 'chat-assistant-2',
          role: 'assistant',
          channel: 'chat',
          content: 'Terry v. Ohio recognized a brief investigatory detention.',
          meta: {
            retrieval: {
              status: 'grounded',
              queriedTypes: ['o'],
              query: 'What is a Terry stop?'
            },
            sources: [
              {
                id: 'o-1',
                type: 'o',
                title: 'Terry v. Ohio',
                url: 'https://www.courtlistener.com/opinion/1/terry-v-ohio/',
                downloadUrl: 'https://example.com/terry.pdf',
                court: 'Supreme Court of the United States',
                date: '1968-06-10',
                docketNumber: '67',
                citations: ['392 U.S. 1'],
                snippet: 'A brief investigatory <mark>stop</mark> may be justified.'
              }
            ]
          }
        }
      ]
    });
  });

  it('loads a persisted API key from local storage', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeWorkspace: 'simulator',
        selectedScenarioId: 'traffic-stop-backpack-search',
        selectedProviderId: 'openai-compatible',
        serverDefaultProviderId: 'gemini',
        providerConfigs: {
          'openai-compatible': {
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'stored-key'
          }
        },
        providerModels: {
          'openai-compatible': 'gpt-4.1-mini'
        },
        inventedScenarios: [],
        courtlistenerConfig: {
          apiToken: ''
        }
      })
    );

    render(<App />);

    const apiKeyInputs = await screen.findAllByDisplayValue('stored-key');

    expect(apiKeyInputs).toHaveLength(2);

    await waitFor(() => {
      expect(resetScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          providerConfig: {
            apiKey: 'stored-key',
            baseUrl: 'https://api.openai.com/v1'
          }
        })
      );
    });
  });

  it('continues simulator roleplay turns until the user requests legal analysis', async () => {
    render(<App />);

    const apiKeyInput = (await screen.findAllByPlaceholderText(
      /Paste an API key to continue/i
    ))[0];
    const textarea = await screen.findByPlaceholderText(/Type how you would respond to the officer/i);

    fireEvent.change(apiKeyInput, {
      target: {
        value: 'sk-test'
      }
    });

    fireEvent.change(textarea, {
      target: {
        value: 'I do not consent to a search. What is your probable cause?'
      }
    });

    fireEvent.click(screen.getByRole('button', { name: /Send Turn/i }));

    expect(await screen.findByText(/The officer presses the issue/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Next$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Turn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Legal Analysis/i })).toBeInTheDocument();
    expect(submitTurn).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY)).providerConfigs[
        'openai-compatible'
      ].apiKey
    ).toBe('sk-test');

    submitTurn.mockResolvedValueOnce({
      transcript: [
        ...resetFixture.transcript,
        {
          id: 'user-1',
          role: 'user',
          channel: 'scenario',
          content: 'I do not consent to a search. What is your probable cause?'
        },
        {
          id: 'scenario-2',
          role: 'assistant',
          channel: 'scenario',
          content: 'The officer presses the issue and asks again for the bag.'
        },
        {
          id: 'user-2',
          role: 'user',
          channel: 'scenario',
          content: 'I am not agreeing. Am I free to leave?'
        },
        {
          id: 'scenario-3',
          role: 'assistant',
          channel: 'scenario',
          content: 'The officer shifts tactics but keeps the stop going.'
        }
      ]
    });

    const nextTextarea = await screen.findByPlaceholderText(/Type how you would respond to the officer/i);

    fireEvent.change(nextTextarea, {
      target: {
        value: 'I am not agreeing. Am I free to leave?'
      }
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Turn/i }));

    expect(await screen.findByText(/keeps the stop going/i)).toBeInTheDocument();
    expect(submitTurn).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: /Legal Analysis/i }));

    await waitFor(() => {
      expect(analyzeScenario).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/Officer's position/i)).toBeInTheDocument();
    expect(await screen.findByText(/How the cited cases apply/i)).toBeInTheDocument();
    expect(await screen.findByText(/Supports the user/i)).toBeInTheDocument();
    expect(await screen.findByText(/Grounded in CourtListener/i)).toBeInTheDocument();
    expect(await screen.findAllByText(/California v\. Acevedo/i)).toHaveLength(2);
    expect(await screen.findAllByRole('link', { name: /Read Full Case/i })).toHaveLength(2);
  });

  it('lets remote users use a server-configured provider without entering a browser API key', async () => {
    fetchBootstrap.mockResolvedValueOnce({
      ...bootstrapFixture,
      defaultProviderId: 'gemini',
      providers: bootstrapFixture.providers.map((provider) =>
        provider.id === 'gemini'
          ? {
              ...provider,
              configured: true
            }
          : provider
      ),
      providerStatus: {
        ...bootstrapFixture.providerStatus,
        gemini: {
          ...bootstrapFixture.providerStatus.gemini,
          configured: true
        }
      }
    });

    render(<App />);

    const textarea = await screen.findByPlaceholderText(
      /Type how you would respond to the officer/i
    );

    expect(
      screen.queryByText(/Enter an API key to continue with this provider/i)
    ).not.toBeInTheDocument();
    expect(
      await screen.findAllByText(/Server default auth: available/i)
    ).toHaveLength(2);
    expect(
      screen.getAllByText(/This browser can leave the API key field blank and use the server default auth/i)
    ).toHaveLength(2);
    expect(
      screen.getAllByPlaceholderText(/Optional Gemini API key override/i)
    ).toHaveLength(2);

    fireEvent.change(textarea, {
      target: {
        value: 'I do not consent to a search.'
      }
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Turn/i }));

    await waitFor(() => {
      expect(submitTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'gemini',
          providerConfig: expect.objectContaining({
            apiKey: ''
          })
        })
      );
    });
  });

  it('prefers the current server default provider over an old persisted provider selection', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeWorkspace: 'simulator',
        selectedScenarioId: 'traffic-stop-backpack-search',
        selectedProviderId: 'openai-compatible',
        providerConfigs: {
          'openai-compatible': {
            baseUrl: 'https://api.openai.com/v1',
            apiKey: ''
          }
        },
        providerModels: {
          'openai-compatible': 'gpt-4.1-mini',
          gemini: 'gemini-1.5-flash'
        },
        inventedScenarios: [],
        courtlistenerConfig: {
          apiToken: ''
        }
      })
    );
    fetchBootstrap.mockResolvedValueOnce({
      ...bootstrapFixture,
      defaultProviderId: 'gemini',
      providers: bootstrapFixture.providers.map((provider) =>
        provider.id === 'gemini'
          ? {
              ...provider,
              configured: true,
              defaultModel: 'gemini-2.5-flash-lite'
            }
          : provider
      ),
      providerStatus: {
        ...bootstrapFixture.providerStatus,
        gemini: {
          ...bootstrapFixture.providerStatus.gemini,
          configured: true,
          defaultModel: 'gemini-2.5-flash-lite'
        }
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(resetScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'gemini',
          model: 'gemini-2.5-flash-lite',
          providerConfig: expect.objectContaining({
            apiKey: ''
          })
        })
      );
    });
  });

  it('enables send turn when provider metadata says the server key is configured', async () => {
    fetchBootstrap.mockResolvedValueOnce({
      ...bootstrapFixture,
      defaultProviderId: 'openai-compatible',
      providers: bootstrapFixture.providers.map((provider) =>
        provider.id === 'openai-compatible'
          ? {
              ...provider,
              configured: true,
              defaultBaseUrl: 'https://openrouter.ai/api/v1',
              defaultModel: 'openrouter/free'
            }
          : provider
      ),
      providerStatus: {}
    });

    render(<App />);

    const textarea = await screen.findByPlaceholderText(
      /Type how you would respond to the officer/i
    );

    fireEvent.change(textarea, {
      target: {
        value: 'I do not consent to a search.'
      }
    });

    expect(screen.getByRole('button', { name: /Send Turn/i })).toBeEnabled();
  });

  it('can invent a new scenario from the simulator sidebar', async () => {
    render(<App />);

    const apiKeyInput = (await screen.findAllByPlaceholderText(
      /Paste an API key to continue/i
    ))[0];
    const ideaInput = await screen.findByPlaceholderText(/Optional idea: prolonged stop/i);

    fireEvent.change(apiKeyInput, {
      target: {
        value: 'sk-test'
      }
    });

    fireEvent.change(ideaInput, {
      target: {
        value: 'bus sweep consent search'
      }
    });

    fireEvent.click(screen.getByRole('button', { name: /Invent Scenario/i }));

    await waitFor(() => {
      expect(inventScenario).toHaveBeenCalledTimes(1);
      expect(resetScenario).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByDisplayValue('Bus Sweep Consent Search')
    ).toBeInTheDocument();
  });

  it('shares provider settings across tabs and submits a legal research turn with a stored courtlistener token', async () => {
    render(<App />);

    const apiKeyInput = (await screen.findAllByPlaceholderText(
      /Paste an API key to continue/i
    ))[0];

    fireEvent.change(apiKeyInput, {
      target: {
        value: 'sk-test'
      }
    });

    fireEvent.click(screen.getByRole('button', { name: /Legal Research/i }));

    expect(await screen.findAllByDisplayValue('sk-test')).toHaveLength(2);

    const courtListenerInput = await screen.findByPlaceholderText(
      /override the server default/i
    );

    fireEvent.change(courtListenerInput, {
      target: {
        value: 'cl-token'
      }
    });

    const researchTextarea = await screen.findByPlaceholderText(
      /Ask any legal question/i
    );

    fireEvent.change(researchTextarea, {
      target: {
        value: 'What is a Terry stop?'
      }
    });

    fireEvent.click(screen.getByRole('button', { name: /Ask Question/i }));

    await waitFor(() => {
      expect(submitChatTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          providerConfig: {
            apiKey: 'sk-test',
            baseUrl: 'https://api.openai.com/v1'
          },
          courtlistenerConfig: {
            apiToken: 'cl-token'
          }
        })
      );
    });

    expect(await screen.findByText(/Grounded in CourtListener/i)).toBeInTheDocument();
    expect(await screen.findAllByText(/Terry v. Ohio/i)).toHaveLength(2);
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY)).courtlistenerConfig.apiToken
    ).toBe('cl-token');
  });
});
