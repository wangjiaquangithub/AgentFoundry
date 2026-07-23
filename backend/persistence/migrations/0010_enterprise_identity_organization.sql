ALTER TABLE memberships ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE memberships ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE memberships ADD COLUMN source TEXT NOT NULL DEFAULT 'local';

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, name)
);

CREATE TABLE organization_units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  parent_id TEXT REFERENCES organization_units(id),
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL DEFAULT 'department',
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, organization_id, parent_id, name)
);

CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_unit_id TEXT NOT NULL REFERENCES organization_units(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, organization_unit_id, name)
);

CREATE TABLE member_org_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membership_id TEXT NOT NULL REFERENCES memberships(id),
  organization_unit_id TEXT NOT NULL REFERENCES organization_units(id),
  position_id TEXT REFERENCES positions(id),
  assignment_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, membership_id, organization_unit_id)
);

CREATE UNIQUE INDEX member_primary_org_assignment
  ON member_org_assignments (tenant_id, membership_id)
  WHERE assignment_type = 'primary' AND status = 'active';

CREATE TABLE member_manager_relations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membership_id TEXT NOT NULL REFERENCES memberships(id),
  manager_membership_id TEXT NOT NULL REFERENCES memberships(id),
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, membership_id)
);

CREATE TABLE identity_providers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  issuer TEXT,
  claim_mapping TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, name)
);

CREATE TABLE external_identity_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  identity_provider_id TEXT NOT NULL REFERENCES identity_providers(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  external_subject TEXT NOT NULL,
  username TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, identity_provider_id, external_subject),
  UNIQUE (tenant_id, identity_provider_id, username),
  UNIQUE (tenant_id, identity_provider_id, email)
);

CREATE TABLE identity_mutations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  source TEXT NOT NULL,
  before_summary TEXT,
  after_summary TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX identity_mutations_tenant_created
  ON identity_mutations (tenant_id, created_at);
