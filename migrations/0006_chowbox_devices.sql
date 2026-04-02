-- Migration 6: ChowBox device fleet tracking
CREATE TABLE IF NOT EXISTS chowbox_devices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hostname TEXT,
  tunnel_url TEXT,
  ip_address TEXT,
  printer_connected INTEGER DEFAULT 0,
  is_online INTEGER DEFAULT 1,
  orders_today INTEGER DEFAULT 0,
  sync_pending INTEGER DEFAULT 0,
  uptime_seconds INTEGER DEFAULT 0,
  memory_mb INTEGER DEFAULT 0,
  node_version TEXT,
  last_heartbeat TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chowbox_tenant ON chowbox_devices(tenant_id);
