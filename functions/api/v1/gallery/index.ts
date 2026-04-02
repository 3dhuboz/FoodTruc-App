import { getDB, generateId, rowToGalleryPost } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const db = getDB(env);
    if (request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM gallery_posts WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
      return json(results.map(rowToGalleryPost));
    }
    if (request.method === 'POST') {
      const post = await request.json();
      const id = post.id || generateId();
      await db.prepare(
        `INSERT OR REPLACE INTO gallery_posts (id, tenant_id, user_id, user_name, image_url, caption, created_at, approved, likes, liked_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, tenantId, post.userId, post.userName, post.imageUrl, post.caption || '',
        post.createdAt || new Date().toISOString(), post.approved ? 1 : 0,
        post.likes || 0, post.likedBy ? JSON.stringify(post.likedBy) : '[]'
      ).run();
      const row = await db.prepare('SELECT * FROM gallery_posts WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
      return json(rowToGalleryPost(row));
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
