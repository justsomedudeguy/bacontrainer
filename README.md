# Bacontrainer
<img width="1254" height="1254" alt="image" src="https://github.com/user-attachments/assets/aa14c812-0f80-4e79-82c6-c2246ebfdbcb" />


Bacontrainer is a text-first educational app for practicing police-encounter conversations and then reviewing a separate legal explainer. The current MVP is focused on Fourth Amendment scenarios and includes an independent legal research workspace that can ground answers in CourtListener results when sources are available.

This project is for legal literacy and simulation. It does not provide legal advice.

## What The App Does

- Runs live police-encounter roleplay in the browser.
- Lets the user send repeated roleplay turns before asking for legal analysis.
- Provides a separate `Legal Analysis` action that runs outside the roleplay flow.
- Grounds simulator analysis and research answers in CourtListener when retrieval succeeds.
- Renders retrieved CourtListener metadata and source links with assistant messages.
- Resets into a fresh opening scene for the selected scenario.
- Supports built-in scenarios plus LLM-generated scenarios created from a prompt idea.
- Includes a separate legal research chat workspace.
- Lets the user switch providers, models, base URLs, and API keys from the UI.
- Persists browser-entered provider settings, API keys, selected workspace, CourtListener token override, and generated scenarios locally.
- Writes local redacted JSONL usage logs for user queries, provider calls, CourtListener retrieval, and generated responses.

## Current MVP Scope

- The simulator is intentionally narrow and centered on police-overreach teaching scenarios.
- Built-in scenarios are hardcoded in the backend catalog.
- Generated scenarios are returned to the client and stored client-side.
- Legal-analysis jobs are short-lived in-memory backend jobs.
- There is no database, auth layer, CMS, vector store, or voice pipeline in the current version.

## Built-In Scenarios

- `traffic-stop-backpack-search`
- `knock-and-talk-home-entry`

## How It Works

### Simulator Workspace

1. The frontend calls `POST /api/simulator/reset` to start a scenario.
2. The backend returns a transcript with a system reset message and the opening scenario message.
3. On each roleplay turn, the frontend sends the current transcript plus the user's response to `POST /api/simulator/turn`.
4. The backend appends the user turn, filters out prior analysis messages, and requests an in-character reply from the selected model.
5. When the user clicks `Legal Analysis`, the frontend starts an async job with `POST /api/simulator/analyze-jobs` and polls the returned status URL.
6. The analysis job queries CourtListener for relevant authority, asks the selected model for a structured explainer, and appends the result on the `analysis` transcript channel.
7. Analysis messages stay visible in the transcript, but they are filtered out of later roleplay prompts so the scenario call stays in character.

### Research Workspace

1. The frontend calls `POST /api/chat/reset` to initialize an independent research transcript.
2. When the user asks a question, the backend routes the query across CourtListener source types based on simple intent rules.
3. CourtListener sources are normalized and attached to the assistant message metadata.
4. The legal research prompt includes retrieval status and any returned sources before the model generates its answer.

## Stack

- `frontend`: React 18, Vite, Tailwind CSS
- `backend`: Express 4, plain JavaScript ESM
- `shared`: shared constants and request/response shapes used by both apps

## Project Structure

```text
bacontrainer/
|-- backend/
|   `-- src/
|       |-- config/
|       |-- prompts/
|       |-- providers/
|       |-- routes/
|       |-- scenarios/
|       `-- services/
|-- frontend/
|   `-- src/
|       |-- components/
|       |-- features/
|       |-- lib/
|       `-- styles/
|-- shared/
|   `-- src/
|-- .env.example
|-- package.json
|-- README.md
`-- spec.md
```

## Quick Start

### Requirements

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Configure

Copy `.env.example` to `.env` if you want to override the defaults.

You can provide API keys in either place:

- server-side through `.env`
- client-side through the browser UI

Browser-entered keys and generated scenarios are stored locally in browser storage on the current machine.

### Run

```bash
npm run dev
```

This starts:

- backend on `http://localhost:4000`
- frontend on `http://localhost:5173`

