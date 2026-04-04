import { getDB, rowToOrder } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const id = params.id;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const db = getDB(env);

    // GET single order — public (for customer order status tracking)
    if (request.method === 'GET') {
      const row = await db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
      if (!row) return json({ error: 'Order not found' }, 404);
      return json(rowToOrder(row));
    }

    // PUT — update order (status change, etc.)
    if (request.method === 'PUT') {
      const data = await request.json();
      const fields: string[] = [];
      const binds: any[] = [];

      const updatable: Record<string, string> = {
        status: 'status', customerName: 'customer_name', customerEmail: 'customer_email',
        customerPhone: 'customer_phone', items: 'items', total: 'total',
        depositAmount: 'deposit_amount', pickupTime: 'pickup_time',
        temperature: 'temperature', fulfillmentMethod: 'fulfillment_method',
        deliveryAddress: 'delivery_address', deliveryFee: 'delivery_fee',
        trackingNumber: 'tracking_number', courier: 'courier',
        collectionPin: 'collection_pin', pickupLocation: 'pickup_location',
        paymentIntentId: 'payment_intent_id', squareCheckoutId: 'square_checkout_id',
      };

      for (const [key, col] of Object.entries(updatable)) {
        if (data[key] !== undefined) {
          fields.push(`${col} = ?`);
          binds.push(key === 'items' ? JSON.stringify(data[key]) : data[key]);
        }
      }

      if (fields.length === 0) return json({ error: 'No fields to update' }, 400);

      // Auto-set status timestamps for analytics
      const now = new Date().toISOString();
      if (data.status) {
        const tsMap: Record<string, string> = {
          'Confirmed': 'confirmed_at', 'Cooking': 'cooking_at',
          'Ready': 'ready_at', 'Completed': 'completed_at',
          'Cancelled': 'cancelled_at',
        };
        const tsCol = tsMap[data.status];
        if (tsCol) { fields.push(`${tsCol} = ?`); binds.push(now); }
      }

      fields.push('updated_at = ?');
      binds.push(now);
      binds.push(id);
      binds.push(tenantId);

      await db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...binds).run();
      const row = await db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
      return json(rowToOrder(row));
    }

    if (request.method === 'DELETE') {
      await db.prepare('DELETE FROM orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message || 'Internal Server Error' }, err.status || 500);
  }
};
