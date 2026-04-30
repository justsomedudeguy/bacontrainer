# Bacontrainer Spec

## Overview

Bacontrainer is a two-workspace educational application:

- a simulator workspace for practicing police-encounter dialogue
- a research workspace for open-ended legal questions grounded in CourtListener when possible

The MVP is intentionally narrow. It favors a small number of hardcoded, high-signal experiences over broad legal coverage or heavy platform infrastructure.

## Product Goals

- Teach legal literacy through interactive, scenario-based practice.
- Keep the simulator conversational and easy to reset.
- Separate roleplay from explanation so the user sees both the encounter and the doctrine.
- Let users experiment with multiple LLM providers without changing code.
- Support lightweight legal research without requiring a full internal retrieval stack.

## Non-Goals

- Providing legal advice
- Replacing attorney review
- Building a general-purpose case management product
- Shipping user accounts, multi-user collaboration, or server-side persistence
- Implementing a CMS for scenario authoring in the current MVP
- Adding vector search, embeddings, or voice features

## Primary User Experience

### Simulator Workflow

1. The app loads bootstrap data from `GET /api/bootstrap`.
2. The simulator workspace selects a scenario and provider.
3. `POST /api/simulator/reset` returns the opening transcript.
4. The user types a response to the officer or institutional actor.
5. `POST /api/simulator/turn` returns an in-character scenario reply plus a separate analysis reply on the `analysis` transcript channel.
6. The UI requires an explicit `Next` click before the user can send another turn.
7. The user can reset the scenario or generate a new one from a prompt idea.

### Research Workflow

1. The app initializes a separate research transcript with `POST /api/chat/reset`.
2. The user submits an open-ended legal question.
3. The backend queries CourtListener using lightweight intent routing.
4. Retrieved sources are normalized and attached to assistant message metadata.
5. `POST /api/chat/turn` returns the updated transcript with the answer and retrieval metadata.

## Scope Of The Current MVP

- Two built-in simulator scenarios
- Runtime scenario generation through the selected LLM
- Three provider integrations: `openai-compatible`, `ollama`, and `gemini`
- Browser persistence for workspace selection, scenario selection, provider settings, model selection, generated scenarios, and CourtListener token override
- No database or server-side scenario storage

## System Architecture

### Frontend

Location: `frontend/src`

Responsibilities:

- fetch bootstrap data
- manage selected workspace, scenario, provider, model, and runtime credentials
- persist client-side settings and generated scenarios
- render simulator and research transcripts
- enforce the `Next` gate after each simulator turn
- submit reset, turn, and scenario invention requests

Key modules:

- `App.jsx`
- `features/simulator/useSimulatorWorkspace.js`
- `features/research/useLegalResearchWorkspace.js`
- `lib/api.js`

### Backend

Location: `backend/src`

Responsibilities:

- expose bootstrap, simulator, chat, and health routes
- resolve and validate provider/model/runtime config
- orchestrate simulator and research workflows
- call CourtListener
- normalize errors into JSON responses

Key modules:

- `app.js`
- `services/SimulatorService.js`
- `services/LegalResearchService.js`
- `services/CourtListenerService.js`
- `services/CourtListenerClient.js`

### Shared Package

Location: `shared/src`

Responsibilities:

- provider identifiers
- scenario summaries
- transcript message schema
- shared request/response typedefs

## Functional Requirements

### Bootstrap

Route: `GET /api/bootstrap`

Must return:

- `appMode`
- `defaultScenarioId`
- `defaultProviderId`
- built-in scenario summaries
- provider options
- provider status
- CourtListener status

### Simulator Reset

Route: `POST /api/simulator/reset`

Input:

- `scenarioId`
- optional generated `scenario`
- `providerId`
- `model`
- optional `providerConfig`

Behavior:

- resolve the selected or provided scenario
- resolve the provider adapter
- determine the effective model
- return a transcript containing a system reset message and the scenario opening message

### Simulator Turn

Route: `POST /api/simulator/turn`

Input:

- `scenarioId`
- optional generated `scenario`
- `providerId`
- `model`
- `transcript`
- `userInput`
- optional `providerConfig`

Behavior:

1. Validate `userInput`.
2. Sanitize transcript entries.
3. Append the user message on the `scenario` channel.
4. Remove `analysis` messages from the roleplay prompt context.
5. Generate the in-character scenario reply.
6. Append the scenario reply to the transcript.
7. Generate a second analysis reply from the same provider/model.
8. Ensure the analysis has the expected teaching headings, adding fallback headings when missing.
9. Return the updated transcript.

### Scenario Invention

Route: `POST /api/simulator/invent-scenario`

Input:

- `providerId`
- `model`
- optional `providerConfig`
- optional `promptIdea`

Behavior:

- prompt the selected model to return scenario JSON
- parse JSON from raw or fenced output
- normalize the scenario definition
- force generated scenario IDs to use the `generated-` prefix
- return the full scenario plus summary data

Constraint:

- generated scenarios are not stored on the server

### Research Reset

Route: `POST /api/chat/reset`

Input:

- optional `providerId`
- optional `model`

Behavior:

- resolve provider and effective model
- return a fresh transcript containing a system reset message and an assistant message describing the research capability

### Research Turn

Route: `POST /api/chat/turn`

Input:

- `providerId`
- `model`
- `transcript`
- `userInput`
- optional `providerConfig`
- optional `courtlistenerConfig`

Behavior:

