CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  plan TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  workspace_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE model_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  config_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE memory_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  retention_days INTEGER,
  write_mode TEXT NOT NULL,
  read_roles TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE agent_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  instructions TEXT NOT NULL,
  model_config_id TEXT REFERENCES model_configs(id),
  runtime_provider TEXT NOT NULL,
  tool_ids TEXT NOT NULL DEFAULT '[]',
  knowledge_base_ids TEXT NOT NULL DEFAULT '[]',
  memory_policy_id TEXT REFERENCES memory_policies(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, agent_id, version)
);

CREATE TABLE runtime_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  capabilities TEXT NOT NULL DEFAULT '{}',
  config_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id),
  agent_version_id TEXT REFERENCES agent_versions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  session_id TEXT,
  status TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  runtime_provider TEXT NOT NULL,
  runtime_invocation_id TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE runtime_invocations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id TEXT REFERENCES runtime_providers(id),
  agent_run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
  request_summary TEXT NOT NULL DEFAULT '{}',
  response_summary TEXT,
  provider_run_id TEXT,
  latency_ms INTEGER,
  token_usage TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE tools (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  schema TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, name)
);

CREATE TABLE tool_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  allowed_roles TEXT NOT NULL DEFAULT '[]',
  approval_required INTEGER NOT NULL DEFAULT 0,
  rate_limit TEXT,
  data_access_scope TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, tool_id)
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  reason TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE tool_calls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
  tool_id TEXT REFERENCES tools(id),
  inputs TEXT NOT NULL DEFAULT '{}',
  result TEXT,
  allowed INTEGER NOT NULL,
  approval_id TEXT REFERENCES approvals(id),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE knowledge_bases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  embedding_model_config_id TEXT REFERENCES model_configs(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_uri TEXT,
  object_ref TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, document_id, chunk_index)
);

CREATE TABLE embedding_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  model_config_id TEXT NOT NULL REFERENCES model_configs(id),
  vector_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, chunk_id, model_config_id)
);

CREATE TABLE retrieval_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
  knowledge_base_id TEXT REFERENCES knowledge_bases(id),
  query TEXT NOT NULL,
  hits TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE memory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  agent_id TEXT REFERENCES agents(id),
  session_id TEXT,
  content TEXT NOT NULL,
  source_run_id TEXT REFERENCES agent_runs(id),
  metadata TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE workflow_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  definition TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_template_id TEXT NOT NULL REFERENCES workflow_templates(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  input TEXT NOT NULL DEFAULT '{}',
  output TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
  actor_user_id TEXT REFERENCES users(id),
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_memberships_tenant_user ON memberships(tenant_id, user_id);
CREATE INDEX idx_model_configs_tenant_purpose_status ON model_configs(tenant_id, purpose, status, name, id);
CREATE INDEX idx_memory_policies_tenant_scope ON memory_policies(tenant_id, scope, write_mode);
CREATE INDEX idx_agents_tenant_status ON agents(tenant_id, status);
CREATE INDEX idx_agent_runs_tenant_created ON agent_runs(tenant_id, created_at);
CREATE INDEX idx_runtime_invocations_tenant_provider ON runtime_invocations(tenant_id, provider_id, created_at);
CREATE INDEX idx_runtime_invocations_tenant_run ON runtime_invocations(tenant_id, agent_run_id, created_at);
CREATE INDEX idx_tool_calls_tenant_run ON tool_calls(tenant_id, agent_run_id);
CREATE INDEX idx_approvals_tenant_status ON approvals(tenant_id, status);
CREATE INDEX idx_knowledge_bases_tenant_status ON knowledge_bases(tenant_id, status, name, id);
CREATE INDEX idx_documents_tenant_kb ON documents(tenant_id, knowledge_base_id);
CREATE INDEX idx_chunks_tenant_document ON document_chunks(tenant_id, document_id);
CREATE INDEX idx_retrieval_events_tenant_run ON retrieval_events(tenant_id, agent_run_id);
CREATE INDEX idx_memory_items_tenant_scope ON memory_items(tenant_id, user_id, agent_id);
CREATE INDEX idx_workflow_runs_tenant_template ON workflow_runs(tenant_id, workflow_template_id);
CREATE INDEX idx_audit_events_tenant_created ON audit_events(tenant_id, created_at);
