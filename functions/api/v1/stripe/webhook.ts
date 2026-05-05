/**
 * Stripe Webhook — handles payment + subscription events.
 *
 * SECURITY: Every request is verified against STRIPE_WEBHOOK_SECRET using
 * HMAC-SHA256 over the raw body, with a 5-minute replay window. Events are
 * deduped via the processed_stripe_events table for at-least-once retries.
 *
 * Events handled:
 * - checkout.session.completed → marks QR orders as "Confirmed" (paid)
 * - customer.subscription.created → provisions new tenant
 * - customer.subscription.deleted → deactivates tenant
 * - invoice.payment_failed → marks tenant billing as past_due
 * - account.updated → marks Connect onboarding complete
 *
 * Setup: In Stripe Dashboard → Webhooks → add endpoint:
 *   URL: https://chownow.au/api/v1/stripe/webhook
 *   Events: checkout.session.completed, customer.subscription.created,
 *           customer.subscription.deleted, invoice.payment_failed,
 *           account.updated
 *   Then: wrangler pages secret put STRIPE_WEBHOOK_SECRET
 */
import { getDB } from '../_lib/db';

/**
 * Verify Stripe webhook signature using Web Crypto (constant-time compare).
 * Stripe signs as: t=<timestamp>,v1=<hex-sha256>. The signing payload is
 * `${timestamp}.${rawBody}`. Rejects signatures older than 5 minutes (replay).
 */
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(',')) {
    const eq = segment.indexOf('=');
    if (eq > 0) parts[segment.slice(0, eq).trim()] = segment.slice(eq + 1).trim();
  }
  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) return false;

  const tsNum = parseInt(timestamp, 10);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
  const expectedHex = Array.from(new Uint8Array(expected))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedHex.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generateSecurePassword(length: number = 14): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  return out;
}

function generateStaffPin(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes).map(b => (b % 10).toString()).join('');
}

