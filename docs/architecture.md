# Architecture

AgentFoundry is currently organized as a thin enterprise platform around AgentScope.

```text
Frontend console
  -> AgentFoundry backend APIs
    -> AgentScope app, tools, model abstraction, memory, RAG, and runtime services
      -> Enterprise systems or mock tenant fixtures
```

## Frontend

- React
- TypeScript
- Vite
- React Router
- i18next
- shadcn/radix-style UI components
- lucide icons

The platform console uses route-level pages for the main enterprise operations:

- `/platform`: dashboard overview and operational launchpad
- `/platform/agents`: Agent templates, publishing, and management
- `/platform/tools`: tool catalog, policy checks, and tool runner
- `/platform/workflows`: workflow templates, triggers, and runner
- `/platform/approvals`: human approval and governance queue
- `/platform/runs`: Agent run console and history
- `/platform/tenants`: tenant workspace, connectors, access, and members
- `/platform/memory`: long-term memory operations
- `/platform/settings`: runtime governance, audit, config, and capabilities

The first implementation keeps the existing platform state model in one page component and gates top-level sections by route. That reduces migration risk while making the console navigable. The next frontend step is extracting each route group into feature modules.

## Backend

- Python
- FastAPI-compatible AgentScope app service
- AgentScope runtime, tools, memory, permission, storage, and RAG components

The backend is not meant to replace AgentScope. It composes AgentScope capabilities into enterprise platform APIs for tenants, members, tools, workflows, approvals, audit, and platform Agent runs.

## Runtime Dependency

The local development scripts expect a sibling AgentScope checkout at `../agentscope`.

Set `AGENTSCOPE_DIR` to point to another checkout.
