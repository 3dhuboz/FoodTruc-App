/**
 * GET /api/v1/_admin/check-fleet
 * Scans chowbox_devices for stale heartbeats (online flag set but
 * last_heartbeat older than `staleMinutes`, default 5) and pings ntfy.sh
 * with one message per stale device.
 *
 * Designed to be hit by an external cron (cron-job.org, GitHub Actions
 * cron, an upstream Workers cron triggering this URL, etc.) every few
 * minutes. Cloudflare Pages Functions don't have first-class scheduled
 * triggers, so this is a lightweight pull-based pattern.
 *
 * Required env:
 *   ADMIN_API_KEY        — gates the endpoint (Authorization: Bearer …)
 *   NTFY_TOPIC_URL       — full URL, e.g. https://ntfy.sh/chownow-alerts-XYZ
 *
 * Optional query:
 *   ?stale=10            — minutes since last_heartbeat to consider stale (default 5)
 *   ?dry=1               — return the stale set without firing notifications
 */
import { getDB } from '../_lib/db';
import { requireAdminKey } from '../_lib/auth';

interface StaleDevice {
  id: string;
  tenant_id: string;
  hostname: string | null;
  tunnel_url: string | null;
  last_heartbeat: string | null;
  minutes_since_heartbeat: number | null;
}

export const onRequest = async (context: any) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const denied = requireAdminKey(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const staleMinutes = Math.max(1, parseInt(url.searchParams.get('stale') || '5', 10));
  const dryRun = url.searchParams.get('dry') === '1';

  const db = getDB(env);
  const result = await db.prepare(`
    SELECT
      d.id,
      d.tenant_id,
      d.hostname,
      d.tunnel_url,
      d.last_heartbeat,
      CAST((julianday('now') - julianday(d.last_heartbeat)) * 24 * 60 AS REAL) as minutes_since_heartbeat
    FROM chowbox_devices d
    WHERE d.is_online = 1
      AND d.last_heartbeat IS NOT NULL
      AND datetime(d.last_heartbeat, '+' || ? || ' minutes') < datetime('now')
  `).bind(staleMinutes).all();

  const stale = (result.results || []) as unknown as StaleDevice[];

  let notified = 0;
  const ntfyUrl = (env as any).NTFY_TOPIC_URL;

  if (!dryRun && ntfyUrl && stale.length > 0) {
    const sends = stale.map(d => {
      const mins = d.minutes_since_heartbeat ? Math.round(d.minutes_since_heartbeat) : '?';
      const title = `ChowBox offline: ${d.tenant_id}`;
      const body = `${d.hostname || d.id} hasn't heartbeat for ${mins}m. Tunnel: ${d.tunnel_url || 'n/a'}`;
      return fetch(ntfyUrl, {
        method: 'POST',
        headers: {
          'Title': title,
          'Priority': 'high',
          'Tags': 'warning,chowbox',
        },
        body,
      })
        .then(() => { notified += 1; })
        .catch((e) => console.error('[check-fleet] ntfy error:', e?.message));
    });
    await Promise.allSettled(sends);

    // Flip is_online=0 so we don't re-alert on the same device every tick.
    // Real reactivation happens on the next heartbeat.
    const flips = stale.map(d =>
      db.prepare('UPDATE chowbox_devices SET is_online = 0 WHERE id = ?').bind(d.id).run()
    );
    await Promise.allSettled(flips);
  }

  return Response.json({
    staleMinutes,
    dryRun,
    staleCount: stale.length,
    notified,
    ntfyConfigured: !!ntfyUrl,
    devices: stale.map(d => ({
      id: d.id,
      tenant: d.tenant_id,
      hostname: d.hostname,
      tunnelUrl: d.tunnel_url,
      lastHeartbeat: d.last_heartbeat,
      minutesSinceHeartbeat: d.minutes_since_heartbeat ? Math.round(d.minutes_since_heartbeat) : null,
    })),
  }, { headers: { 'Access-Control-Allow-Origin': '*' } });
};
