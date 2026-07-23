ALTER TABLE tool_calls ADD COLUMN tool_name TEXT;
ALTER TABLE tool_calls ADD COLUMN status TEXT;
ALTER TABLE tool_calls ADD COLUMN error TEXT;
ALTER TABLE tool_calls ADD COLUMN input_summary TEXT;
ALTER TABLE tool_calls ADD COLUMN output_summary TEXT;

CREATE TABLE agentscope_event_projections (
  event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  foundry_run_id TEXT NOT NULL,
  scope_session_id TEXT,
  scope_run_id TEXT,
  scope_event_id TEXT NOT NULL,
  agent_id TEXT,
  agent_version_id TEXT,
  actor_user_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  projected_at TEXT NOT NULL,
  UNIQUE (tenant_id, scope_event_id)
);

CREATE INDEX idx_agentscope_projection_run
  ON agentscope_event_projections(tenant_id, foundry_run_id, projected_at);
