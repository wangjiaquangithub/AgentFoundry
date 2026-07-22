# Architecture

AgentFoundry is an independent enterprise Agent platform. It is not a frontend shell for AgentScope and it should not copy AgentScope code into this repository.

AgentScope is one replaceable runtime provider behind AgentFoundry's backend runtime adapter. The platform owns tenants, users, agents, tool governance, knowledge metadata, long-term memory policy, audit, approvals, run history, and console APIs.

```text
Platform Console
  -> AgentFoundry Backend API
    -> Platform Services
      -> Runtime Adapter
        -> AgentScope or another Agent runtime provider
          -> Model, tool, memory, RAG, and workflow execution
    -> Persistence, audit, policy, and integration providers
```

## Product Boundary

AgentFoundry owns the enterprise control plane:

- Tenant and workspace isolation
- User, role, and membership management
- Agent catalog, versioning, publishing, and run history
- Tool catalog, permissions, approvals, and execution evidence
- Knowledge base metadata, document lifecycle, retrieval logs, and grounding evidence
- Long-term memory policy, retention, and user/session scoping
- Workflow templates, workflow runs, triggers, and human approvals
- Runtime provider configuration, observability, audit, and compliance controls

Runtime providers own execution internals:

- Model invocation
- Agent reasoning loops
- Provider-specific tool calling
- Provider-specific memory and RAG primitives
- Provider-specific distributed execution

The backend adapter converts AgentFoundry requests into provider-specific runtime calls and converts runtime results back into platform records.

## Frontend

- React
- TypeScript
- Vite
- React Router
- i18next
- local shadcn/radix-style UI components
- lucide icons

The platform console is split by route:

- `/platform`: dashboard overview and operational launchpad
- `/platform/agents`: Agent templates, publishing, and management
- `/platform/tools`: tool catalog, policy checks, and tool runner
- `/platform/workflows`: workflow templates, triggers, and runner
- `/platform/approvals`: human approval and governance queue
- `/platform/runs`: Agent run console and history
- `/platform/tenants`: tenant workspace, connectors, access, and members
- `/platform/memory`: long-term memory operations
- `/platform/settings`: runtime governance, audit, config, and capabilities

Current frontend state is still centralized in platform-level page composition. The production direction is to keep route-level information architecture stable, then extract each route into feature modules with route-local data loading and shared shell components.

## Backend

Current backend:

- Python
- FastAPI-compatible HTTP API
- Development storage backed by local JSON and JSONL files
- Platform services currently concentrated in `backend/main.py`
- Runtime boundary metadata in `backend/runtime.py`

Production backend target:

```text
backend/
  api/          HTTP routes and request/response schemas
  services/     tenant, agent, tool, memory, knowledge, workflow, approval services
  runtime/      runtime adapter contracts and provider implementations
  persistence/  repositories, migrations, transactions
  policy/       authorization, approval, retention, and quota decisions
  audit/        immutable audit event writer and query model
  integrations/ enterprise connectors and external APIs
```

The production persistence target is PostgreSQL. Local JSON, JSONL, and SQLite
paths are development or compatibility adapters, not the production system of
record.

The current `main.py` can remain as the compatibility entrypoint while production modules are extracted incrementally.

## Runtime Adapter

The runtime adapter is the only layer that should know how AgentFoundry talks to AgentScope.

```text
AgentFoundry agent run request
  -> tenant, user, policy, knowledge, memory, approval context
  -> RuntimeInvocationRequest
  -> AgentScopeRuntimeAdapter.invoke()
  -> RuntimeInvocationResult
  -> run record, audit event, evidence payload
```

Adapter rules:

- Frontend never calls AgentScope directly.
- Platform services never depend on AgentScope internals.
- Runtime results must include provider identity, execution mode, capabilities, evidence, and raw provider references when available.
- AgentScope upgrades should affect the adapter/provider package, not the console routes or platform data model.
- Additional providers can be added later, for example a remote AgentScope service, LangGraph, or an internal runtime.

## Persistence

Current local files are development storage only. They are useful for proving product behavior, but they are not production persistence.

Production storage should move to a transactional database with tenant-scoped rows, migrations, repository interfaces, and immutable audit logs. See `docs/data-model.md` for the target entities and the mapping from current local files.

## Knowledge And Memory

Knowledge and memory are separate platform concerns:

- Knowledge base: tenant-owned curated documents and chunks used for grounded retrieval.
- Long-term memory: user/session/agent-scoped interaction facts with retention and deletion policy.

The current knowledge fallback is acceptable for MVP validation. Production RAG needs explicit document ingestion, chunking, embeddings, retrieval logs, model configuration, and evidence records.

## Deployment Direction

Production deployment should separate:

- Frontend static app
- Backend API service
- Database
- Object/document storage
- Vector store
- Background workers
- Runtime provider service or local runtime adapter
- Observability and audit sinks

Local development may continue to run on a single Vite port plus one backend process, but production architecture should not assume single-process state.
