/**
 * GET /api/v1/admin/fleet
 * Returns all ChowBox devices with status.
 * Marks devices as offline if last_heartbeat > 2 minutes ago.
 */
import { getDB } from '../_lib/db';

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const db = getDB(env);

  // Get all devices, join with tenant name
  const devices = await db.prepare(`
    SELECT
      d.*,
      t.name as tenant_name,
      t.slug as tenant_slug,
      CASE
        WHEN d.last_heartbeat IS NULL THEN 0
        WHEN datetime(d.last_heartbeat, '+2 minutes') < datetime('now') THEN 0
        ELSE 1
      END as is_currently_online
    FROM chowbox_devices d
    LEFT JOIN tenants t ON d.tenant_id = t.id
    ORDER BY d.last_heartbeat DESC
  `).all();

  return Response.json({
    devices: devices.results || [],
    count: devices.results?.length || 0,
  }, {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
  });
};
