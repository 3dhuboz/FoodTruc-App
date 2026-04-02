/**
 * GET /api/v1/tenant — Public tenant config endpoint.
 * Returns the resolved tenant's branding/config based on subdomain.
 * No auth required — used by frontend to bootstrap the app.
 */
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const { tenant } = await getTenantFromRequest(request, env);

  if (!tenant || tenant.status !== 'active') {
    return new Response(JSON.stringify({ error: 'tenant_not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(JSON.stringify({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logoUrl: tenant.logo_url || '',
    primaryColor: tenant.primary_color || '#f97316',
    plan: tenant.plan,
    status: tenant.status,
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Tenant-ID',
    },
  });
};
