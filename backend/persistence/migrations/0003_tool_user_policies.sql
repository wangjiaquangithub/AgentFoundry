CREATE TABLE tool_user_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  allow_tools TEXT NOT NULL DEFAULT '[]',
  deny_tools TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tool_user_policies_tenant
  ON tool_user_policies (tenant_id);
