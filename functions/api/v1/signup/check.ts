/**
 * GET /api/v1/signup/check?slug=smokyjoes
 * Returns { available: true/false } — no auth required.
 */
import { getDB } from '../_lib/db';

const RESERVED_SLUGS = ['app', 'www', 'admin', 'api', 'mail', 'ftp', 'default', 'chownow', 'demo', 'test', 'staging'];

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug')?.toLowerCase().trim();

  if (!slug || slug.length < 3 || slug.length > 30 || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ available: false, reason: 'Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only.' }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (RESERVED_SLUGS.includes(slug)) {
    return Response.json({ available: false, reason: 'This name is reserved.' }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const db = getDB(env);
  const existing = await db.prepare('SELECT id FROM tenants WHERE slug = ? OR subdomain = ?').bind(slug, slug).first();

  return Response.json({ available: !existing }, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
