import { getDB, generateId, rowToOrder } from '../_lib/db';
import { verifyAuth } from '../_lib/auth';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      // Public polling endpoint — supports ?since= for incremental updates
      const url = new URL(request.url);
      const since = url.searchParams.get('since');
      const status = url.searchParams.get('status');
      const today = url.searchParams.get('today');

      let query = 'SELECT * FROM orders';
      const conditions: string[] = ['tenant_id = ?'];
      const binds: any[] = [tenantId];

      if (since) { conditions.push('updated_at > ?'); binds.push(since); }
      if (status) { conditions.push('status = ?'); binds.push(status); }
      if (today) { conditions.push('cook_day = ?'); binds.push(today); }

      query += ' WHERE ' + conditions.join(' AND ');
      query += ' ORDER BY created_at DESC';

      const stmt = db.prepare(query).bind(...binds);
      const { results } = await stmt.all();
      return json(results.map(rowToOrder));
    }

    if (request.method === 'POST') {
      const order = await request.json();
      const id = order.id || generateId();
      const now = new Date().toISOString();

      // Auto-generate collection PIN if not provided (e.g., "A47", "C12")
      let pin = order.collectionPin;
      if (!pin) {
        const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
        const num = String(Math.floor(Math.random() * 90) + 10); // 10-99
        pin = letter + num;
      }

      await db.prepare(
        `INSERT INTO orders (id, tenant_id, user_id, customer_name, customer_email, customer_phone, items, total, deposit_amount, status, cook_day, type, pickup_time, created_at, temperature, fulfillment_method, delivery_address, delivery_fee, collection_pin, pickup_location, discount_applied, payment_intent_id, square_checkout_id, source, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, tenantId, order.userId || '', order.customerName, order.customerEmail || null,
        order.customerPhone || null, JSON.stringify(order.items), order.total,
        order.depositAmount || null, order.status || 'Pending', order.cookDay,
        order.type, order.pickupTime || null, order.createdAt || now,
        order.temperature || 'HOT', order.fulfillmentMethod || 'PICKUP',
        order.deliveryAddress || null, order.deliveryFee || null,
        pin, order.pickupLocation || null,
        order.discountApplied ? 1 : 0, order.paymentIntentId || null,
        order.squareCheckoutId || null, order.source || 'walk_up', now
      ).run();

      const row = await db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
      return json(rowToOrder(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message || 'Internal Server Error' }, err.status || 500);
  }
};
