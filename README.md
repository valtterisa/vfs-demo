# agent-fs-control-plane

AI agent architecture pattern for cheaper, exact, auditable data operations at scale.

## The point

Use semantic retrieval to narrow candidates, then deterministic tools to do exact work.

- Semantic search is good for discovery.
- Deterministic tools are good for exact matches and writes.

This reduces wasted model/tool loops and improves reliability. You do not need per-task VMs or heavyweight sandbox orchestration anymore after this.

## Money-first (realistic)

At scale, biggest costs are model tokens, retries, retrieval misses, and ops/debug overhead.

Typical improvement ranges teams target with this pattern:

- `10-25%` lower token spend (better routing + fewer failed loops)
- `15-35%` lower retrieval/cache waste (deterministic path access)
- `20-40%` lower ops toil (auditable runs, easier debugging)

Realistic combined annual savings in mature programs: often `20-35%` total platform spend.  
This is not automatic; results depend on baseline quality and rollout execution.

### Example numbers

If baseline is `$5.0M/year`:

- model: `$3.2M`
- retrieval/cache: `$1.1M`
- ops overhead: `$0.7M`

After improvements:

- model: `$2.62M`
- retrieval/cache: `$0.86M`
- ops: `$0.50M`
- total: `$3.98M` (`$1.02M/year` saved, `20.4%`)

## RAG vs this pattern

- Plain RAG: more flexible, less predictable.
- This pattern: more predictable, more auditable, better for exact operations.

Best practice is hybrid:

- RAG for discovery
- deterministic tools for exact read/write actions

## What this demo includes

- `Bun` + `Elysia` API
- `Qdrant` (`/kb` read-heavy knowledge)
- `SQLite` (`/workspace`, `/memory`, `/scratch` writable state)
- `Redis` cache
- `AI SDK ToolLoopAgent` + `just-bash`

## Virtual filesystem model

- `/kb` = read-only knowledge
- `/workspace`, `/memory`, `/scratch` = writable tenant-scoped areas

## Run locally

Set `ANTHROPIC_API_KEY` in `.env.local`, then:

```bash
docker compose up -d --build
```

Endpoints:

- API: `http://localhost:3000`
- UI: `http://localhost:3000`
- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`

## API examples

```bash
curl -X POST http://localhost:3000/tools/ls \
  -H "content-type: application/json" \
  -d "{\"path\":\"/\"}"
```

```bash
curl -X POST http://localhost:3000/tools/cat \
  -H "content-type: application/json" \
  -d "{\"path\":\"/kb/docs/intro.md\"}"
```

```bash
curl -X POST http://localhost:3000/chat/agent \
  -H "content-type: application/json" \
  -H "x-role: editor" \
  -d "{\"message\":\"Find docs about grep and write a short summary to /workspace/notes/grep-summary.txt\"}"
```

## Seed data

Edit: `data/sources/demo/preembedded/points.json`

Re-index:

```bash
docker compose run --rm indexer
```

## Security note

`just-bash` is sandboxed and in-memory by default, and writable sync-back is limited to VFS writable roots.
