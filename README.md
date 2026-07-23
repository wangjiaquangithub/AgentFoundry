# AgentFoundry

AgentFoundry is an enterprise Agent platform for building, running, governing, and observing AI agents across teams, tenants, tools, knowledge bases, workflows, approvals, memory, and audit trails.

The repository is currently a runnable product prototype moving toward a production-grade SaaS platform. It is not a production system yet.

AgentFoundry is not a single chatbot and is not a frontend shell for AgentScope. It is the enterprise product control plane and governance layer for Agent operations: create and publish Agent products, govern tools and knowledge assets, apply enterprise identity and policy, route human approvals, and maintain unified run evidence and audit records.

AgentScope 2.0 is AgentFoundry's core and preferred Agent runtime platform, not merely a narrow reasoning SDK. It provides both an in-process Agent Framework and an embeddable or standalone Agent Application Service, including Agent, Chat, Session, Credential, Model, Knowledge Base, Schedule, Workspace, Permission, Middleware, and distributed execution capabilities.

Target users:

- Enterprise AI platform teams that need to standardize how internal Agents are created, operated, and governed.
- Internal automation teams that want reusable Agents, tools, workflows, approvals, and run history instead of isolated scripts.
- Engineering teams that need tenant isolation, model configuration, knowledge retrieval, memory operations, and auditability before using Agents in business workflows.

Core product loop:

```text
Configure models and runtime providers
  -> Create or publish an Agent
  -> Bind tools, workflows, knowledge bases, and memory scope
  -> Start an Agent run
  -> Apply policy and human approval gates when needed
  -> Return an answer with evidence
  -> Persist run history, memory, retrieval records, and audit events
```

AgentFoundry is an independent product repository. It owns the platform console and APIs, enterprise identity and organization integration, Agent product publishing, asset governance, approval policy, unified run evidence, and enterprise audit views. AgentScope provides the preferred runtime capabilities for Agent/session state, tool and resource permission enforcement, workspace isolation, knowledge retrieval, scheduling, and team execution.

The current native Foundry adapter connects explicit runtime selection, Agent execution, weather-tool execution, session lifecycle, runtime events, and enterprise run/audit projections. Memory, Knowledge/RAG, Workflow, Schedule, Team, and Workspace/Sandbox are capability boundaries but are not yet connected to the native adapter; requesting one fails explicitly instead of silently using an unrelated provider. Existing Agents may still use the explicitly labelled `foundry_compatibility` path, and enterprise workflow execution remains a compatibility path during migration.

The runtime adapter preserves version, type, and deployment boundaries between the two projects. It supports either an embedded AgentScope runtime or a separately deployed AgentScope Application Service, but it must not recreate AgentScope capabilities behind a provider-neutral facade. See [`docs/agentscope-agentfoundry-boundary.md`](docs/agentscope-agentfoundry-boundary.md) for the detailed responsibility and data-ownership model.

## Repository Layout

```text
agentfoundry/
  frontend/   React, TypeScript, Vite platform console
  backend/    Python platform API, services, repositories, and runtime adapter
  scripts/    Local start and smoke-test scripts
  docs/       Product, architecture, data model, and production plan
```

## Prerequisites

The current local development scripts expect:

- `uv` for running the Python backend.
- `pnpm` for running the Vite frontend.
- Redis, or Docker so the start script can launch Redis automatically.
- A local AgentScope checkout next to this repository, or `AGENTSCOPE_DIR` pointing to one. This is a development-script requirement, not a production deployment requirement.

Expected local stack:

```text
agentfoundry-stack/
  agentscope/     AgentScope framework checkout
  agentfoundry/   This repository
```

The local scripts currently run the backend through the AgentScope Python environment. Production deployment does not require an AgentScope source checkout: it can install a pinned AgentScope package or call a separately deployed AgentScope Application Service.

AgentScope is the core Agent runtime platform, while AgentFoundry remains the enterprise-facing product control plane. AgentScope should own and execute its runtime models and services; it should not own AgentFoundry's enterprise organization master data, product catalog, unified audit model, or external platform API contracts.

## Start Locally

From this repository:

```bash
./scripts/start_agentfoundry.sh
```

Open:

```text
http://127.0.0.1:5176
```

The platform console is available at:

```text
http://127.0.0.1:5176/platform
```

If the default frontend port is already occupied, run the stack with an explicit port:

```bash
BACKEND_PORT=8000 FRONTEND_PORT=5186 ./scripts/start_agentfoundry.sh
```

Then open:

```text
http://127.0.0.1:5186/platform
```

## Try the Platform

Open `/platform`, then use these setup values in the frontend if prompted:

