/**
 * Tenant resolution middleware for multi-tenant SaaS.
 * Resolves tenant from: subdomain → 'default' fallback.
 *
 * SECURITY: The X-Tenant-ID header is ONLY honoured for callers presenting
 * either (a) a valid ADMIN_API_KEY, or (b) a valid per-device token whose
 * tenant_id matches the requested header. Anonymous and customer-authenticated
 * requests are resolved strictly from the request hostname to prevent
 * cross-tenant access.
 */
import { getDB } from './db';
import { hasValidAdminKey, verifyDeviceToken } from './auth';

const BASE_DOMAIN = 'chownow.au';

export interface TenantContext {
  tenantId: string;
  tenant: TenantRow | null;
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  plan: string;
  stripe_customer_id: string | null;
  stripe_account_id: string | null;
  status: string;
  logo_url: string | null;
  primary_color: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
}

/**
 * Extract subdomain from Host header.
 * "smokyjoes.chownow.au" → "smokyjoes"
 * "chownow.au" → null
 * "localhost:5173" → null
 */
function extractSubdomain(host: string): string | null {
  // Strip port
  const hostname = host.split(':')[0];

  // Local/IP — no subdomain
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  // Check if it's a *.chownow.au subdomain
  if (hostname.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = hostname.slice(0, -(BASE_DOMAIN.length + 1));
    // Ignore 'www' as a tenant subdomain
    if (sub && sub !== 'www') return sub;
  }

  return null;
}

/**
 * Resolve tenant from the request context.
 * Priority: subdomain → 'default' fallback. The X-Tenant-ID header is only
 * honoured for authenticated admin tooling (ADMIN_API_KEY) — never for
 * anonymous or customer requests, since it would let a caller on tenant A
 * read/write tenant B's data.
 */
export async function getTenantFromRequest(request: Request, env: any): Promise<TenantContext> {
  const db = getDB(env);

  const headerTenantId = request.headers.get('X-Tenant-ID');

  // 1a. Admin tooling escape hatch
  if (headerTenantId && hasValidAdminKey(request, env)) {
    const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ? AND status = ?').bind(headerTenantId, 'active').first() as TenantRow | null;
    return { tenantId: headerTenantId, tenant };
  }

  // 1b. Pi-server (device-token) calls — only allowed to scope to their own tenant
  if (headerTenantId) {
    const device = await verifyDeviceToken(request, env);
    if (device && device.tenantId === headerTenantId) {
      const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ? AND status = ?').bind(headerTenantId, 'active').first() as TenantRow | null;
      return { tenantId: headerTenantId, tenant };
    }
  }

  // 2. Subdomain — primary resolution path
  const host = request.headers.get('Host') || '';
  const subdomain = extractSubdomain(host);
  if (subdomain) {
    const tenant = await db.prepare('SELECT * FROM tenants WHERE subdomain = ? AND status = ?').bind(subdomain, 'active').first() as TenantRow | null;
    if (tenant) return { tenantId: tenant.id, tenant };
    // Subdomain exists but no matching tenant — still fall through to default
    // (could return 404 here for stricter isolation)
  }

  // 3. Fallback — default tenant
  const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind('default').first() as TenantRow | null;
  return { tenantId: 'default', tenant };
}
