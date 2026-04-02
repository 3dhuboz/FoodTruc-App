-- Migration 0001: Create tenants table
-- Tracks all subscribed food truck businesses

CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subdomain TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter',
  stripe_customer_id TEXT,
  stripe_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#dc2626',
  business_address TEXT,
  phone TEXT,
  email TEXT,
  timezone TEXT DEFAULT 'Australia/Brisbane',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Seed default tenant so all existing data belongs to it
INSERT OR IGNORE INTO tenants (id, name, slug, subdomain, plan, status)
VALUES ('default', 'Street Eats', 'street-eats', 'app', 'enterprise', 'active');

INSERT OR IGNORE INTO schema_versions (version, name) VALUES (1, 'add_tenants');