```text
Server URL: http://127.0.0.1:8000
Username:   acme:alice
```

Platform routes:

```text
/platform            Dashboard overview
/platform/agents     Agent templates, publishing, and management
/platform/tools      Tool catalog and tool runner
/platform/workflows  Workflow templates and runner
/platform/approvals  Human approval and governance queue
/platform/runs       Agent run console and history
/platform/tenants    Tenant workspace, connectors, and members
/platform/memory     Long-term memory operations
/platform/settings   Runtime, audit, config, and capability views
```

Demo prompt:

```text
请查询 remote 政策、INC-1001 工单状态，并总结 engineering 部门指标。回答里说明信息来源。
```

Enterprise knowledge assistant prompt:

```text
AgentFoundry 里的 AgentScope 起什么作用？
```

Current knowledge status:

- The enterprise knowledge assistant can use the development knowledge base `dev-enterprise-handbook`.
- Results from this local fallback are marked as `agentfoundry-dev-local` in run evidence.
- Production RAG still needs an embedding-capable credential and a real indexing pipeline.

## Development vs Production

This repository is safe to use as a local development prototype and product foundation. Do not treat the current local data path as production storage.

Development behavior:

- Local JSON/JSONL files are used for development storage and smoke-test data.
- The enterprise knowledge assistant can answer from the local fallback knowledge base.
- Existing Agents can use the explicitly labelled `foundry_compatibility` path during migration; native AgentScope requests never silently fall back to it.

Production work still needs:

- Database-backed persistence, migrations, transactions, and tenant-scoped constraints.
- Real document ingestion, chunking, embedding, retrieval, and retrieval logs.
- Authentication, authorization, secret management, immutable audit, deployment, and observability.

Do not connect real enterprise-sensitive data until the production data layer, access control, secret handling, and audit guarantees are in place.

## PostgreSQL Data Workflow

PostgreSQL is the production database target for AgentFoundry. Local JSON/JSONL
files are development fixtures or import/export inputs, and `sqlite://` is only
accepted for explicit local compatibility.

Use the default local PostgreSQL URL, or replace it with your own database:

```bash
export AGENTFOUNDRY_DATABASE_URL=postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry
```

Apply migrations before running production-backed APIs:

```bash
./scripts/migrate_agentfoundry.sh
```

Seed development data into PostgreSQL when you need a populated local platform:

```bash
./scripts/seed_agentfoundry.sh
```

Both scripts prefer `uv run --with "psycopg[binary]"` when `uv` is available.
If you run without `uv`, install `psycopg` in the active Python environment.

## Verify

Run the backend production gates before changing backend service, data,
knowledge, runtime, or governance behavior:

```bash
python3 scripts/check_backend_production_gates.py
```

Run the platform smoke test when validating the end-to-end local loop:

```bash
./scripts/smoke_agentfoundry.sh
```

The scripts default to `../agentscope` as the AgentScope checkout. Override it when needed:

```bash
AGENTSCOPE_DIR=/path/to/agentscope ./scripts/start_agentfoundry.sh
```

## Current Status

This is a runnable enterprise Agent platform prototype, not a production SaaS platform yet.

Already in place:

- Route-level platform console under `/platform/*`.
- Python backend API with tenant, agent, tool, workflow, approval, memory, run, and settings capabilities.
- Development local storage using JSON/JSONL files.
- Enterprise knowledge assistant flow with a development knowledge fallback.
- Initial service, repository, and runtime adapter direction.

Still required for production:

- Complete backend API/service/repository separation.
- Production database, migrations, transactions, and tenant-scoped constraints.
- Real knowledge ingestion, chunking, embedding, retrieval, and retrieval logs.
- Complete AgentScope Framework/Application Service integration through a stable adapter, reusing AgentScope Session, Chat, Credential, Knowledge Base, Schedule, Workspace, Permission, and event capabilities where applicable.
- Authentication, authorization, immutable audit, secret handling, deployment, and observability.
- Continued `/platform/*` page work so each route behaves like an enterprise SaaS workspace.

## Production Plan

Use `docs/production-plan.md` as the execution source of truth for production-grade work.

Execution should happen in small, verifiable slices. Do not treat "make AgentFoundry production-grade" as one large coding task. Each slice should state its phase, scope, non-goals, validation command, and whether it needs a commit or push.

Recommended first slice:

```text
Stage 1.1: Extract backend request schemas from backend/main.py into a schemas module.
```

Related docs:

- `docs/agentscope-agentfoundry-boundary.md`
- `docs/agentscope-integration-correction-plan.md`
- `docs/production-plan.md`
- `docs/product-roadmap.md`
- `docs/architecture.md`
- `docs/data-model.md`
