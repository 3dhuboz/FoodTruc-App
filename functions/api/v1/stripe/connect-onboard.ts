/**
 * POST /api/v1/stripe/connect-onboard
 * Creates a Stripe Express connected account for a tenant and returns the onboarding URL.
 *
 * Body: { tenantId: string }
 * Returns: { url: string, accountId: string }
 *
 * If the tenant already has a stripe_account_id, creates a new Account Link
 * (for resuming incomplete onboarding).
 */
import { getDB } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

const json = (d: any, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});

export const onRequest = async (context: any) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const stripeKey = (env as any).STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 500);

  try {
    const body = await request.json() as any;
    const { tenantId } = await getTenantFromRequest(request, env);
    const requestedTenantId = body.tenantId || tenantId;

    const db = getDB(env);
    const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(requestedTenantId).first() as any;
    if (!tenant) return json({ error: 'Tenant not found' }, 404);

    let accountId = tenant.stripe_account_id;

    // Create Express account if one doesn't exist yet
    if (!accountId) {
      const accountParams = new URLSearchParams();
      accountParams.append('type', 'express');
      accountParams.append('country', 'AU');
      accountParams.append('email', tenant.owner_email || tenant.email || '');
      accountParams.append('capabilities[card_payments][requested]', 'true');
      accountParams.append('capabilities[transfers][requested]', 'true');
      accountParams.append('business_type', 'individual');
      accountParams.append('metadata[tenant_id]', requestedTenantId);
      accountParams.append('metadata[slug]', tenant.slug);
      accountParams.append('business_profile[name]', tenant.name);
      accountParams.append('business_profile[mcc]', '5812'); // Eating places, restaurants
      accountParams.append('business_profile[url]', `https://${tenant.slug}.chownow.au`);

      const accountRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: accountParams.toString(),
      });

      if (!accountRes.ok) {
        const err = await accountRes.text();
        return json({ error: `Failed to create connected account: ${err}` }, 500);
      }

      const account = await accountRes.json() as any;
      accountId = account.id;

      // Store the account ID on the tenant
      const now = new Date().toISOString();
      await db.prepare(
        'UPDATE tenants SET stripe_account_id = ?, updated_at = ? WHERE id = ?'
      ).bind(accountId, now, requestedTenantId).run();
    }

    // Create Account Link for onboarding
    const origin = new URL(request.url).origin;
    const linkParams = new URLSearchParams();
    linkParams.append('account', accountId);
    linkParams.append('refresh_url', `${origin}/#/settings?stripe_refresh=true`);
    linkParams.append('return_url', `${origin}/#/settings?stripe_onboarded=true`);
    linkParams.append('type', 'account_onboarding');

    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: linkParams.toString(),
    });

    if (!linkRes.ok) {
      const err = await linkRes.text();
      return json({ error: `Failed to create onboarding link: ${err}` }, 500);
    }

    const link = await linkRes.json() as any;
    return json({ url: link.url, accountId });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
