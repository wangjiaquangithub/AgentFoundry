CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  built_in INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, role_id, permission_id)
);

CREATE TABLE role_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  data_scope TEXT NOT NULL DEFAULT 'none',
  scope_config TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'local',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, role_id, subject_type, subject_id, resource_type, resource_id)
);

CREATE INDEX role_bindings_subject
  ON role_bindings (tenant_id, subject_type, subject_id, status);

CREATE TABLE resource_grants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  data_scope TEXT NOT NULL DEFAULT 'none',
  conditions TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, subject_type, subject_id, action, resource_type, resource_id)
);

CREATE INDEX resource_grants_subject
  ON resource_grants (tenant_id, subject_type, subject_id, status);

CREATE TABLE authorization_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  membership_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  allowed INTEGER NOT NULL,
  reason_code TEXT NOT NULL,
  matched_role_bindings TEXT NOT NULL DEFAULT '[]',
  matched_resource_grants TEXT NOT NULL DEFAULT '[]',
  effective_scope TEXT NOT NULL DEFAULT 'none',
  scope_details TEXT NOT NULL DEFAULT '{}',
  policy_version TEXT NOT NULL,
  environment_summary TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX authorization_decisions_tenant_created
  ON authorization_decisions (tenant_id, created_at);
CREATE INDEX authorization_decisions_subject_created
  ON authorization_decisions (tenant_id, subject_id, created_at);