1. Validate `userInput`.
2. Sanitize transcript and remove `system` channel messages from prompt context.
3. Append the user message on the `chat` channel.
4. Retrieve CourtListener sources based on the query.
5. Build a research system prompt with retrieval status and sources.
6. Generate the assistant answer.
7. Attach retrieval metadata and normalized sources to the assistant message.

## Provider Model

Supported provider IDs:

- `openai-compatible`
- `ollama`
- `gemini`

Provider requirements:

- OpenAI-compatible requires an API key unless one is already configured server-side.
- Gemini uses a browser-entered Gemini API key when one is present.
- Gemini uses Vertex AI as the server default when `GEMINI_VERTEX_PROJECT` or `GOOGLE_CLOUD_PROJECT` identifies the Vertex AI project.
- Gemini uses server-side `GEMINI_API_KEY` only as a fallback when Vertex project configuration is absent.
- Ollama does not require an API key by default.

Provider runtime configuration shape:

```json
{
  "baseUrl": "string",
  "apiKey": "string"
}
```

Configuration rules:

- runtime values from the UI are trimmed and sanitized
- empty values are ignored
- model falls back to the provider's configured default when omitted

## Scenario Model

Generated and built-in scenario definitions share the same normalized shape:

```json
{
  "id": "string",
  "title": "string",
  "summary": "string",
  "institutionalActor": "string",
  "seedPrompt": "string",
  "legalFocus": ["string"],
  "analysisFocus": ["string"],
  "scenarioFacts": ["string"],
  "openingMessage": "string"
}
```

Required fields:

- `title`
- `summary`
- `seedPrompt`
- `openingMessage`
- `legalFocus`
- `analysisFocus`
- `scenarioFacts`

Normalization rules:

- arrays must contain at least one non-empty string
- generated IDs are slugified and prefixed with `generated-`
- `institutionalActor` defaults to `police officer` when omitted

## Transcript Model

Shared transcript message shape:

```json
{
  "id": "string",
  "role": "assistant | user | system",
  "channel": "scenario | analysis | chat | system",
  "content": "string",
  "meta": {}
}
```

Channel usage:

- `scenario`: live roleplay messages
- `analysis`: post-turn doctrinal explainer
- `chat`: legal research chat messages
- `system`: reset and runtime status messages

Important behavior:

- simulator prompts exclude prior `analysis` messages
- research prompts exclude `system` messages
- display transcripts keep those messages visible to the user

## CourtListener Retrieval

CourtListener base endpoint:

- `/api/rest/v4/search/`

Current retrieval routing is heuristic and query-driven. The backend maps the user's question to one or more source types:

- `o`: opinions
- `r`: RECAP or federal case file results
- `rd`: RECAP documents
- `d`: dockets
- `p`: judges
- `oa`: oral arguments

Routing examples:

- judge-style questions prefer `p`
- oral-argument questions prefer `oa`
- docket questions prefer `d`
- filing questions prefer `rd`
- general doctrinal questions prefer `o`

Retrieval result statuses:

- `grounded`
- `no-results`
- `unauthorized`
- `rate-limited`
- `unavailable`

Source limits:

- up to 3 results per searched type
- up to 6 final sources attached to the response

## Persistence

Client-side persistence stores:

- active workspace
- selected scenario ID
- selected provider ID
- server default provider ID
- provider config
- provider model selections
- provider default snapshots used to migrate stale browser defaults
- generated scenarios
- CourtListener browser token override

Persistence boundary:

- data is stored locally in the browser
- the backend does not persist user sessions, transcripts, or generated scenarios

## Error Handling

Backend behavior:

- domain errors use `HttpError`
- error middleware returns JSON with `error` and optional `details`
- missing provider API keys return HTTP 400 with `Enter an API key to continue.`
- missing Vertex AI project configuration for Gemini returns HTTP 400
- upstream CourtListener failures are translated to a backend 502 with classified retrieval status

Frontend behavior:

- request failures surface as banner errors
- provider-dependent actions are blocked when an API key is required but missing
- simulator status text reflects initialization, reset, submit, and invention states

## Environment Configuration

Defined in `.env.example` and loaded from the repo root `.env`.

Supported variables:

- `PORT`
- `FRONTEND_ORIGIN`
- `APP_MODE`
- `DEFAULT_PROVIDER`
- `COURTLISTENER_BASE_URL`
- `COURTLISTENER_API_TOKEN`
- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `OPENAI_COMPATIBLE_MODEL`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `GEMINI_BASE_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_VERTEX_PROJECT`
- `GEMINI_VERTEX_LOCATION`

`GEMINI_VERTEX_PROJECT` falls back to common Google Cloud project environment variables, including `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT`, `GCP_PROJECT`, and `PROJECT_ID`.

The default Gemini model is `gemini-2.5-flash-lite`, which is the low-cost Vertex-supported Flash model used when no explicit `GEMINI_MODEL` is set.

## Current Constraints And Risks

- The legal domain coverage is intentionally narrow.
- Retrieval quality depends on simple intent classification plus CourtListener availability.
- Scenario invention depends on model compliance with the expected JSON contract.
- There is no authentication, rate limiting, audit logging, or persistent storage layer.
- The frontend and backend assume a trusted local-development style environment.

## Near-Term Extension Points

- add more built-in scenarios
- improve structured validation for generated scenarios
- persist transcripts and generated scenarios server-side
- expand retrieval strategies and source ranking
- add stronger testing around provider adapters and prompt contracts
- introduce admin tooling or a scenario authoring workflow
