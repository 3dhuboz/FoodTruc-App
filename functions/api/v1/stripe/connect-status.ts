/**
 * GET /api/v1/stripe/connect-status?tenant_id=X
 * Checks if a tenant's Stripe Connect account is fully onboarded.
 *
 * Returns: { connected: boolean, chargesEnabled: boolean, payoutsEnabled: boolean, accountId: string | null }
 *
 * Also creates a login link to the Express dashboard if requested via ?dashboard=true.
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const stripeKey = (env as any).STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 500);

  try {
    const url = new URL(request.url);
    const { tenantId } = await getTenantFromRequest(request, env);
    const requestedTenantId = url.searchParams.get('tenant_id') || tenantId;
    const wantDashboard = url.searchParams.get('dashboard') === 'true';

    const db = getDB(env);
    const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(requestedTenantId).first() as any;
    if (!tenant) return json({ error: 'Tenant not found' }, 404);

    if (!tenant.stripe_account_id) {
      return json({
        connected: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        accountId: null,
        dashboardUrl: null,
      });
    }

    // Retrieve the account from Stripe to check status
    const accountRes = await fetch(`https://api.stripe.com/v1/accounts/${tenant.stripe_account_id}`, {
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });

    if (!accountRes.ok) {
      const err = await accountRes.text();
      return json({ error: `Failed to retrieve account: ${err}` }, 500);
    }

    const account = await accountRes.json() as any;
    const chargesEnabled = account.charges_enabled === true;
    const payoutsEnabled = account.payouts_enabled === true;
    const fullyOnboarded = chargesEnabled && payoutsEnabled;

    // Update DB if onboarding status changed
    if (fullyOnboarded && !tenant.stripe_onboarding_complete) {
      const now = new Date().toISOString();
      await db.prepare(
        'UPDATE tenants SET stripe_onboarding_complete = 1, updated_at = ? WHERE id = ?'
      ).bind(now, requestedTenantId).run();

      // Also update settings to reflect connected status
      const settings = await db.prepare(
        "SELECT data FROM settings WHERE tenant_id = ? AND key = 'general'"
      ).bind(requestedTenantId).first() as any;
      if (settings?.data) {
        const parsed = JSON.parse(settings.data);
        parsed.stripeConnected = true;
        await db.prepare(
          "UPDATE settings SET data = ? WHERE tenant_id = ? AND key = 'general'"
        ).bind(JSON.stringify(parsed), requestedTenantId).run();
      }
    }

    // Create Express dashboard login link if requested
    let dashboardUrl = null;
    if (wantDashboard && fullyOnboarded) {
      const loginRes = await fetch(`https://api.stripe.com/v1/accounts/${tenant.stripe_account_id}/login_links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      if (loginRes.ok) {
        const loginData = await loginRes.json() as any;
        dashboardUrl = loginData.url;
      }
    }

    return json({
      connected: fullyOnboarded,
      chargesEnabled,
      payoutsEnabled,
      accountId: tenant.stripe_account_id,
      dashboardUrl,
    });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
