# vfs-demo

Agentic virtual filesystem architecture demo for AI products.

## Motivation for using this architecture

At large scale, AI platform spend is usually dominated by:

- model tokens and retries
- retrieval/cache misses
- orchestration overhead from too many services in the loop
- incident/debug time from non-deterministic agent behavior

This system pattern is about lowering those specific costs, not "cheap infra".

What a realistic outcome looks like in production programs:

- `10-25%` reduction in token spend from better tool boundaries, routing, and fewer failed loops
- `15-35%` lower retrieval+cache infrastructure waste from deterministic path access and higher cache hit rates
- `20-40%` less operational toil (on-call/debug effort) from auditable, repeatable tool behavior

In many orgs, those combined effects can land around `20-35%` total annual platform cost reduction after rollout.  
Not guaranteed: results depend on baseline architecture, traffic shape, model mix, and operational maturity.

## Money at high scale

At millions of users, focus on unit economics and annual run-rate, not per-server pricing.

### Example annual economics

Assume:

- 120 million agent tasks/year
- baseline cost per successful task: `$0.042`
- baseline annual spend: about `$5.0M`

Baseline spend split:

- model inference: `$3.2M`
- retrieval + cache infra: `$1.1M`
- orchestration/operations overhead: `$0.7M`

After applying this pattern:

- `18%` lower token usage per successful task (better routing + fewer failed loops)
- `22%` lower retrieval/cache waste (higher cache hit rate, deterministic access)
- `28%` lower orchestration toil/overhead (fewer moving parts + faster debugging)

Resulting spend:

- model inference: `$2.62M` (save `$0.58M`)
- retrieval + cache infra: `$0.86M` (save `$0.24M`)
- orchestration/operations: `$0.50M` (save `$0.20M`)
- total: `$3.98M` (save `$1.02M/year`, about `20.4%`)

Aggressive but plausible program (well-executed):

- total annual savings: `~$1.5M-$2.0M` on a `$5M` baseline (`30-40%`)

KPIs to validate in production:

- cost per successful task
- token-per-task trend
- failed/retried run rate
- cache hit rate for hot paths
- P95/P99 latency at target concurrency
- operations/debug hours per month

## Technical pattern (after the money case)

`vfs-demo` combines:

- `Bun` + `Elysia` API
- `Qdrant` for read-heavy knowledge paths (`/kb`)
- `SQLite` for writable tenant-scoped paths (`/workspace`, `/memory`, `/scratch`)
- `Redis` for hot caching
- `AI SDK ToolLoopAgent` + `just-bash` for natural-language execution

This repo is a demo, but the architectural pattern is intended for production-scale systems.

Why this pattern works:

- deterministic paths
- explicit read/write boundaries
- explicit tool semantics (`ls`, `cd`, `cat`, `find`, `grep`, `write`)
- centralized audit logging

## Scaling strategy (millions of users)

Treat this as a control-plane contract with replaceable data/compute internals.

1. **API layer**
   - stateless replicas behind load balancers
   - autoscale on QPS + latency + queue depth

2. **Tenant isolation**
   - shard by tenant/domain/region
   - per-tenant quotas and rate limits
   - isolate high-volume tenants onto dedicated capacity pools

3. **Retrieval plane**
   - partition Qdrant collections
   - replica strategy for read-heavy workloads
   - path-tree/file-response caches for hot routes

4. **Writable state**
   - start simple; move to distributed SQL/sharded relational store for multi-writer scale
   - idempotent write semantics
   - append-only audit/event streams

5. **Agent execution**
   - isolated worker pools
   - strict CPU/time/step budgets
   - async queue for long-running jobs

6. **Reliability**
   - multi-region deployment
   - graceful provider fallback/circuit breakers
   - replayable operations from audit trail

What changes at scale:

- storage engine choice
- sharding topology
- queueing and worker policies
- regional replication strategy

What stays stable:

- filesystem contract (`/kb`, `/workspace`, `/memory`, `/scratch`)
- tool semantics
- audit model

## Virtual filesystem model

- `/kb`  
  Read-only knowledge content from Qdrant.

- `/workspace`, `/memory`, `/scratch`  
  Writable tenant-scoped content (backed by SQLite in this demo).

## Agent behavior

Natural-language endpoint: `POST /chat/agent`

- ToolLoopAgent selects tools step-by-step.
- `just-bash` executes shell-style commands in sandbox.
- Sandbox is hydrated from VFS roots.
- Writes in writable roots are synced back to VFS state.

This gives shell flexibility without giving up deterministic backend control.

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

## API quick examples

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
curl -X POST http://localhost:3000/tools/write \
  -H "content-type: application/json" \
  -H "x-role: editor" \
  -d "{\"path\":\"/workspace/notes/today.txt\",\"content\":\"fast filesystem retrieval\"}"
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

## Security notes

- `just-bash` is sandboxed and in-memory by default.
- Writable sync-back is limited to VFS writable roots.
- Review `docs/security-backup.md` for backup/security guidance.
