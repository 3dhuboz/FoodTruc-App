import { getDB, generateId, rowToEvent } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM calendar_events WHERE tenant_id = ? ORDER BY date DESC').bind(tenantId).all();
      return json(results.map(rowToEvent));
    }

    if (request.method === 'POST') {
      const event = await request.json();
      const id = event.id || generateId();
      await db.prepare(
        `INSERT OR REPLACE INTO calendar_events (id, tenant_id, date, type, title, description, location, time, start_time, end_time, order_id, image, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, tenantId, event.date, event.type, event.title, event.description || null,
        event.location || null, event.time || null, event.startTime || null,
        event.endTime || null, event.orderId || null, event.image || null,
        event.tags ? JSON.stringify(event.tags) : null
      ).run();
      const row = await db.prepare('SELECT * FROM calendar_events WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
      return json(rowToEvent(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
