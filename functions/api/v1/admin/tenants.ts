/**
 * GET /api/v1/admin/tenants
 * Returns all tenants with order counts and ChowBox status.
 * Super-admin endpoint for the platform operator.
 */
import { getDB } from '../_lib/db';

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const db = getDB(env);

  const tenants = await db.prepare(`
    SELECT
      t.*,
      (SELECT COUNT(*) FROM orders WHERE tenant_id = t.id) as total_orders,
      (SELECT COUNT(*) FROM orders WHERE tenant_id = t.id AND created_at >= date('now')) as orders_today,
      (SELECT COUNT(*) FROM menu_items WHERE tenant_id = t.id) as menu_count,
      (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
      d.id as device_id,
      d.is_online as device_online,
      d.last_heartbeat as device_heartbeat,
      d.printer_connected as device_printer
    FROM tenants t
    LEFT JOIN chowbox_devices d ON d.tenant_id = t.id
    WHERE t.id != 'default'
    ORDER BY t.created_at DESC
  `).all();

  return Response.json({
    tenants: tenants.results || [],
    count: tenants.results?.length || 0,
  }, {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
  });
};
