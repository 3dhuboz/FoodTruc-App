import { getDB, rowToGalleryPost } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const id = params.id;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const db = getDB(env);
    if (request.method === 'PUT') {
      const data = await request.json();
      const fields: string[] = [];
      const binds: any[] = [];
      if (data.approved !== undefined) { fields.push('approved = ?'); binds.push(data.approved ? 1 : 0); }
      if (data.likes !== undefined) { fields.push('likes = ?'); binds.push(data.likes); }
      if (data.likedBy !== undefined) { fields.push('liked_by = ?'); binds.push(JSON.stringify(data.likedBy)); }
      if (fields.length === 0) return json({ error: 'No fields' }, 400);
      binds.push(id, tenantId);
      await db.prepare(`UPDATE gallery_posts SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...binds).run();
      const row = await db.prepare('SELECT * FROM gallery_posts WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
      return json(rowToGalleryPost(row));
    }
    if (request.method === 'DELETE') {
      await db.prepare('DELETE FROM gallery_posts WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
      return new Response(null, { status: 204 });
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
