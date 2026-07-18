# AgentFoundry

AgentFoundry is an enterprise Agent platform prototype for building, running, and governing AI agents.

It is split from the AgentScope example workspace into an independent product repository. AgentFoundry owns the platform console, backend APIs, tenant-aware tools, workflow demos, approval gates, and audit views. AgentScope remains the Agent runtime dependency.

## Repository Layout

```text
agentfoundry/
  frontend/   React, TypeScript, Vite platform console
  backend/    Python enterprise Agent backend built on AgentScope
  scripts/    Local start and smoke-test scripts
  docs/       Product and architecture notes
  examples/   Future platform examples
```

Expected local stack:

```text
agentfoundry-stack/
  agentscope/     AgentScope framework checkout
  agentfoundry/   This repository
```

## Start Locally

From this repository:

```bash
./scripts/start_agentfoundry.sh
```

Open:

```text
http://127.0.0.1:5173
```

Use these setup values in the frontend if prompted:

```text
Server URL: http://127.0.0.1:8000
Username:   acme:alice
```

Demo prompt:

```text
请查询 remote 政策、INC-1001 工单状态，并总结 engineering 部门指标。回答里说明信息来源。
```

## Verify

```bash
./scripts/smoke_agentfoundry.sh
```

The scripts default to `../agentscope` as the AgentScope checkout. Override it when needed:

```bash
AGENTSCOPE_DIR=/path/to/agentscope ./scripts/start_agentfoundry.sh
```

## Current Status

This is a runnable enterprise Agent platform prototype, not a production SaaS platform yet. The next productization steps are splitting the single workbench into module routes, adding persistent platform storage, and formalizing deployment.
