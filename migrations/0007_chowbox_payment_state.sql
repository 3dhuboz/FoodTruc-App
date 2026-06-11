ALTER TABLE orders ADD COLUMN payment_state TEXT DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN payment_method TEXT;
ALTER TABLE orders ADD COLUMN payment_provider TEXT;
ALTER TABLE orders ADD COLUMN provider_reference TEXT;
ALTER TABLE orders ADD COLUMN operator_confirmed_by TEXT;
ALTER TABLE orders ADD COLUMN payment_risk_level TEXT DEFAULT 'none';
ALTER TABLE orders ADD COLUMN sync_state TEXT DEFAULT 'local';

CREATE INDEX IF NOT EXISTS idx_orders_tenant_payment_state ON orders(tenant_id, payment_state);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_sync_state ON orders(tenant_id, sync_state);
