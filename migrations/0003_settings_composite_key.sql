-- Migration 0003: Recreate settings with (tenant_id, key) composite primary key
-- SQLite cannot ALTER primary keys, so we recreate the table

CREATE TABLE IF NOT EXISTS settings_v2 (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  data TEXT,
  PRIMARY KEY (tenant_id, key)
);

-- Copy existing data
INSERT OR IGNORE INTO settings_v2 (tenant_id, key, data)
SELECT COALESCE(tenant_id, 'default'), key, data FROM settings;

-- Swap tables
DROP TABLE IF EXISTS settings;
ALTER TABLE settings_v2 RENAME TO settings;

CREATE INDEX IF NOT EXISTS idx_settings_tenant_key ON settings(tenant_id, key);

INSERT OR IGNORE INTO schema_versions (version, name) VALUES (3, 'settings_composite_key');
