/**
 * POST /api/v1/signup
 * Creates a Stripe Checkout Session for a new tenant subscription.
 * Body: { businessName, email, phone, slug, plan }
 * Returns: { url } — redirect to Stripe Checkout
 *
 * Does NOT create the tenant — that happens via webhook after payment.
 */
import { getDB } from '../_lib/db';

const json = (d: any, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const stripeKey = (env as any).STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 500);

  const starterPriceId = (env as any).STRIPE_STARTER_PRICE_ID;
  const proPriceId = (env as any).STRIPE_PRO_PRICE_ID;
  const piPriceId = (env as any).STRIPE_PI_PRICE_ID;

  if (!starterPriceId || !proPriceId) return json({ error: 'Stripe price IDs not configured' }, 500);

  try {
    const body = await request.json() as any;
    const { businessName, email, phone, slug, plan } = body;

    // Validate required fields
    if (!businessName || !email || !slug || !plan) {
      return json({ error: 'Missing required fields: businessName, email, slug, plan' }, 400);
    }

    if (!['starter', 'pro'].includes(plan)) {
      return json({ error: 'Invalid plan. Must be "starter" or "pro".' }, 400);
    }

    // Validate slug format
    const cleanSlug = slug.toLowerCase().trim();
    if (cleanSlug.length < 3 || cleanSlug.length > 30 || !/^[a-z0-9-]+$/.test(cleanSlug)) {
      return json({ error: 'Invalid slug format.' }, 400);
    }

    // Check slug availability
    const db = getDB(env);
    const existing = await db.prepare('SELECT id FROM tenants WHERE slug = ? OR subdomain = ?').bind(cleanSlug, cleanSlug).first();
    if (existing) {
      return json({ error: 'This subdomain is already taken.' }, 409);
    }

    // 1. Create Stripe Customer
    const customerParams = new URLSearchParams();
    customerParams.append('email', email);
    customerParams.append('name', businessName);
    customerParams.append('phone', phone || '');
    customerParams.append('metadata[slug]', cleanSlug);
    customerParams.append('metadata[plan]', plan);

    const customerRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: customerParams.toString(),
    });

    if (!customerRes.ok) {
      const err = await customerRes.text();
      return json({ error: `Stripe customer error: ${err}` }, 500);
    }

    const customer = await customerRes.json() as any;

    // 2. Create Stripe Checkout Session (subscription + one-time Pi hardware)
    const origin = new URL(request.url).origin;
    const planPriceId = plan === 'pro' ? proPriceId : starterPriceId;

    const sessionParams = new URLSearchParams();
    sessionParams.append('mode', 'subscription');
    sessionParams.append('customer', customer.id);
    sessionParams.append('success_url', `${origin}/#/signup-success?session_id={CHECKOUT_SESSION_ID}`);
    sessionParams.append('cancel_url', `${origin}/#/landing?cancelled=true`);
    sessionParams.append('payment_method_types[]', 'card');

    // Recurring plan price
    sessionParams.append('line_items[0][price]', planPriceId);
    sessionParams.append('line_items[0][quantity]', '1');

    // One-time Pi hardware fee (if configured)
    if (piPriceId) {
      sessionParams.append('line_items[1][price]', piPriceId);
      sessionParams.append('line_items[1][quantity]', '1');
    }

    // Store signup metadata on the subscription
    sessionParams.append('subscription_data[metadata][slug]', cleanSlug);
    sessionParams.append('subscription_data[metadata][businessName]', businessName);
    sessionParams.append('subscription_data[metadata][email]', email);
    sessionParams.append('subscription_data[metadata][phone]', phone || '');
    sessionParams.append('subscription_data[metadata][plan]', plan);

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: sessionParams.toString(),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      return json({ error: `Stripe session error: ${err}` }, 500);
    }

    const session = await sessionRes.json() as any;
    return json({ url: session.url });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
