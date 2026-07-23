CREATE TABLE agent_runtime_bindings (
  foundry_agent_id TEXT NOT NULL,
  foundry_version_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  runtime_provider TEXT NOT NULL,
  scope_application_id TEXT,
  scope_agent_id TEXT,
  scope_version TEXT,
  scope_type TEXT,
  status TEXT NOT NULL,
  fallback_reason TEXT,
  last_event_cursor TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_agent_runtime_bindings_tenant_agent
  ON agent_runtime_bindings (tenant_id, foundry_agent_id);
