CREATE TABLE runtime_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  subject_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX runtime_sessions_subject ON runtime_sessions (tenant_id, subject_id, updated_at);

CREATE TABLE runtime_executions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  session_id TEXT NOT NULL REFERENCES runtime_sessions(id),
  business_run_id TEXT NOT NULL,
  state TEXT NOT NULL,
  execution_context TEXT NOT NULL DEFAULT '{}',
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX runtime_executions_business_run ON runtime_executions (tenant_id, business_run_id, created_at);

CREATE TABLE run_continuations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  business_run_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES runtime_sessions(id),
  payload TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE runtime_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  execution_id TEXT NOT NULL REFERENCES runtime_executions(id),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL,
  UNIQUE (tenant_id, provider_event_id)
);
