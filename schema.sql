-- Street Eats — Cloudflare D1 Schema
-- Run: wrangler d1 execute foodtruck-db --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  unit TEXT,
  min_quantity INTEGER,
  preparation_options TEXT,           -- JSON array
  image TEXT,
  category TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1,
  availability_type TEXT DEFAULT 'everyday',
  specific_date TEXT,
  specific_dates TEXT,                -- JSON array
  is_pack INTEGER DEFAULT 0,
  pack_groups TEXT,                   -- JSON array
  available_for_catering INTEGER DEFAULT 0,
  catering_category TEXT,
  moq INTEGER
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  items TEXT NOT NULL,                -- JSON array
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
  source TEXT DEFAULT 'walk_up',      -- walk_up | qr | online | catering
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
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
  tags TEXT                           -- JSON array
);

CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  image TEXT,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  hashtags TEXT,                      -- JSON array
  published_at TEXT,
  platform_post_id TEXT,
  publish_error TEXT
);

CREATE TABLE IF NOT EXISTS gallery_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL,
  approved INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  liked_by TEXT                       -- JSON array
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL                  -- JSON blob
);

CREATE TABLE IF NOT EXISTS cook_days (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  is_open INTEGER DEFAULT 1
);

-- Indexes for order queries (BOH/FOH need fast lookups)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_cook_day ON orders(cook_day);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_menu_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category);
