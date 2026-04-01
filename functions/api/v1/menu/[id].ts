import { getDB, rowToMenuItem } from '../_lib/db';

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const id = params.id;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const row = await db.prepare('SELECT * FROM menu_items WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'Not found' }, 404);
      return json(rowToMenuItem(row));
    }

    if (request.method === 'DELETE') {
      await db.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
