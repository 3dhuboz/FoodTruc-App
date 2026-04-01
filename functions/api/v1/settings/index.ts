import { getDB, parseJson } from '../_lib/db';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM settings').all();
      const settings: Record<string, any> = {};
      for (const row of results as any[]) {
        Object.assign(settings, parseJson(row.data, {}));
      }
      return json(settings);
    }

    if (request.method === 'PUT') {
      const data = await request.json();
      // Store as single 'general' key for simplicity
      const existing = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first() as any;
      const merged = { ...parseJson(existing?.data, {}), ...data };
      await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)").bind(JSON.stringify(merged)).run();
      return json(merged);
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message || 'Internal Server Error' }, err.status || 500);
  }
};
