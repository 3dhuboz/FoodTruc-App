/**
 * POST /api/v1/print/order
 * Cloud relay — forwards print jobs to the ChowBox Pi via its tunnel URL.
 * Falls back gracefully if no ChowBox is reachable.
 */
import { getTenantFromRequest } from '../_lib/tenant';
import { getDB } from '../_lib/db';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  try {
    const { tenantId } = await getTenantFromRequest(request, env);
    const db = getDB(env);
    const body = await request.json();

    // Find the ChowBox tunnel URL for this tenant
    const device = await db.prepare(
      'SELECT tunnel_url FROM chowbox_devices WHERE tenant_id = ? AND tunnel_url IS NOT NULL ORDER BY last_heartbeat DESC LIMIT 1'
    ).bind(tenantId).first() as any;

    const tunnelUrl = device?.tunnel_url;
    if (!tunnelUrl) {
      return json({ printed: false, reason: 'No ChowBox connected. Printing requires a ChowBox with a Dymo printer.' });
    }

    // Relay to the Pi's print endpoint
    const piUrl = `${tunnelUrl.replace(/\/$/, '')}/print/order`;
    const res = await fetch(piUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      return json({ printed: false, reason: `ChowBox responded ${res.status}: ${err}` });
    }

    return new Response(res.body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return json({ printed: false, reason: err.message || 'Failed to reach ChowBox' });
  }
};
