import { getDB, rowToUser } from '../_lib/db';
import { verifyAuth } from '../_lib/auth';
import { getTenantFromRequest } from '../_lib/tenant';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  try {
    const auth = await verifyAuth(request, env);
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const { tenantId } = await getTenantFromRequest(request, env);

    const db = getDB(env);
    const row = await db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').bind(auth.userId, tenantId).first();
    if (!row) return json({ error: 'User not found' }, 404);
    return json(rowToUser(row));
  } catch (err: any) {
    return json({ error: err.message }, err.status || 500);
  }
};
