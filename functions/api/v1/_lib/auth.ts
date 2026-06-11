/**
 * Auth for Cloudflare Pages Functions.
 * Supports: Clerk JWT, admin API key, unauthenticated (QR/public orders).
 *
 * SECURITY: Fail closed. If Clerk is not configured, ADMIN access is denied
 * (was previously auto-granted in "setup mode" — that backdoor is removed).
 * Callers needing privileged access without Clerk must use ADMIN_API_KEY.
 */

let cachedJwks: any = null;
let jwksCachedAt = 0;
const JWKS_TTL = 3600000;

async function fetchJwks(clerkPublishableKey: string): Promise<any> {
  const now = Date.now();
  if (cachedJwks && now - jwksCachedAt < JWKS_TTL) return cachedJwks;
  const domain = clerkPublishableKey.replace('pk_test_', '').replace('pk_live_', '').replace(/=$/, '');
  const url = `https://${domain}.clerk.accounts.dev/.well-known/jwks.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);
  cachedJwks = await res.json();
  jwksCachedAt = now;
  return cachedJwks;
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface AuthResult {
  userId: string;
  role: string;
  email: string;
  tenantId: string | null;
}

export async function verifyAuth(request: Request, env: any): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization');

  // Admin API key — explicit, opt-in admin access
  if (env.ADMIN_API_KEY && authHeader === `Bearer ${env.ADMIN_API_KEY}`) {
    return { userId: 'admin1', role: 'ADMIN', email: 'admin@local', tenantId: 'default' };
  }

  // Without Clerk configured, no further auth is possible. Fail closed.
  if (!env.CLERK_PUBLISHABLE_KEY) return null;

  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;
    const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)));
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;

    const jwks = await fetchJwks(env.CLERK_PUBLISHABLE_KEY);
    const jwk = jwks.keys?.find((k: any) => k.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, data, base64urlDecode(signatureB64));
    if (!valid) return null;

    return {
      userId: payload.sub || '',
      role: payload.publicMetadata?.role || 'CUSTOMER',
      email: payload.email || '',
      tenantId: payload.publicMetadata?.tenantId || null,
    };
  } catch {
    return null;
  }
}

export function requireAuth(auth: AuthResult | null, minRole?: string): AuthResult {
  if (!auth) throw { status: 401, message: 'Unauthorized' };
  if (minRole) {
    const hierarchy = ['GUEST', 'CUSTOMER', 'ADMIN', 'DEV'];
    if (hierarchy.indexOf(auth.role) < hierarchy.indexOf(minRole)) {
      throw { status: 403, message: 'Forbidden' };
    }
  }
  return auth;
}

/**
 * Lightweight gate for endpoints that must be admin-only but don't yet
 * have user-level Clerk auth wired up (admin/* routes, /seed, /migrate, etc.).
 * Returns null on success, or a 401 Response on failure (caller should return it).
 */
export function requireAdminKey(request: Request, env: any): Response | null {
  const authHeader = request.headers.get('Authorization');
  if (!env.ADMIN_API_KEY || authHeader !== `Bearer ${env.ADMIN_API_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  return null;
}

/**
 * True if the request bears a valid ADMIN_API_KEY. Useful as a side-channel check
 * (e.g. allowing X-Tenant-ID override only for admin tooling).
 */
export function hasValidAdminKey(request: Request, env: any): boolean {
  const authHeader = request.headers.get('Authorization');
  return !!env.ADMIN_API_KEY && authHeader === `Bearer ${env.ADMIN_API_KEY}`;
}

/**
 * SHA-256 hex digest. Used to fingerprint per-device tokens before storage.
 */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface DeviceAuth {
  deviceId: string;
  tenantId: string;
}

/**
 * Verify a per-ChowBox device token presented as `Authorization: Bearer …`.
 * Returns { deviceId, tenantId } on success, null otherwise.
 *
 * This is the primary auth path for traffic FROM Pi servers TO the cloud:
 * the Pi presents its persisted token, the cloud hashes it and looks up
 * the matching `chowbox_devices` row to identify the device + tenant.
 */
export async function verifyDeviceToken(request: Request, env: any): Promise<DeviceAuth | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // Skip if it's the admin API key — that's a separate auth path.
  if (env.ADMIN_API_KEY && token === env.ADMIN_API_KEY) return null;
  // Skip if it's the bootstrap shared secret — that path is handled by /heartbeat.
  if (env.HEARTBEAT_DEVICE_SECRET && token === env.HEARTBEAT_DEVICE_SECRET) return null;

  const hash = await sha256Hex(token);
  // Lazy import to avoid circular dependency with _lib/db.
  const { getDB } = await import('./db');
  const db = getDB(env);
  const row = await db
    .prepare('SELECT id, tenant_id FROM chowbox_devices WHERE device_token_hash = ?')
    .bind(hash)
    .first() as { id: string; tenant_id: string } | null;
  if (!row) return null;
  return { deviceId: row.id, tenantId: row.tenant_id };
}
