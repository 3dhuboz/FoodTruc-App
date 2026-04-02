import { getDB, generateId, rowToUser } from '../_lib/db';
import { verifyAuth } from '../_lib/auth';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM users WHERE tenant_id = ? ORDER BY name').bind(tenantId).all();
      return json(results.map(rowToUser));
    }

    if (request.method === 'POST') {
      const user = await request.json();
      const id = user.id || generateId();
      await db.prepare(
        `INSERT OR REPLACE INTO users (id, tenant_id, name, email, role, is_verified, phone, address, dietary_preferences, stamps, has_catering_discount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, tenantId, user.name, user.email, user.role || 'CUSTOMER',
        user.isVerified ? 1 : 0, user.phone || null, user.address || null,
        user.dietaryPreferences || null, user.stamps || 0,
        user.hasCateringDiscount ? 1 : 0
      ).run();
      const row = await db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
      return json(rowToUser(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
