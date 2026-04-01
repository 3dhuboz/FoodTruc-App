import { getDB, generateId, rowToUser } from '../_lib/db';
import { verifyAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM users ORDER BY name').all();
      return json(results.map(rowToUser));
    }

    if (request.method === 'POST') {
      const user = await request.json();
      const id = user.id || generateId();
      await db.prepare(
        `INSERT OR REPLACE INTO users (id, name, email, role, is_verified, phone, address, dietary_preferences, stamps, has_catering_discount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, user.name, user.email, user.role || 'CUSTOMER',
        user.isVerified ? 1 : 0, user.phone || null, user.address || null,
        user.dietaryPreferences || null, user.stamps || 0,
        user.hasCateringDiscount ? 1 : 0
      ).run();
      const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      return json(rowToUser(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
