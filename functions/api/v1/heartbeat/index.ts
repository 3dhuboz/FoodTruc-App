/**
 * POST /api/v1/heartbeat
 * Receives heartbeat from ChowBox devices.
 * Upserts device status into chowbox_devices table.
 * No auth — device identifies by deviceId + tenantId.
 */
import { getDB } from '../_lib/db';

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  try {
    const body = await request.json() as any;
    const { deviceId, tenantId, hostname, tunnelUrl, printerConnected, ordersToday, syncPending, uptimeSeconds, memoryMb, nodeVersion, ipAddress } = body;

    if (!deviceId || !tenantId) {
      return Response.json({ error: 'deviceId and tenantId required' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const db = getDB(env);
    const now = new Date().toISOString();

    // Upsert — insert or update on conflict
    await db.prepare(`
      INSERT INTO chowbox_devices (id, tenant_id, hostname, tunnel_url, ip_address, printer_connected, is_online, orders_today, sync_pending, uptime_seconds, memory_mb, node_version, last_heartbeat, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        hostname = excluded.hostname,
        tunnel_url = excluded.tunnel_url,
        ip_address = excluded.ip_address,
        printer_connected = excluded.printer_connected,
        is_online = 1,
        orders_today = excluded.orders_today,
        sync_pending = excluded.sync_pending,
        uptime_seconds = excluded.uptime_seconds,
        memory_mb = excluded.memory_mb,
        node_version = excluded.node_version,
        last_heartbeat = excluded.last_heartbeat
    `).bind(
      deviceId, tenantId, hostname || '', tunnelUrl || '', ipAddress || '',
      printerConnected ? 1 : 0, ordersToday || 0, syncPending || 0,
      uptimeSeconds || 0, memoryMb || 0, nodeVersion || '', now, now
    ).run();

    return Response.json({ ok: true }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
  });
};
