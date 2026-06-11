/**
 * POST /api/v1/heartbeat
 *
 * Receives heartbeats from ChowBox devices in the field. Per-device auth:
 * each device gets a long-lived token issued on first contact, hashed and
 * stored in `chowbox_devices.device_token_hash`. Subsequent heartbeats
 * MUST present the device token via `Authorization: Bearer …`.
 *
 * Bootstrap (first heartbeat for a deviceId):
 *   - If env.HEARTBEAT_DEVICE_SECRET is set, the Pi must present it as the
 *     bearer token. The cloud generates a fresh per-device token, stores its
 *     hash, and returns the plaintext token in the response (`deviceToken`).
 *   - If env.HEARTBEAT_DEVICE_SECRET is unset, TOFU mode: the first
 *     heartbeat without a token mints one (less secure — fine for solo /
 *     local dev, NOT recommended in production).
 *
 * Steady state:
 *   - Pi presents `Authorization: Bearer <device-token>`.
 *   - Cloud hashes it, looks up chowbox_devices.device_token_hash, verifies
 *     deviceId + tenantId match the body, accepts the heartbeat.
 *
 * The heartbeat response also returns `pending_commands` queued by super
 * admin (e.g. `update:v1.2.3`, `pause_qr_orders`).
 */
import { getDB } from '../_lib/db';
import { sha256Hex } from '../_lib/auth';

interface HeartbeatBody {
  deviceId?: string;
  tenantId?: string;
  hostname?: string;
  tunnelUrl?: string;
  ipAddress?: string;
  printerConnected?: boolean | number;
  ordersToday?: number;
  syncPending?: number;
  uptimeSeconds?: number;
  memoryMb?: number;
  nodeVersion?: string;
  releaseVersion?: string;
}

function generateToken(bytes: number = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: corsHeaders });

export const onRequestPost: PagesFunction<{
  DB: D1Database;
  HEARTBEAT_DEVICE_SECRET?: string;
}> = async ({ request, env }) => {
  const json = (data: any, status: number = 200) =>
    Response.json(data, { status, headers: { ...corsHeaders } });

  try {
    const body = (await request.json()) as HeartbeatBody;
    const { deviceId, tenantId } = body;
    if (!deviceId || !tenantId) {
      return json({ error: 'deviceId and tenantId required' }, 400);
    }

    const authHeader = request.headers.get('Authorization');
    const presentedToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const presentedHash = presentedToken ? await sha256Hex(presentedToken) : '';

    const db = getDB(env);
    const now = new Date().toISOString();

    const existing = await db
      .prepare('SELECT id, tenant_id, device_token_hash FROM chowbox_devices WHERE id = ?')
      .bind(deviceId)
      .first() as { id: string; tenant_id: string; device_token_hash: string | null } | null;

    let issuedToken: string | null = null;

    if (existing && existing.device_token_hash) {
      // Steady state — token must match.
      if (!presentedHash || presentedHash !== existing.device_token_hash) {
        return json({ error: 'Invalid device token' }, 401);
      }
      if (existing.tenant_id !== tenantId) {
        return json({ error: 'Tenant mismatch' }, 403);
      }
    } else {
      // Bootstrap path — must present the configured shared secret unless
      // the operator opted into TOFU by leaving HEARTBEAT_DEVICE_SECRET unset.
      const secret = env.HEARTBEAT_DEVICE_SECRET;
      if (secret) {
        if (presentedToken !== secret) {
          return json({ error: 'Bootstrap requires HEARTBEAT_DEVICE_SECRET' }, 401);
        }
      }
      issuedToken = generateToken(32);
    }

    const issuedHash = issuedToken ? await sha256Hex(issuedToken) : null;
    const tokenHashToStore = issuedHash ?? existing?.device_token_hash ?? null;

    await db.prepare(`
      INSERT INTO chowbox_devices (
        id, tenant_id, hostname, tunnel_url, ip_address,
        printer_connected, is_online, orders_today, sync_pending,
        uptime_seconds, memory_mb, node_version, release_version,
        device_token_hash, last_heartbeat, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
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
        release_version = excluded.release_version,
        device_token_hash = COALESCE(excluded.device_token_hash, chowbox_devices.device_token_hash),
        last_heartbeat = excluded.last_heartbeat
    `).bind(
      deviceId, tenantId, body.hostname || '', body.tunnelUrl || '', body.ipAddress || '',
      body.printerConnected ? 1 : 0, body.ordersToday || 0, body.syncPending || 0,
      body.uptimeSeconds || 0, body.memoryMb || 0, body.nodeVersion || '',
      body.releaseVersion || '', tokenHashToStore, now, now
    ).run();

    // Pop and return any pending commands queued by super admin.
    const after = await db
      .prepare('SELECT pending_commands, target_version FROM chowbox_devices WHERE id = ?')
      .bind(deviceId)
      .first() as { pending_commands: string | null; target_version: string | null } | null;

    let commands: string[] = [];
    if (after?.pending_commands) {
      try { commands = JSON.parse(after.pending_commands); } catch {}
      if (commands.length > 0) {
        await db.prepare('UPDATE chowbox_devices SET pending_commands = NULL WHERE id = ?')
          .bind(deviceId).run();
      }
    }

    // Inline a target_version directive if it differs from the device's
    // currently-running release_version. The Pi turns this into a `git
    // checkout v<X>` (see pi-server signed-tag handling).
    if (after?.target_version && after.target_version !== body.releaseVersion) {
      commands.push(`update:${after.target_version}`);
    }

    return json({
      ok: true,
      commands,
      ...(issuedToken ? { deviceToken: issuedToken } : {}),
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
};
