import { getDB, rowToEvent } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const id = params.id;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const db = getDB(env);
    if (request.method === 'GET') {
      const row = await db.prepare('SELECT * FROM calendar_events WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
      if (!row) return json({ error: 'Not found' }, 404);
      return json(rowToEvent(row));
    }
    if (request.method === 'DELETE') {
      await db.prepare('DELETE FROM calendar_events WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
      return new Response(null, { status: 204 });
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
