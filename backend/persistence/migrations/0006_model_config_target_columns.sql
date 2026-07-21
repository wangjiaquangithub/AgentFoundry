ALTER TABLE model_configs ADD COLUMN base_url TEXT;
ALTER TABLE model_configs ADD COLUMN credential_ref TEXT;

UPDATE model_configs
SET credential_ref = config_ref
WHERE credential_ref IS NULL AND config_ref IS NOT NULL;
