import { getDB, rowToUser } from '../_lib/db';

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const id = params.id;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'Not found' }, 404);
      return json(rowToUser(row));
    }

    if (request.method === 'PUT') {
      const data = await request.json();
      const fields: string[] = [];
      const binds: any[] = [];
      const updatable: Record<string, string> = {
        name: 'name', email: 'email', role: 'role', phone: 'phone',
        address: 'address', dietaryPreferences: 'dietary_preferences',
        stamps: 'stamps', hasCateringDiscount: 'has_catering_discount',
      };
      for (const [key, col] of Object.entries(updatable)) {
        if (data[key] !== undefined) {
          fields.push(`${col} = ?`);
          binds.push(key === 'hasCateringDiscount' ? (data[key] ? 1 : 0) : data[key]);
        }
      }
      if (fields.length === 0) return json({ error: 'No fields' }, 400);
      fields.push('updated_at = ?');
      binds.push(new Date().toISOString());
      binds.push(id);
      await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
      const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      return json(rowToUser(row));
    }

    if (request.method === 'DELETE') {
      await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
