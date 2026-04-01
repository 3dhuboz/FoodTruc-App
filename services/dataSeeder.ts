/**
 * Data seeder stub — legacy compatibility.
 * Database seeding is now done via: wrangler d1 execute foodtruck-db --file=schema.sql
 * And seed data via the API or a seed script.
 */

export const seedDatabase = async () => {
  console.log('[D1] Database seeding is done via wrangler CLI or /api/v1/seed endpoint');
};

export const createAdminAuth = async () => {
  console.log('[D1] Admin auth is handled via Clerk or admin credentials in settings');
};
