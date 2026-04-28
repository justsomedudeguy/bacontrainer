# Bacontrainer

Bacontrainer is a text-first educational app for practicing police-encounter conversations and then reviewing a separate legal explainer. The current MVP is focused on Fourth Amendment scenarios and includes an independent legal research workspace that can ground answers in CourtListener results when sources are available.

This project is for legal literacy and simulation. It does not provide legal advice.

## What The App Does

- Runs live scenario roleplay in the browser.
- Makes two model calls for each simulator turn:
  - an in-character police response
  - a separate legal analysis response
- Pauses after each completed turn until the user clicks `Next`.
- Resets into a fresh opening scene for the selected scenario.
- Supports built-in scenarios plus LLM-generated scenarios created from a prompt idea.
- Includes a separate legal research chat workspace.
- Grounds research answers in CourtListener when retrieval succeeds.
- Lets the user switch providers, models, base URLs, and API keys from the UI.
- Persists browser-entered provider settings, API keys, selected workspace, and generated scenarios locally.

## Current MVP Scope

- The simulator is intentionally narrow and centered on police-overreach teaching scenarios.
- Built-in scenarios are hardcoded in the backend catalog.
- Generated scenarios are returned to the client and stored client-side.
- There is no database, auth layer, CMS, vector store, or voice pipeline in the current version.

## Built-In Scenarios

- `traffic-stop-backpack-search`
- `knock-and-talk-home-entry`

## How It Works

### Simulator Workspace

1. The frontend calls `POST /api/simulator/reset` to start a scenario.
2. The backend returns a transcript with a system reset message and the opening scenario message.
3. On each turn, the frontend sends the current transcript plus the user's response to `POST /api/simulator/turn`.
4. The backend appends the user turn, requests an in-character reply from the selected model, then requests a second out-of-character analysis response.
5. Analysis messages stay visible in the transcript, but they are filtered out of later roleplay prompts so the scenario call stays in character.
6. The UI blocks additional turns until the user clicks `Next`.

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
| `POST` | `/api/simulator/turn` | Submit a simulator turn and get scenario + analysis replies |
| `POST` | `/api/simulator/invent-scenario` | Generate a new scenario from a prompt idea |
| `POST` | `/api/chat/reset` | Start a new legal research chat |
| `POST` | `/api/chat/turn` | Submit a legal research question |

## Key Source Files

- `backend/src/services/SimulatorService.js`: simulator turn orchestration
- `backend/src/services/LegalResearchService.js`: research chat orchestration
- `backend/src/services/CourtListenerService.js`: retrieval routing and source normalization
- `backend/src/scenarios/catalog.js`: built-in scenario catalog and generated scenario normalization
- `frontend/src/App.jsx`: top-level app state, bootstrap, persistence, workspace switching
- `frontend/src/features/simulator/useSimulatorWorkspace.js`: simulator workspace state and requests
- `frontend/src/features/research/useLegalResearchWorkspace.js`: research workspace state and requests
- `shared/src/simulator.js`: transcript and API shape definitions

## Limitations

- The scenario system is limited to the current Fourth Amendment-focused MVP.
- Scenario generation relies on the selected model returning valid JSON.
- Retrieval is based on lightweight intent routing and CourtListener availability.
- Generated scenarios are not persisted on the server.

## More Detail

See [spec.md](spec.md) for the product spec, technical behavior, data model, and current design constraints.
