# Data Model

This document defines the production data model target for AgentFoundry. PostgreSQL is the production relational database target for this model. The current repository still uses local JSON and JSONL files for development storage; those files are implementation details, not the production system of record.

## Core Principles

- Every business record is tenant scoped unless it is global platform configuration.
- User actions and runtime decisions produce audit events.
- Agent runs, tool calls, retrieval hits, approvals, and memory writes must be traceable.
- Runtime provider details are stored behind provider-neutral platform records.
- Deleting or retaining memory and documents must follow explicit tenant policy.

## Entities

### Tenancy And Identity

`tenants`

- `id`
- `name`
- `status`
- `plan`
- `created_at`
- `updated_at`

`users`

- `id`
- `display_name`
- `email`
- `status`
- `created_at`
- `updated_at`

`memberships`

- `id`
- `tenant_id`
- `user_id`
- `role`
- `workspace_ids`
- `created_at`
- `updated_at`

### Agents

`agents`

- `id`
- `tenant_id`
- `template_id`
- `name`
- `description`
- `status`
- `owner_user_id`
- `current_version_id`
- `memory_enabled`
- `workflow_enabled`
- `allowed_user_ids`
- `allowed_roles`
- `capabilities`
- `created_at`
- `updated_at`

`agent_versions`

- `id`
- `tenant_id`
- `agent_id`
- `version`
- `instructions`
- `model_config_id`
- `runtime_provider`
- `tool_ids`
- `knowledge_base_ids`
- `memory_policy_id`
- `created_by`
- `created_at`

`agent_runs`

- `id`
- `tenant_id`
- `agent_id`
- `agent_version_id`
- `user_id`
- `session_id`
- `status`
- `question`
- `answer`
- `runtime_provider`
- `runtime_invocation_id`
- `created_at`
- `completed_at`

### Runtime

`runtime_providers`

- `id`
- `name`
- `provider_type`
- `mode`
- `status`
- `capabilities`
- `config_ref`
- `created_at`
- `updated_at`

`runtime_invocations`

- `id`
- `tenant_id`
- `provider_id`
- `agent_run_id`
- `request_summary`
- `response_summary`
- `provider_run_id`
- `latency_ms`
- `token_usage`
- `error`
- `created_at`
- `completed_at`

### Tools And Approvals

`tools`

- `id`
- `tenant_id`
- `name`
- `description`
- `category`
- `schema`
- `status`
- `created_at`
- `updated_at`

`tool_policies`

- `id`
- `tenant_id`
- `tool_id`
- `allowed_roles`
- `approval_required`
- `rate_limit`
- `data_access_scope`
- `created_at`
- `updated_at`

`tool_user_policies`

- `id`
- `tenant_id`
- `user_id`
- `allow_tools`
- `deny_tools`
- `created_at`
- `updated_at`

`tool_calls`

- `id`
- `tenant_id`
- `agent_run_id`
- `tool_id`
- `inputs`
- `result`
- `allowed`
- `approval_id`
- `created_at`
- `completed_at`

`approvals`

- `id`
- `tenant_id`
- `request_type`
- `target_type`
- `target_id`
- `status`
- `requested_by`
- `approved_by`
- `reason`
- `payload`
- `created_at`
- `resolved_at`

### Knowledge

`knowledge_bases`

- `id`
- `tenant_id`
- `name`
- `description`
- `status`
- `embedding_model_config_id`
- `created_at`
- `updated_at`

`documents`

- `id`
- `tenant_id`
- `knowledge_base_id`
- `title`
- `source_type`
- `source_uri`
- `object_ref`
- `status`
- `created_at`
- `updated_at`

`document_chunks`

- `id`
- `tenant_id`
- `document_id`
- `chunk_index`
- `content`
- `metadata`
- `created_at`

`embedding_records`

- `id`
- `tenant_id`
- `chunk_id`
- `model_config_id`
- `vector_ref`
- `created_at`

`retrieval_events`

- `id`
- `tenant_id`
- `agent_run_id`
- `knowledge_base_id`
- `query`
- `hits`
- `created_at`

### Memory

`memory_policies`

- `id`
- `tenant_id`
- `name`
- `scope`
- `retention_days`
- `write_mode`
- `read_roles`
- `created_at`
- `updated_at`

`memory_items`

- `id`
- `tenant_id`
- `user_id`
- `agent_id`
- `session_id`
- `content`
- `source_run_id`
- `metadata`
- `expires_at`
- `created_at`

### Workflows

`workflow_templates`

- `id`
- `tenant_id`
- `name`
- `description`
- `definition`
- `status`
- `created_at`
- `updated_at`

`workflow_runs`

- `id`
- `tenant_id`
- `workflow_template_id`
- `triggered_by`
- `status`
- `inputs`
- `outputs`
- `created_at`
- `completed_at`

### Configuration And Audit

`model_configs`

- `id`
- `tenant_id`
- `provider`
- `model`
- `base_url`
- `credential_ref`
- `status`
- `created_at`
- `updated_at`

`connectors`

- `id`
- `tenant_id`
- `type`
- `name`
- `config_ref`
- `status`
- `created_at`
- `updated_at`

`audit_events`

- `id`
- `tenant_id`
- `actor_user_id`
- `event_type`
- `resource_type`
- `resource_id`
- `metadata`
- `created_at`

## Current Development Storage Mapping

Current files should migrate into production tables:

- `backend/data/platform_agents.json` -> `agents`, `agent_versions`
- `backend/data/platform_agent_runs.jsonl` -> `agent_runs`, `runtime_invocations`, `tool_calls`, `retrieval_events`
- `backend/data/platform_workflow_runs.jsonl` -> `workflow_runs`
- `backend/data/platform_approval_requests.jsonl` -> `approvals`
- `backend/data/platform_tool_policy.json` -> `tool_policies`
- `backend/data/platform_dev_knowledge.json` -> `knowledge_bases`, `documents`, `document_chunks`
- `backend/data/platform_memory/**/memories.jsonl` -> `memory_items`
- existing audit log files -> `audit_events`

## Phase 1 Implementation Target

The first production step is not to replace every JSON file immediately. The target is:

- Document the table boundaries.
- Keep current APIs stable.
- Add repository interfaces when extracting services from `main.py`.
- Move runtime-specific execution behind `backend/runtime.py`.
- Add run evidence fields that can later be persisted without changing frontend contracts.

## Phase 2 Migration Target

When the API contracts stabilize:

- Add database migrations.
- Introduce repository classes per bounded context.
- Keep local JSON storage as a dev adapter.
- Backfill existing local records into database tables.
- Add transactional writes for agent run, tool call, retrieval event, memory write, and audit event creation.
