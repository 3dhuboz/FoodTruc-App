/**
 * GET /api/v1/admin/orders?tenant_id=...&status=...&limit=50&offset=0
 * Returns orders for a specific tenant. Super-admin endpoint.
 */
import { getDB, rowToOrder } from '../_lib/db';

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenant_id');
  if (!tenantId) {
    return Response.json({ error: 'tenant_id is required' }, {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const db = getDB(env);

  let sql = 'SELECT * FROM orders WHERE tenant_id = ?';
  const binds: any[] = [tenantId];

  if (status) {
    sql += ' AND status = ?';
    binds.push(status);
  }

  // Get total count for pagination
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countRow = await db.prepare(countSql).bind(...binds).first<{ count: number }>();

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const result = await db.prepare(sql).bind(...binds).all();
  const orders = (result.results || []).map(rowToOrder);

  return Response.json({
    orders,
    total: countRow?.count || 0,
    limit,
    offset,
  }, {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
