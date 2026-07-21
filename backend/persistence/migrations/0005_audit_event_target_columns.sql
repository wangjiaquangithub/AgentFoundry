ALTER TABLE audit_events ADD COLUMN resource_type TEXT;
ALTER TABLE audit_events ADD COLUMN resource_id TEXT;
ALTER TABLE audit_events ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';

UPDATE audit_events
SET resource_type = target_type
WHERE resource_type IS NULL;

UPDATE audit_events
SET resource_id = target_id
WHERE resource_id IS NULL;

UPDATE audit_events
SET metadata = payload
WHERE metadata = '{}' AND payload IS NOT NULL;

CREATE INDEX idx_audit_events_tenant_resource_created
  ON audit_events(tenant_id, resource_type, resource_id, created_at, id);
