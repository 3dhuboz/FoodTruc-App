-- Street Eats — Cloudflare D1 Schema (Multi-Tenant)
-- Fresh install: wrangler d1 execute foodtruck-db --file=schema.sql
-- Existing DB: use /api/v1/migrate endpoint instead

-- ─── Schema Version Tracking ─────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT DEFAULT (datetime('now'))
);

-- ─── Tenants ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subdomain TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter',
  stripe_customer_id TEXT,
  stripe_account_id TEXT,
  stripe_onboarding_complete INTEGER DEFAULT 0,
  stripe_subscription_id TEXT,
  billing_status TEXT DEFAULT 'active',
  owner_email TEXT,
  owner_phone TEXT,
  trial_ends_at TEXT,
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

-- Seed default tenant
INSERT OR IGNORE INTO tenants (id, name, slug, subdomain, plan, status, logo_url)
VALUES ('default', 'ChowNow', 'chownow', 'app', 'enterprise', 'active', '/logo.png');

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CUSTOMER',
  is_verified INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  address TEXT,
  dietary_preferences TEXT,
  stamps INTEGER DEFAULT 0,
  has_catering_discount INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── Menu Items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  unit TEXT,
  min_quantity INTEGER,
  preparation_options TEXT,
  image TEXT,
  category TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1,
  availability_type TEXT DEFAULT 'everyday',
  specific_date TEXT,
  specific_dates TEXT,
  is_pack INTEGER DEFAULT 0,
  pack_groups TEXT,
  available_for_catering INTEGER DEFAULT 0,
  catering_category TEXT,
  moq INTEGER
);

-- ─── Orders ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  items TEXT NOT NULL,
  total REAL NOT NULL,
  deposit_amount REAL,
  status TEXT NOT NULL DEFAULT 'Pending',
  cook_day TEXT NOT NULL,
  type TEXT NOT NULL,
  pickup_time TEXT,
  created_at TEXT NOT NULL,
  temperature TEXT,
  fulfillment_method TEXT,
  delivery_address TEXT,
  delivery_fee REAL,
  tracking_number TEXT,
  courier TEXT,
  collection_pin TEXT,
  pickup_location TEXT,
  discount_applied INTEGER DEFAULT 0,
  payment_intent_id TEXT,
  square_checkout_id TEXT,
  source TEXT DEFAULT 'walk_up',
  updated_at TEXT DEFAULT (datetime('now')),
  confirmed_at TEXT,
  cooking_at TEXT,
  ready_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT
);

-- ─── Calendar Events ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  time TEXT,
  start_time TEXT,
  end_time TEXT,
  order_id TEXT,
  image TEXT,
  tags TEXT
);

-- ─── Social Posts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  image TEXT,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  hashtags TEXT,
  published_at TEXT,
  platform_post_id TEXT,
  publish_error TEXT
);

-- ─── Gallery Posts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gallery_posts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL,
  approved INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  liked_by TEXT
);

-- ─── Settings (composite key: tenant + key) ─────────────────
CREATE TABLE IF NOT EXISTS settings (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (tenant_id, key)
);

-- ─── Cook Days ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cook_days (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  is_open INTEGER DEFAULT 1
);

-- ─── ChowBox Devices (fleet tracking) ───────────────────────
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
  pending_commands TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_tenant ON menu_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_tenant_category ON menu_items(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_menu_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_cook_day ON orders(tenant_id, cook_day);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_source ON orders(tenant_id, source);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_cook_day ON orders(cook_day);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON calendar_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_tenant ON social_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gallery_tenant ON gallery_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chowbox_tenant ON chowbox_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_tenant_key ON settings(tenant_id, key);
CREATE INDEX IF NOT EXISTS idx_cook_days_tenant ON cook_days(tenant_id);
