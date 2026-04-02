-- Migration 5: Add subscription billing fields to tenants
ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN billing_status TEXT DEFAULT 'active';
ALTER TABLE tenants ADD COLUMN owner_email TEXT;
ALTER TABLE tenants ADD COLUMN owner_phone TEXT;
ALTER TABLE tenants ADD COLUMN trial_ends_at TEXT;