### Test

```bash
npm test
```

### Build

```bash
npm run build
```

The frontend produces a Vite build. The backend and shared packages are source-only and currently report that no build step is required.

## Workspace Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Runs backend and frontend together from the repo root |
| `npm run build` | Runs workspace build scripts |
| `npm test` | Runs backend and frontend test suites |
| `npm run dev --workspace backend` | Starts the Express API in watch mode |
| `npm run dev --workspace frontend` | Starts the Vite frontend |

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port |
| `FRONTEND_ORIGIN` | Allowed frontend origin for CORS |
| `APP_MODE` | Runtime label displayed in the UI |
| `USAGE_LOG_DIRECTORY` | Directory for redacted local usage JSONL logs |
| `DEFAULT_PROVIDER` | Initial provider shown in the UI |
| `COURTLISTENER_BASE_URL` | Base URL for CourtListener search |
| `COURTLISTENER_API_TOKEN` | Optional server-side CourtListener token |
| `OPENAI_COMPATIBLE_BASE_URL` | Default base URL for OpenAI-style providers |
| `OPENAI_COMPATIBLE_API_KEY` | Optional server-side default API key |
| `OPENAI_COMPATIBLE_MODEL` | Default OpenAI-compatible model |
| `OLLAMA_BASE_URL` | Default Ollama base URL |
| `OLLAMA_MODEL` | Default Ollama model |
| `GEMINI_BASE_URL` | Default Gemini API base URL |
| `GEMINI_API_KEY` | Optional server-side Gemini API key |
| `GEMINI_MODEL` | Default Gemini model |

## API Overview

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/bootstrap` | Initial app state, providers, scenarios, CourtListener status |
| `POST` | `/api/simulator/reset` | Start or restart a simulator transcript |
| `POST` | `/api/simulator/turn` | Submit a simulator roleplay turn and get the in-character reply |
| `POST` | `/api/simulator/analyze` | Generate simulator legal analysis synchronously |
| `POST` | `/api/simulator/analyze-jobs` | Start an async simulator legal-analysis job |
| `GET` | `/api/simulator/analyze-jobs/:jobId` | Poll async legal-analysis job status and result |
| `POST` | `/api/simulator/invent-scenario` | Generate a new scenario from a prompt idea |
| `POST` | `/api/chat/reset` | Start a new legal research chat |
| `POST` | `/api/chat/turn` | Submit a legal research question |

## Key Source Files

- `backend/src/services/SimulatorService.js`: simulator turn orchestration
- `backend/src/services/AnalysisJobService.js`: in-memory async legal-analysis jobs
- `backend/src/services/LegalResearchService.js`: research chat orchestration
- `backend/src/services/CourtListenerService.js`: retrieval routing and source normalization
- `backend/src/services/UsageLoggerService.js`: redacted local usage logging
- `backend/src/scenarios/catalog.js`: built-in scenario catalog and generated scenario normalization
- `frontend/src/App.jsx`: top-level app state, bootstrap, persistence, workspace switching
- `frontend/src/features/simulator/useSimulatorWorkspace.js`: simulator workspace state and requests
- `frontend/src/features/research/useLegalResearchWorkspace.js`: research workspace state and requests
- `frontend/src/lib/api.js`: frontend API client and analysis job polling
- `frontend/src/lib/providerState.js`: provider default and stale browser-state normalization
- `shared/src/simulator.js`: transcript and API shape definitions

## Limitations

- The scenario system is limited to the current Fourth Amendment-focused MVP.
- Scenario generation relies on the selected model returning valid JSON.
- Retrieval is based on lightweight intent routing and CourtListener availability.
- Generated scenarios are not persisted on the server.
- Async legal-analysis jobs are stored in memory and expire after a short retention window.
- Usage logs are local JSONL files with obvious secret fields redacted; they are not a full audit or observability system.

## More Detail

See [spec.md](spec.md) for the deeper product, architecture, and data-model reference. This README is the front-door summary of the current source snapshot.
