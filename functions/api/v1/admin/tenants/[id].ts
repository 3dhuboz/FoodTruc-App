/**
 * GET /api/v1/admin/tenants/:id — Single tenant with full metrics
 * PUT /api/v1/admin/tenants/:id — Update tenant fields
 * Super-admin endpoint for the platform operator.
 */
import { getDB } from '../../_lib/db';

const json = (d: any, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const id = params.id;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const row = await db.prepare(`
        SELECT
          t.*,
          (SELECT COUNT(*) FROM orders WHERE tenant_id = t.id) as total_orders,
          (SELECT COUNT(*) FROM orders WHERE tenant_id = t.id AND created_at >= date('now')) as orders_today,
          (SELECT COUNT(*) FROM menu_items WHERE tenant_id = t.id) as menu_count,
          (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
          d.id as device_id,
          d.is_online as device_online,
          d.last_heartbeat as device_heartbeat,
          d.printer_connected as device_printer,
          d.tunnel_url as device_tunnel_url
        FROM tenants t
        LEFT JOIN chowbox_devices d ON d.tenant_id = t.id
        WHERE t.id = ?
      `).bind(id).first();

      if (!row) return json({ error: 'Tenant not found' }, 404);
      return json(row);
    }

    if (request.method === 'PUT') {
      const data = await request.json();
      const fields: string[] = [];
      const binds: any[] = [];

      const updatable: Record<string, string> = {
        name: 'name',
        plan: 'plan',
        status: 'status',
        billing_status: 'billing_status',
        owner_email: 'owner_email',
        owner_phone: 'owner_phone',
        primary_color: 'primary_color',
        logo_url: 'logo_url',
        business_address: 'business_address',
        phone: 'phone',
        email: 'email',
        timezone: 'timezone',
      };

      for (const [key, col] of Object.entries(updatable)) {
        if (data[key] !== undefined) {
          fields.push(`${col} = ?`);
          binds.push(data[key]);
        }
      }

      if (fields.length === 0) return json({ error: 'No fields to update' }, 400);

      fields.push('updated_at = ?');
      binds.push(new Date().toISOString());
      binds.push(id);

      await db.prepare(`UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();

      const row = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(id).first();
      return json(row);
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message || 'Internal Server Error' }, 500);
  }
};
