/**
 * Seed endpoint — POST an array of menu items to populate the database.
 * Also seeds default settings if none exist.
 *
 * Usage: POST /api/v1/seed with { menu: [...], settings: {...} }
 * Or call with no body to just seed default settings.
 */
import { getDB, generateId } from './_lib/db';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const db = getDB(env);
    const body = await request.json().catch(() => ({}));
    const results: string[] = [];

    // Seed menu items
    if (body.menu && Array.isArray(body.menu)) {
      for (const item of body.menu) {
        const id = item.id || generateId();
        await db.prepare(
          `INSERT OR REPLACE INTO menu_items (id, name, description, price, unit, min_quantity, preparation_options, image, category, available, availability_type, specific_date, specific_dates, is_pack, pack_groups, available_for_catering, catering_category, moq)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, item.name, item.description || null, item.price,
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
      await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
        .bind(JSON.stringify(body.settings)).run();
      results.push('Seeded settings');
    }

    // Seed default settings if none exist
    const existing = await db.prepare("SELECT COUNT(*) as count FROM settings").first() as any;
    if (existing.count === 0) {
      const defaults = {
        businessName: 'Food Truck',
        businessAddress: '',
        maintenanceMode: false,
        rewards: { enabled: false, staffPin: '1234', maxStamps: 10, programName: 'Rewards', rewardTitle: 'Free Item', rewardImage: '', possiblePrizes: [] },
      };
      await db.prepare("INSERT INTO settings (key, data) VALUES ('general', ?)").bind(JSON.stringify(defaults)).run();
      results.push('Seeded default settings');
    }

    return json({ success: true, results });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
