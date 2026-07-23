# Architecture

For the detailed product positioning, responsibility matrix,
session/account boundary, integration contract, and deployment models, see
[`agentscope-agentfoundry-boundary.md`](agentscope-agentfoundry-boundary.md).

AgentFoundry is an independent enterprise Agent platform. It is not a frontend shell for AgentScope and it should not copy AgentScope code into this repository.

AgentScope 2.0 is AgentFoundry's core and preferred Agent runtime platform, not merely a narrow reasoning SDK. It provides both an in-process Agent Framework and an embeddable or standalone FastAPI Application Service covering Agent, Chat, Session, Credential, Model, Knowledge Base, Schedule, Workspace, permissions, middleware, and distributed runtime facilities.

AgentFoundry or its integrated enterprise IAM owns enterprise identity facts, tenant/organization membership, enterprise RBAC policy, Agent product publishing, asset governance, approvals, unified run evidence, audit, and console APIs. AgentScope provides runtime Agent/session state and resource/tool enforcement capabilities. The runtime adapter preserves deployment and version boundaries; it must not be used to recreate AgentScope capabilities behind a provider-neutral facade.

This responsibility model describes the intended boundary, not a claim that every AgentScope capability is already wired into the current Foundry adapter. The native adapter currently connects Agent execution, weather tools, session lifecycle, runtime events, and enterprise projections. Memory, Knowledge/RAG, Workflow, Schedule, Team, and Workspace/Sandbox requests are rejected as unconnected capabilities. Existing Agents and enterprise workflows can still run through explicitly labelled Foundry compatibility paths.

```text
Platform Console
  -> AgentFoundry Backend API
    -> Platform Services
      -> Runtime Adapter
        -> AgentScope Framework or AgentScope Application Service
          -> currently connected: agent, session, model, tool, permission, event
          -> available in AgentScope but not yet connected here: memory, RAG,
             workspace, schedule, team, and distributed execution
    -> Persistence, audit, policy, and integration providers
```

## Product Boundary

AgentFoundry owns the enterprise product control plane and governance facts:

- Enterprise tenant, organization, role, and membership lifecycle
- User, role, and membership management
- Agent catalog, versioning, publishing, and run history
- Tool catalog, permissions, approvals, and execution evidence
- Enterprise knowledge asset metadata, visibility, retention, and grounding evidence
- Long-term memory policy, retention, and user/session scoping
- Product workflow templates, triggers, policy, and human approvals
- Runtime provider configuration, observability, audit, and compliance controls

AgentScope provides the target Agent application runtime and execution capabilities:

- Model invocation
- Agent reasoning loops
- Tool calling, middleware, events, and execution-point permissions
- Runtime Agent, Chat, Session, history, and AgentState
- Runtime Credential and Model construction
- Knowledge Base ingestion/retrieval and RAG execution
- Workspace/Sandbox, Schedule, Team/SubAgent, and distributed execution

Responsibilities that cross the boundary are split by governance versus execution: Foundry governs enterprise credentials while Scope constructs runtime credentials; Foundry governs knowledge assets while Scope runs ingestion and retrieval; Foundry governs schedule policy while Scope runs scheduled work; Foundry stores unified enterprise run/audit records while Scope emits runtime events and traces.

Only the connected subset is active in this repository today. The remaining bullets define ownership for later adapter work; they do not authorize implicit fallback or imply that the current adapter already invokes those AgentScope services.

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
paths are development, smoke-test, import/export, or compatibility paths, not
the production system of record.

The current `main.py` can remain as the compatibility entrypoint while production modules are extracted incrementally.

## Runtime Adapter

The runtime adapter is the only layer that should know how AgentFoundry talks to AgentScope, whether AgentScope is embedded in-process or deployed as an Application Service.

```text
AgentFoundry agent run request
  -> tenant, user, policy, approval, and explicitly supported resource context
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
- AgentScope Application Service APIs should be reused for Agent, Chat, Session, Knowledge Base, Schedule, and Workspace lifecycle when service mode is selected.
- Provider abstraction is a compatibility boundary, not a reason to reduce AgentScope to one `invoke` call or build a parallel runtime.
- Additional providers may be supported later without weakening AgentScope's status as the core and preferred runtime platform.
- Capability negotiation is strict: a requested native capability must be connected by the selected provider or the run fails before invocation. It does not fall through to `foundry_compatibility`.

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