export const onRequest = async (context: any) => {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Read the raw body BEFORE parsing — required for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = (env as any).STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting');
    return new Response('Webhook misconfigured', { status: 500 });
  }
  const valid = await verifyStripeSignature(rawBody, signature, webhookSecret);
  if (!valid) {
    console.warn('[Webhook] Signature verification failed');
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody);
    const db = getDB(env);
    const now = new Date().toISOString();

    // Idempotency — skip if we've already processed this event id
    if (event.id) {
      const seen = await db
        .prepare('SELECT stripe_event_id FROM processed_stripe_events WHERE stripe_event_id = ?')
        .bind(event.id)
        .first();
      if (seen) {
        console.log(`[Webhook] Duplicate event ${event.id} — already processed`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ─── Order Payment: checkout.session.completed ──────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const orderId = session?.metadata?.orderId;

      // Only handle order checkouts (not signup checkouts)
      if (orderId) {
        const order = await db
          .prepare('SELECT * FROM orders WHERE id = ?')
          .bind(orderId)
          .first() as any;
        const tenantId = order?.tenant_id;

        if (tenantId) {
          await db
            .prepare(
              'UPDATE orders SET status = ?, payment_intent_id = ?, updated_at = ? WHERE id = ? AND status = ? AND tenant_id = ?'
            )
            .bind('Confirmed', session.payment_intent || session.id, now, orderId, 'Awaiting Payment', tenantId)
            .run();

          console.log(`[Webhook] Order ${orderId} (tenant: ${tenantId}) → Confirmed`);

          // SMS notification (best effort)
          if (order?.customer_phone) {
            const settings = await db
              .prepare("SELECT data FROM settings WHERE key = 'general' AND tenant_id = ?")
              .bind(tenantId)
              .first() as any;
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

          // Generate per-tenant credentials — never seed shared defaults
          const adminPassword = generateSecurePassword(14);
          const staffPin = generateStaffPin();

          const defaultSettings = JSON.stringify({
            businessName,
            businessAddress: '',
            maintenanceMode: false,
            logoUrl: '',
            rewards: { enabled: false, staffPin, maxStamps: 10, programName: `${businessName} Rewards`, rewardTitle: 'Free Item', rewardImage: '', possiblePrizes: [] },
            stripeConnected: false,
            squareConnected: false,
            smartPayConnected: false,
            smsConnected: false,
            facebookConnected: false,
            manualTickerImages: [],
            adminUsername: 'admin',
            adminPassword,
            mustChangeCredentials: true,
          });

          await db.prepare(
            'INSERT OR IGNORE INTO settings (tenant_id, key, data) VALUES (?, ?, ?)'
          ).bind(tenantId, 'general', defaultSettings).run();

          console.log(`[Webhook] Tenant provisioned: ${businessName} (${slug}.chownow.au)`);

          // Notify admin to build & ship Pi (and pass on the freshly generated credentials)
          const platformRow = await db.prepare("SELECT data FROM settings WHERE tenant_id = 'default' AND key = 'platform'").first() as any;
          const platformCfg = platformRow?.data ? JSON.parse(platformRow.data) : {};
          const adminEmail = platformCfg.adminNotificationEmail || (env as any).ADMIN_NOTIFICATION_EMAIL;
          const emailFromName = platformCfg.emailFromName || 'ChowNow';
          const sendgridKey = (env as any).SENDGRID_API_KEY;
          if (adminEmail && sendgridKey) {
            fetch('https://api.sendgrid.com/v3/mail/send', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: adminEmail }] }],
                from: { email: 'noreply@chownow.au', name: emailFromName },
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
                    <h3>Initial Credentials (deliver to customer over a secure channel)</h3>
                    <p><strong>Admin password:</strong> <code>${adminPassword}</code></p>
                    <p><strong>Staff PIN:</strong> <code>${staffPin}</code></p>
                    <p>The customer will be prompted to change these on first login.</p>
                    <hr>
                    <p>⚡ <strong>Action Required:</strong> Build and ship a Pi for this customer.</p>
                  `,
                }],
              }),
            }).catch((e: any) => console.error('[Webhook] Admin notification failed:', e));
          } else {
            // Avoid logging the secrets to console — they only go to the admin email
            console.log(`[Webhook] Pi shipping needed for: ${businessName} (${slug}). Credentials generated; configure ADMIN_NOTIFICATION_EMAIL + SENDGRID_API_KEY to receive them.`);
          }

          // Auto-create Stripe Express connected account for payment processing
          const stripeKey = (env as any).STRIPE_SECRET_KEY;
          if (stripeKey) {
            try {
              const accountParams = new URLSearchParams();
              accountParams.append('type', 'express');
              accountParams.append('country', 'AU');
              accountParams.append('email', email || '');
              accountParams.append('capabilities[card_payments][requested]', 'true');
              accountParams.append('capabilities[transfers][requested]', 'true');
              accountParams.append('business_type', 'individual');
              accountParams.append('metadata[tenant_id]', tenantId);
              accountParams.append('metadata[slug]', slug);
              accountParams.append('business_profile[name]', businessName);
              accountParams.append('business_profile[mcc]', '5812');
              accountParams.append('business_profile[url]', `https://${slug}.chownow.au`);

              const accountRes = await fetch('https://api.stripe.com/v1/accounts', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${stripeKey}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: accountParams.toString(),
              });

              if (accountRes.ok) {
                const connectAccount = await accountRes.json() as any;
                await db.prepare(
                  'UPDATE tenants SET stripe_account_id = ?, updated_at = ? WHERE id = ?'
                ).bind(connectAccount.id, now, tenantId).run();
                console.log(`[Webhook] Created Express account ${connectAccount.id} for tenant ${slug}`);
              } else {
                console.error(`[Webhook] Failed to create Express account for ${slug}:`, await accountRes.text());
              }
            } catch (e: any) {
              console.error(`[Webhook] Express account creation error for ${slug}:`, e.message);
            }
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

    // ─── Connect: Account Updated (onboarding complete) ─────────
    if (event.type === 'account.updated') {
      const account = event.data?.object;
      const accountId = account?.id;
      const chargesEnabled = account?.charges_enabled === true;
      const payoutsEnabled = account?.payouts_enabled === true;

      if (accountId && chargesEnabled && payoutsEnabled) {
        // Find the tenant with this connected account
        const tenant = await db.prepare(
          'SELECT id FROM tenants WHERE stripe_account_id = ?'
        ).bind(accountId).first() as any;

        if (tenant) {
          await db.prepare(
            'UPDATE tenants SET stripe_onboarding_complete = 1, updated_at = ? WHERE id = ?'
          ).bind(now, tenant.id).run();

          // Update settings to reflect connected status
          const settings = await db.prepare(
            "SELECT data FROM settings WHERE tenant_id = ? AND key = 'general'"
          ).bind(tenant.id).first() as any;
          if (settings?.data) {
            const parsed = JSON.parse(settings.data);
            parsed.stripeConnected = true;
            await db.prepare(
              "UPDATE settings SET data = ? WHERE tenant_id = ? AND key = 'general'"
            ).bind(JSON.stringify(parsed), tenant.id).run();
          }

          console.log(`[Webhook] Connect account ${accountId} (tenant: ${tenant.id}) fully onboarded`);
        }
      }
    }

    // Mark this event id as processed (best-effort — duplicates will short-circuit above)
    if (event.id) {
      await db
        .prepare('INSERT OR IGNORE INTO processed_stripe_events (stripe_event_id, event_type, processed_at) VALUES (?, ?, ?)')
        .bind(event.id, event.type || 'unknown', now)
        .run();
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
