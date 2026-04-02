/**
 * Stripe Webhook — handles payment events.
 * When a Checkout Session completes, marks the order as "Confirmed" (paid).
 *
 * Setup: In Stripe Dashboard → Webhooks → add endpoint:
 *   URL: https://chownow.au/api/v1/stripe/webhook
 *   Events: checkout.session.completed
 */
import { getDB } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    const event = body;

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const orderId = session?.metadata?.orderId;

      if (orderId) {
        const db = getDB(env);
        const now = new Date().toISOString();

        // Webhooks come from Stripe, not a tenant subdomain.
        // Look up the order first and derive tenantId from the order row.
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        const tenantId = order?.tenant_id;

        // Move order from "Awaiting Payment" to "Confirmed"
        db.prepare(
          'UPDATE orders SET status = ?, payment_intent_id = ?, updated_at = ? WHERE id = ? AND status = ? AND tenant_id = ?'
        ).run('Confirmed', session.payment_intent || session.id, now, orderId, 'Awaiting Payment', tenantId);

        console.log(`[Webhook] Order ${orderId} (tenant: ${tenantId}) → Confirmed (payment: ${session.payment_intent})`);

        // Try to send SMS notification (best effort)
        if (order?.customer_phone) {
          const settings = db.prepare("SELECT data FROM settings WHERE key = 'general' AND tenant_id = ?").get(tenantId) as any;
          const parsed = settings?.data ? JSON.parse(settings.data) : {};
          if (parsed.smsSettings?.enabled) {
            // Fire and forget — don't block webhook response
            fetch(`${new URL(request.url).origin}/api/v1/sms/order-notification`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                settings: parsed.smsSettings,
                order: { id: orderId, customerName: order.customer_name, customerPhone: order.customer_phone, status: 'Confirmed' },
                businessName: parsed.businessName || 'Street Eats',
              }),
            }).catch(() => {});
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[Webhook] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
