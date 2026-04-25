# vfs-demo

`vfs-demo` is a local AI filesystem assistant demo.

It combines:
- a Bun + Elysia backend
- a virtual filesystem (VFS) with role-based policies
- an AI agent with filesystem tools (`ls`, `cat`, `grep`, `find`, `write`, `mkdir`, `rm`)
- a Vite + React chat UI that streams tool usage in real time

## What this system does

You ask normal-language questions (for example about space facts), and the agent answers by using VFS tools against mounted knowledge files.

The UI shows:
- tool calls as they happen (`tool-start`, `tool-result`, `tool-error`)
- assistant thinking trace
- final plain-text response

This makes the agent behavior inspectable instead of opaque.

## Why this matters

Without tool-grounded behavior, chat agents often hallucinate or skip source verification. This system makes answers traceable to concrete file operations.

Examples:
- **Customer support copilot**: answer policy questions from internal docs and show exactly which files/lines were used.
- **Ops runbook assistant**: search incident notes with `grep`, summarize findings, and write follow-up notes to `/workspace`.
- **Compliance/audit workflows**: keep an auditable trail of read/write actions per user and tenant.
- **Research assistant over local notes**: ask natural-language questions while keeping data local under `/kb`.
- **Agent debugging**: see in real time whether the model actually used `grep`/`cat` or tried to answer from memory.

## Costs and cost control

There are two main cost buckets:

- **Model/API cost**: each `/chat/agent` request uses LLM tokens; longer prompts, longer outputs, and extra tool loops increase usage.
- **Runtime cost**: CPU/memory for Bun + UI + container runtime, plus SQLite storage (typically low for this demo).

Why this architecture helps control cost:

- **No mandatory embeddings/vector DB in core**: avoids indexing pipelines and vector storage as baseline cost.
- **Tool-grounded retrieval from local files**: the agent can read exactly what it needs instead of sending large context blindly.
- **Step limit (`stopWhen`)**: caps agent tool loop length to prevent runaway token/tool usage.
- **Local KB files**: knowledge can live in `data/kb` without external retrieval fees.

Practical cost tips:

- Keep prompts short and specific.
- Keep KB files concise and split by topic for targeted `grep`/`cat`.
- Use smaller/faster models for routine queries; reserve larger models for hard tasks.
- Monitor average tool steps per request and lower step limits if needed.

## Filesystem model

Virtual roots:
- `/kb` = read-only knowledge base loaded from `data/kb`
- `/workspace`, `/memory`, `/scratch` = writable tenant-scoped roots (stored in SQLite)
- `/tools` = virtual tool namespace

Access model:
- `viewer` can read
- `editor` and `admin` can write in writable roots
- writes to `/kb` are blocked

## Main API endpoints

Health:
- `GET /health/live`
- `GET /health/ready`

Tool API:
- `POST /tools/ls`
- `POST /tools/cat`
- `POST /tools/grep`
- `POST /tools/find`
- `POST /tools/write`
- `POST /tools/mkdir`
- `POST /tools/rm`

Agent API:
- `POST /chat/agent` (non-streaming JSON response)
- `POST /chat/agent/stream` (NDJSON streaming events for live UI updates)

## Run with Docker

```bash
docker compose up -d --build
```

App URL:
- `http://localhost:3000`

## Run without Docker

Install dependencies:

```bash
pnpm install
```

Build UI:

```bash
pnpm run build:ui
```

Run backend:

```bash
pnpm run start
```

Optional frontend dev server:

```bash
pnpm run dev:ui
```

## Quick API examples

List root:

```bash
curl -X POST http://localhost:3000/tools/ls \
  -H "content-type: application/json" \
  -d "{\"path\":\"/\"}"
```

Read KB file:

```bash
curl -X POST http://localhost:3000/tools/cat \
  -H "content-type: application/json" \
  -d "{\"path\":\"/kb/space/missions.md\"}"
```

Ask the agent:

```bash
curl -X POST http://localhost:3000/chat/agent \
  -H "content-type: application/json" \
  -d "{\"message\":\"What year did Apollo 11 land on the Moon?\"}"
```

## Notes

- `/kb` content is loaded from disk at server start.
- If you change files under `data/kb`, restart/rebuild the app to ensure runtime sees updates.
