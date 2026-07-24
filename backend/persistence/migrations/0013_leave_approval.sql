CREATE TABLE leave_request_drafts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  requester_id TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  draft_digest TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX leave_drafts_requester ON leave_request_drafts (tenant_id, requester_id, created_at);

CREATE TABLE approval_cases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  immutable_digest TEXT NOT NULL,
  status TEXT NOT NULL,
  fallback_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX approval_cases_assignee ON approval_cases (tenant_id, assignee_id, status, created_at);

CREATE TABLE approval_steps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  approval_case_id TEXT NOT NULL REFERENCES approval_cases(id),
  step_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (approval_case_id, step_number)
);

CREATE TABLE approval_assignees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  approval_case_id TEXT NOT NULL REFERENCES approval_cases(id),
  assignee_id TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (approval_case_id, assignee_id)
);

CREATE TABLE approval_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  approval_case_id TEXT NOT NULL REFERENCES approval_cases(id),
  actor_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  comment TEXT,
  immutable_digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (approval_case_id)
);

CREATE TABLE business_run_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  business_run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  draft_id TEXT NOT NULL REFERENCES leave_request_drafts(id),
  approval_case_id TEXT NOT NULL REFERENCES approval_cases(id),
  continuation_id TEXT,
  hr_request_id TEXT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, business_run_id),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE leave_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  request_id TEXT,
  business_run_id TEXT,
  session_id TEXT,
  runtime_execution_id TEXT,
  authorization_decision_id TEXT,
  outcome TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL
);
CREATE INDEX leave_audit_tenant_time ON leave_audit_events (tenant_id, occurred_at);
