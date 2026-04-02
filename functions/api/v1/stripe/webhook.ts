/**
 * Stripe Webhook — handles payment + subscription events.
 *
 * Events handled:
 * - checkout.session.completed → marks QR orders as "Confirmed" (paid)
 * - customer.subscription.created → provisions new tenant
 * - customer.subscription.deleted → deactivates tenant
 * - invoice.payment_failed → marks tenant billing as past_due
 *
 * Setup: In Stripe Dashboard → Webhooks → add endpoint:
 *   URL: https://chownow.au/api/v1/stripe/webhook
 *   Events: checkout.session.completed, customer.subscription.created,
 *           customer.subscription.deleted, invoice.payment_failed
 */
import { getDB, generateId } from '../_lib/db';

export const onRequest = async (context: any) => {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    const event = body;
    const db = getDB(env);
    const now = new Date().toISOString();

    // ─── Order Payment: checkout.session.completed ──────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const orderId = session?.metadata?.orderId;

      // Only handle order checkouts (not signup checkouts)
      if (orderId) {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        const tenantId = order?.tenant_id;

        db.prepare(
          'UPDATE orders SET status = ?, payment_intent_id = ?, updated_at = ? WHERE id = ? AND status = ? AND tenant_id = ?'
        ).run('Confirmed', session.payment_intent || session.id, now, orderId, 'Awaiting Payment', tenantId);

        console.log(`[Webhook] Order ${orderId} (tenant: ${tenantId}) → Confirmed`);

        // SMS notification (best effort)
        if (order?.customer_phone) {
          const settings = db.prepare("SELECT data FROM settings WHERE key = 'general' AND tenant_id = ?").get(tenantId) as any;
          const parsed = settings?.data ? JSON.parse(settings.data) : {};
          if (parsed.smsSettings?.enabled) {
            fetch(`${new URL(request.url).origin}/api/v1/sms/order-notification`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                settings: parsed.smsSettings,
                order: { id: orderId, customerName: order.customer_name, customerPhone: order.customer_phone, status: 'Confirmed' },
                businessName: parsed.businessName || 'ChowNow',
              }),
            }).catch(() => {});
          }
        }
      }
    }

    // ─── New Subscription: Provision Tenant ──────────────────────
    if (event.type === 'customer.subscription.created') {
      const subscription = event.data?.object;
      const meta = subscription?.metadata || {};
      const { slug, businessName, email, phone, plan } = meta;

      if (slug && businessName) {
        const tenantId = slug; // Use slug as tenant ID for simplicity

        // Check tenant doesn't already exist (idempotency)
        const existing = await db.prepare('SELECT id FROM tenants WHERE id = ? OR slug = ?').bind(tenantId, slug).first();
        if (!existing) {
          // Create the tenant
          await db.prepare(
            `INSERT INTO tenants (id, name, slug, subdomain, plan, stripe_customer_id, stripe_subscription_id, billing_status, owner_email, owner_phone, status, primary_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            tenantId, businessName, slug, slug, plan || 'starter',
            subscription.customer, subscription.id, 'active',
            email || '', phone || '', 'active', '#f97316', now, now
          ).run();

          // Seed default settings for the new tenant
          const defaultSettings = JSON.stringify({
            businessName,
            businessAddress: '',
            maintenanceMode: false,
            logoUrl: '',
            rewards: { enabled: false, staffPin: '1234', maxStamps: 10, programName: `${businessName} Rewards`, rewardTitle: 'Free Item', rewardImage: '', possiblePrizes: [] },
            stripeConnected: false,
            squareConnected: false,
            smartPayConnected: false,
            smsConnected: false,
            facebookConnected: false,
            manualTickerImages: [],
            adminUsername: 'admin',
            adminPassword: 'admin123',
          });

          await db.prepare(
            'INSERT OR IGNORE INTO settings (tenant_id, key, data) VALUES (?, ?, ?)'
          ).bind(tenantId, 'general', defaultSettings).run();

          console.log(`[Webhook] Tenant provisioned: ${businessName} (${slug}.chownow.au)`);

          // Notify admin to build & ship Pi
          const adminEmail = (env as any).ADMIN_NOTIFICATION_EMAIL;
          const sendgridKey = (env as any).SENDGRID_API_KEY;
          if (adminEmail && sendgridKey) {
            fetch('https://api.sendgrid.com/v3/mail/send', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: adminEmail }] }],
                from: { email: 'noreply@chownow.au', name: 'ChowNow' },
                subject: `🆕 New Signup: ${businessName} — Build & Ship Pi`,
                content: [{
                  type: 'text/html',
                  value: `
                    <h2>New ChowNow Signup!</h2>
                    <p><strong>Business:</strong> ${businessName}</p>
                    <p><strong>Subdomain:</strong> ${slug}.chownow.au</p>
                    <p><strong>Plan:</strong> ${plan}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                    <p><strong>Subscription ID:</strong> ${subscription.id}</p>
                    <hr>
                    <p>⚡ <strong>Action Required:</strong> Build and ship a Pi for this customer.</p>
                  `,
                }],
              }),
            }).catch((e: any) => console.error('[Webhook] Admin notification failed:', e));
          } else {
            console.log(`[Webhook] Pi shipping needed for: ${businessName} (${slug}) — email: ${email}, phone: ${phone}`);
          }
        } else {
          console.log(`[Webhook] Tenant ${slug} already exists — skipping provisioning`);
        }
      }
    }

    // ─── Subscription Cancelled: Deactivate Tenant ──────────────
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data?.object;
      const slug = subscription?.metadata?.slug;

      if (slug) {
        await db.prepare(
          "UPDATE tenants SET status = 'inactive', billing_status = 'cancelled', updated_at = ? WHERE slug = ?"
        ).bind(now, slug).run();
        console.log(`[Webhook] Tenant ${slug} deactivated (subscription cancelled)`);
      }
    }

    // ─── Payment Failed: Mark Past Due ──────────────────────────
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data?.object;
      const customerId = invoice?.customer;

      if (customerId) {
        await db.prepare(
          "UPDATE tenants SET billing_status = 'past_due', updated_at = ? WHERE stripe_customer_id = ?"
        ).bind(now, customerId).run();
        console.log(`[Webhook] Tenant with customer ${customerId} → past_due`);
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
