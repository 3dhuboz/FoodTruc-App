/**
 * Stripe Checkout Session — creates a hosted payment page.
 * Customer pays on Stripe's hosted page (Apple Pay, Google Pay, card).
 * After payment, redirects back to our order status page.
 *
 * Body: { orderId, items: [{name, quantity, price}], total, customerName, customerPhone, source? }
 * Returns: { url: string } — redirect the customer here
 */
import { getDB, generateId, rowToOrder } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { tenantId } = await getTenantFromRequest(request, env);

  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 500);

  try {
    const body = await request.json();
    const orderId = body.orderId || generateId();
    const origin = new URL(request.url).origin;
    const source = body.source || 'qr'; // 'qr' or 'foh'

    // Look up tenant's Stripe Connect account for platform fee routing
    const db = getDB(env);
    const tenant = await db.prepare(
      'SELECT stripe_account_id, stripe_onboarding_complete FROM tenants WHERE id = ?'
    ).bind(tenantId).first() as any;
    const connectedAccountId = tenant?.stripe_onboarding_complete ? tenant.stripe_account_id : null;

    // Build Stripe line items from order items
    const lineItems = (body.items || []).map((item: any) => ({
      price_data: {
        currency: 'aud',
        product_data: {
          name: item.name || item.item?.name || 'Item',
        },
        unit_amount: Math.round((item.price || item.item?.price || 0) * 100), // Cents
      },
      quantity: item.quantity || 1,
    }));

    // FOH orders: customer scans QR on operator's screen -> pays on their phone -> simple "paid" page
    // QR orders: customer already on their phone -> redirect to order status
    const successUrl = source === 'foh'
      ? `${origin}/#/payment-success?order=${orderId}`
      : `${origin}/#/order-status/${orderId}?paid=true`;
    const cancelUrl = source === 'foh'
      ? `${origin}/#/payment-success?cancelled=true`
      : `${origin}/#/qr-order?cancelled=true`;

    // Create Stripe Checkout Session
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('metadata[orderId]', orderId);
    params.append('metadata[customerName]', body.customerName || '');
    params.append('metadata[customerPhone]', body.customerPhone || '');
    params.append('metadata[source]', source);
    params.append('payment_method_types[]', 'card');

    // Add each line item
    lineItems.forEach((item: any, i: number) => {
      params.append(`line_items[${i}][price_data][currency]`, item.price_data.currency);
      params.append(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(item.price_data.unit_amount));
      params.append(`line_items[${i}][quantity]`, String(item.quantity));
    });

    // Stripe Connect: route payment to tenant's connected account with platform fee
    if (connectedAccountId) {
      const platformRow = await db.prepare("SELECT data FROM settings WHERE tenant_id = 'default' AND key = 'platform'").first() as any;
      const feePercent = platformRow?.data ? (JSON.parse(platformRow.data).platformFeePercent ?? 1.5) : 1.5;
      const totalCents = lineItems.reduce((sum: number, item: any) => sum + (item.price_data.unit_amount * item.quantity), 0);
      const applicationFee = Math.round(totalCents * (feePercent / 100));
      params.append('payment_intent_data[application_fee_amount]', String(applicationFee));
      params.append('payment_intent_data[transfer_data][destination]', connectedAccountId);
    }

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ error: `Stripe error: ${err}` }, res.status);
    }

    const session = await res.json();

    // Pre-create the order as "Awaiting Payment" in D1
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO orders (id, tenant_id, user_id, customer_name, customer_email, customer_phone, items, total, status, cook_day, type, created_at, temperature, fulfillment_method, pickup_location, source, updated_at, square_checkout_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId, tenantId, source === 'foh' ? 'walk_up' : 'qr_customer', body.customerName || 'Customer',
      body.customerEmail || null, body.customerPhone || null,
      JSON.stringify(body.items || []), body.total || 0,
      'Awaiting Payment', now.split('T')[0], 'TAKEAWAY', now,
      'HOT', 'PICKUP', body.pickupLocation || '', source, now,
      session.id // Store Stripe session ID for webhook matching
    );

    return json({ url: session.url, orderId, sessionId: session.id });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
