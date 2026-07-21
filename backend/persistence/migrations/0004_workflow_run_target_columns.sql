ALTER TABLE workflow_runs ADD COLUMN triggered_by TEXT;
ALTER TABLE workflow_runs ADD COLUMN inputs TEXT NOT NULL DEFAULT '{}';
ALTER TABLE workflow_runs ADD COLUMN outputs TEXT;

UPDATE workflow_runs
SET triggered_by = user_id
WHERE triggered_by IS NULL;

UPDATE workflow_runs
SET inputs = input
WHERE input IS NOT NULL AND inputs = '{}';

UPDATE workflow_runs
SET outputs = output
WHERE outputs IS NULL AND output IS NOT NULL;

CREATE INDEX idx_workflow_runs_tenant_triggered_by_created
  ON workflow_runs(tenant_id, triggered_by, created_at, id);
