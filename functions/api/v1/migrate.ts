/**
 * Migration runner — applies SQL migrations to D1 in sequence.
 * Protected by ADMIN_API_KEY. Run via:
 *   curl -X POST https://chownow.au/api/v1/migrate -H "Authorization: Bearer $KEY"
 */
import { getDB } from './_lib/db';

const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'add_tenants',
    sql: `
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
      INSERT OR IGNORE INTO tenants (id, name, slug, subdomain, plan, status)
      VALUES ('default', 'ChowNow', 'chownow', 'app', 'enterprise', 'active');
    `
  },
  {
    version: 2,
    name: 'add_tenant_id',
    sql: `
      ALTER TABLE users ADD COLUMN tenant_id TEXT DEFAULT 'default';
      ALTER TABLE menu_items ADD COLUMN tenant_id TEXT DEFAULT 'default';
      ALTER TABLE orders ADD COLUMN tenant_id TEXT DEFAULT 'default';
      ALTER TABLE calendar_events ADD COLUMN tenant_id TEXT DEFAULT 'default';
      ALTER TABLE social_posts ADD COLUMN tenant_id TEXT DEFAULT 'default';
      ALTER TABLE gallery_posts ADD COLUMN tenant_id TEXT DEFAULT 'default';
      ALTER TABLE settings ADD COLUMN tenant_id TEXT DEFAULT 'default';
      ALTER TABLE cook_days ADD COLUMN tenant_id TEXT DEFAULT 'default';
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
    `
  },
  {
    version: 3,
    name: 'settings_composite_key',
    sql: `
      CREATE TABLE IF NOT EXISTS settings_v2 (
        tenant_id TEXT NOT NULL DEFAULT 'default',
        key TEXT NOT NULL,
        data TEXT,
        PRIMARY KEY (tenant_id, key)
      );
      INSERT OR IGNORE INTO settings_v2 (tenant_id, key, data)
      SELECT COALESCE(tenant_id, 'default'), key, data FROM settings;
      DROP TABLE IF EXISTS settings;
      ALTER TABLE settings_v2 RENAME TO settings;
      CREATE INDEX IF NOT EXISTS idx_settings_tenant_key ON settings(tenant_id, key);
    `
  },
  {
    version: 4,
    name: 'rebrand_chownow',
    sql: `
      UPDATE tenants SET name = 'ChowNow', slug = 'chownow', logo_url = '/logo.png', primary_color = '#f97316' WHERE id = 'default';
      UPDATE settings SET data = REPLACE(data, '"Street Eats"', '"ChowNow"') WHERE tenant_id = 'default' AND key = 'general';
    `
  },
  {
    version: 5,
    name: 'add_subscription_fields',
    sql: `
      ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT;
      ALTER TABLE tenants ADD COLUMN billing_status TEXT DEFAULT 'active';
      ALTER TABLE tenants ADD COLUMN owner_email TEXT;
      ALTER TABLE tenants ADD COLUMN owner_phone TEXT;
      ALTER TABLE tenants ADD COLUMN trial_ends_at TEXT;
    `
  },
  {
    version: 6,
    name: 'chowbox_devices',
    sql: `
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
    `
  },
];

export const onRequest = async (context: any) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Auth check — ADMIN_API_KEY required
  const authHeader = request.headers.get('Authorization');
  if (!env.ADMIN_API_KEY || authHeader !== `Bearer ${env.ADMIN_API_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = getDB(env);
  const applied: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // Ensure schema_versions exists (for first run)
  try {
    await db.prepare('CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT DEFAULT (datetime(\'now\')))').run();
  } catch (e: any) {
    errors.push(`schema_versions init: ${e.message}`);
  }

  for (const migration of MIGRATIONS) {
    try {
      const existing = await db.prepare('SELECT version FROM schema_versions WHERE version = ?').bind(migration.version).first();
      if (existing) {
        skipped.push(`${migration.version}: ${migration.name} (already applied)`);
        continue;
      }

      // Execute each statement separately (D1 doesn't support multi-statement exec)
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        await db.prepare(stmt).run();
      }

      await db.prepare('INSERT INTO schema_versions (version, name) VALUES (?, ?)').bind(migration.version, migration.name).run();
      applied.push(`${migration.version}: ${migration.name}`);
    } catch (e: any) {
      errors.push(`${migration.version} (${migration.name}): ${e.message}`);
      break; // Stop on first error
    }
  }

  return new Response(JSON.stringify({ applied, skipped, errors }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
};
