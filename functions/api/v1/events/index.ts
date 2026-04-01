import { getDB, generateId, rowToEvent } from '../_lib/db';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM calendar_events ORDER BY date DESC').all();
      return json(results.map(rowToEvent));
    }

    if (request.method === 'POST') {
      const event = await request.json();
      const id = event.id || generateId();
      await db.prepare(
        `INSERT OR REPLACE INTO calendar_events (id, date, type, title, description, location, time, start_time, end_time, order_id, image, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, event.date, event.type, event.title, event.description || null,
        event.location || null, event.time || null, event.startTime || null,
        event.endTime || null, event.orderId || null, event.image || null,
        event.tags ? JSON.stringify(event.tags) : null
      ).run();
      const row = await db.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first();
      return json(rowToEvent(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
