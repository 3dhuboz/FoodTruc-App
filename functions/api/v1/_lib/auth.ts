/**
 * Auth for Cloudflare Pages Functions.
 * Supports: Clerk JWT, admin API key, unauthenticated (QR/public orders).
 * When CLERK_PUBLISHABLE_KEY is not set, runs in setup mode (all admin).
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
}

export async function verifyAuth(request: Request, env: any): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization');

  // Admin API key backdoor
  if (env.ADMIN_API_KEY && authHeader === `Bearer ${env.ADMIN_API_KEY}`) {
    return { userId: 'admin1', role: 'ADMIN', email: 'admin@local' };
  }

  // Setup mode — no Clerk configured
  if (!env.CLERK_PUBLISHABLE_KEY) {
    return { userId: 'setup', role: 'ADMIN', email: 'setup@local' };
  }

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
