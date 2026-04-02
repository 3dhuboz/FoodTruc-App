import { getDB, generateId, rowToSocialPost } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const db = getDB(env);
    if (request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM social_posts WHERE tenant_id = ? ORDER BY scheduled_for DESC').bind(tenantId).all();
      return json(results.map(rowToSocialPost));
    }
    if (request.method === 'POST') {
      const post = await request.json();
      const id = post.id || generateId();
      await db.prepare(
        `INSERT OR REPLACE INTO social_posts (id, tenant_id, platform, content, image, scheduled_for, status, hashtags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, tenantId, post.platform, post.content, post.image || null,
        post.scheduledFor, post.status || 'Draft',
        post.hashtags ? JSON.stringify(post.hashtags) : null
      ).run();
      const row = await db.prepare('SELECT * FROM social_posts WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
      return json(rowToSocialPost(row));
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
