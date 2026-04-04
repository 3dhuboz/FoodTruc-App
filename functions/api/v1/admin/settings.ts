/**
 * GET /api/v1/admin/settings — Returns platform settings + env var status
 * PUT /api/v1/admin/settings — Merges updates into platform settings
 *
 * Platform settings are stored in the `settings` table under
 * tenant_id='default', key='platform'.
 */
import { getDB } from '../_lib/db';

const json = (d: any, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});

const DEFAULT_PLATFORM_SETTINGS = {
  platformFeePercent: 1.5,
  adminNotificationEmail: '',
  supportEmail: '',
  emailFromName: 'ChowNow',
  businessName: 'ChowNow',
  tagline: 'Food Truck Workflow, Sorted',
  brandColor: '#f97316',
  starterPlanPrice: 99,
  proPlanPrice: 149,
  chowboxPrice: 299,
  signupEnabled: true,
  maintenanceMode: false,
  heroHeadline: 'From first order to full service.',
  heroSubtext: 'QR ordering, kitchen display, front-of-house POS, and offline mode — all powered by the ChowBox.',
  footerText: '© 2026 ChowNow',
  geminiApiKey: '',
};

export const onRequest = async (context: any) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const db = getDB(env);

  // ─── GET: Return platform settings + status ─────────────────
  if (request.method === 'GET') {
    try {
      const row = await db.prepare(
        "SELECT data FROM settings WHERE tenant_id = 'default' AND key = 'platform'"
      ).first() as any;

      const settings = row?.data
        ? { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(row.data) }
        : { ...DEFAULT_PLATFORM_SETTINGS };

      // Check which env vars are configured (never expose values)
      const status = {
        stripeConfigured: !!(env as any).STRIPE_SECRET_KEY,
        sendgridConfigured: !!(env as any).SENDGRID_API_KEY,
        adminKeyConfigured: !!(env as any).ADMIN_API_KEY,
        starterPriceConfigured: !!(env as any).STRIPE_STARTER_PRICE_ID,
        proPriceConfigured: !!(env as any).STRIPE_PRO_PRICE_ID,
        piPriceConfigured: !!(env as any).STRIPE_PI_PRICE_ID,
      };

      return json({ settings, status });
    } catch (err: any) {
      return json({ error: err.message }, 500);
    }
  }

  // ─── PUT: Merge updates into platform settings ──────────────
  if (request.method === 'PUT') {
    try {
      const body = await request.json() as any;
      const updates = body.settings || body;

      // Get existing settings
      const row = await db.prepare(
        "SELECT data FROM settings WHERE tenant_id = 'default' AND key = 'platform'"
      ).first() as any;

      const existing = row?.data
        ? { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(row.data) }
        : { ...DEFAULT_PLATFORM_SETTINGS };

      // Merge updates
      const merged = { ...existing, ...updates };

      await db.prepare(
        "INSERT OR REPLACE INTO settings (tenant_id, key, data) VALUES ('default', 'platform', ?)"
      ).bind(JSON.stringify(merged)).run();

      return json({ settings: merged, saved: true });
    } catch (err: any) {
      return json({ error: err.message }, 500);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
};
