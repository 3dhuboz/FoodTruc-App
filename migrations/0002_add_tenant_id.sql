-- Migration 0002: Add tenant_id column to all existing tables
-- DEFAULT 'default' ensures all existing rows are auto-tagged

ALTER TABLE users ADD COLUMN tenant_id TEXT DEFAULT 'default';
ALTER TABLE menu_items ADD COLUMN tenant_id TEXT DEFAULT 'default';
ALTER TABLE orders ADD COLUMN tenant_id TEXT DEFAULT 'default';
ALTER TABLE calendar_events ADD COLUMN tenant_id TEXT DEFAULT 'default';
ALTER TABLE social_posts ADD COLUMN tenant_id TEXT DEFAULT 'default';
ALTER TABLE gallery_posts ADD COLUMN tenant_id TEXT DEFAULT 'default';
ALTER TABLE settings ADD COLUMN tenant_id TEXT DEFAULT 'default';
ALTER TABLE cook_days ADD COLUMN tenant_id TEXT DEFAULT 'default';

-- Composite indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_tenant ON menu_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_tenant_category ON menu_items(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_cook_day ON orders(tenant_id, cook_day);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_source ON orders(tenant_id, source);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON calendar_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_tenant ON social_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gallery_tenant ON gallery_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cook_days_tenant ON cook_days(tenant_id);

INSERT OR IGNORE INTO schema_versions (version, name) VALUES (2, 'add_tenant_id');
