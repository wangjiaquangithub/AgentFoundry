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

The first platform surface is `/platform`, a workbench that validates the full enterprise loop before the product is split into dedicated module pages.

## Backend

- Python
- FastAPI-compatible AgentScope app service
- AgentScope runtime, tools, memory, permission, storage, and RAG components

The backend is not meant to replace AgentScope. It composes AgentScope capabilities into enterprise platform APIs for tenants, members, tools, workflows, approvals, audit, and platform Agent runs.

## Runtime Dependency

The local development scripts expect a sibling AgentScope checkout at `../agentscope`.

Set `AGENTSCOPE_DIR` to point to another checkout.
