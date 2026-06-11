/**
 * Seed endpoint — POST an array of menu items to populate the database.
 * Also seeds default settings if none exist.
 *
 * Super-admin / tooling only — requires ADMIN_API_KEY. The body's tenantId
 * is honoured to allow seeding any tenant from scripts.
 *
 * Usage: POST /api/v1/seed with { menu: [...], settings: {...}, tenantId?: string }
 *   curl -X POST https://chownow.au/api/v1/seed -H "Authorization: Bearer $ADMIN_API_KEY" -d '...'
 */
import { getDB, generateId } from './_lib/db';
import { getTenantFromRequest } from './_lib/tenant';
import { requireAdminKey } from './_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const denied = requireAdminKey(request, env);
  if (denied) return denied;

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const db = getDB(env);
    const body = await request.json().catch(() => ({}));
    const resolvedTenantId = body.tenantId || tenantId || 'default';
    const results: string[] = [];

    // Seed menu items
    if (body.menu && Array.isArray(body.menu)) {
      for (const item of body.menu) {
        const id = item.id || generateId();
        await db.prepare(
          `INSERT OR REPLACE INTO menu_items (id, tenant_id, name, description, price, unit, min_quantity, preparation_options, image, category, available, availability_type, specific_date, specific_dates, is_pack, pack_groups, available_for_catering, catering_category, moq)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, resolvedTenantId, item.name, item.description || null, item.price,
          item.unit || null, item.minQuantity || null,
          item.preparationOptions ? JSON.stringify(item.preparationOptions) : null,
          item.image || null, item.category, item.available !== false ? 1 : 0,
          item.availabilityType || 'everyday', item.specificDate || null,
          item.specificDates ? JSON.stringify(item.specificDates) : null,
          item.isPack ? 1 : 0, item.packGroups ? JSON.stringify(item.packGroups) : null,
          item.availableForCatering ? 1 : 0, item.cateringCategory || null, item.moq || null
        ).run();
      }
      results.push(`Seeded ${body.menu.length} menu items`);
    }

    // Seed settings
    if (body.settings) {
      await db.prepare("INSERT OR REPLACE INTO settings (key, tenant_id, data) VALUES ('general', ?, ?)")
        .bind(resolvedTenantId, JSON.stringify(body.settings)).run();
      results.push('Seeded settings');
    }

    // Seed default settings if none exist for this tenant.
    // Generate a random staff PIN — never seed a shared default.
    const existing = await db.prepare("SELECT COUNT(*) as count FROM settings WHERE tenant_id = ?").bind(resolvedTenantId).first() as any;
    if (existing.count === 0) {
      const pinBytes = crypto.getRandomValues(new Uint8Array(6));
      const staffPin = Array.from(pinBytes).map(b => (b % 10).toString()).join('');
      const defaults = {
        businessName: 'ChowNow',
        businessAddress: '',
        maintenanceMode: false,
        rewards: { enabled: false, staffPin, maxStamps: 10, programName: 'Rewards', rewardTitle: 'Free Item', rewardImage: '', possiblePrizes: [] },
        mustChangeCredentials: true,
      };
      await db.prepare("INSERT INTO settings (key, tenant_id, data) VALUES ('general', ?, ?)").bind(resolvedTenantId, JSON.stringify(defaults)).run();
      results.push(`Seeded default settings (staff PIN generated: ${staffPin})`);
    }

    return json({ success: true, results });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
