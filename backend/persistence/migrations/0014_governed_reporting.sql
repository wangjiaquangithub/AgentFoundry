CREATE TABLE report_definitions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  parameter_schema TEXT NOT NULL DEFAULT '{}',
  visible_fields TEXT NOT NULL DEFAULT '[]',
  sensitive_fields TEXT NOT NULL DEFAULT '[]',
  supported_scopes TEXT NOT NULL DEFAULT '[]',
  max_days INTEGER NOT NULL DEFAULT 31,
  max_rows INTEGER NOT NULL DEFAULT 200,
  export_policy TEXT NOT NULL DEFAULT 'approval',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE TABLE report_parameters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  report_id TEXT NOT NULL REFERENCES report_definitions(id),
  name TEXT NOT NULL,
  parameter_type TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (report_id, name)
);

CREATE TABLE report_permissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  report_id TEXT NOT NULL REFERENCES report_definitions(id),
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  data_scope TEXT NOT NULL,
  can_export INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, report_id, subject_type, subject_id)
);

CREATE TABLE report_queries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  report_id TEXT NOT NULL REFERENCES report_definitions(id),
  report_version INTEGER NOT NULL,
  requester_id TEXT NOT NULL,
  authorization_decision_id TEXT,
  request_id TEXT,
  parameter_digest TEXT NOT NULL,
  parameter_summary TEXT NOT NULL DEFAULT '{}',
  effective_scope TEXT NOT NULL,
  scope_summary TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  truncated INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX report_queries_tenant_created ON report_queries (tenant_id, created_at);

CREATE TABLE report_exports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  report_id TEXT NOT NULL REFERENCES report_definitions(id),
  requester_id TEXT NOT NULL,
  query_id TEXT,
  approval_case_id TEXT,
  authorization_decision_id TEXT,
  idempotency_key TEXT NOT NULL,
  parameter_digest TEXT NOT NULL,
  status TEXT NOT NULL,
  download_reference TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE report_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  request_id TEXT,
  authorization_decision_id TEXT,
  outcome TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX report_audit_tenant_created ON report_audit_events (tenant_id, created_at);

CREATE TABLE report_attendance (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department_id TEXT,
  work_date TEXT NOT NULL,
  status TEXT NOT NULL,
  hours REAL NOT NULL,
  private_note TEXT
);

CREATE TABLE report_sales (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  department_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  amount REAL NOT NULL,
  order_count INTEGER NOT NULL
);

CREATE TABLE report_budgets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  department_id TEXT NOT NULL,
  period TEXT NOT NULL,
  budget_amount REAL NOT NULL,
  actual_amount REAL NOT NULL
);
