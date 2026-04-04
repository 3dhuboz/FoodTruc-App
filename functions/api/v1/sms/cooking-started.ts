/**
 * SMS: Cooking Started notification via ClickSend.
 */
import { getTenantFromRequest } from '../_lib/tenant';
import { sendClickSendSms, normalizePhone } from './_clicksend';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const { settings, order, businessName } = await request.json();
    if (!settings?.enabled || !order?.customerPhone) return json({ skipped: true });

    const phone = normalizePhone(order.customerPhone);
    const orderNum = (order.id || '').slice(-4).toUpperCase();
    const message = `🔥 ${businessName || 'Your order'} — Order #${orderNum} is now being prepared! We'll text you when it's ready. - ${businessName || 'The Team'}`;

    const { messageId } = await sendClickSendSms(settings, phone, message);
    return json({ sent: true, messageId });
  } catch (err: any) {
    console.error('[SMS cooking-started]', err);
    return json({ error: err.message }, 500);
  }
};
