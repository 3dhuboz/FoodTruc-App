/**
 * SMS: Cooking Started notification.
 */
import { getTenantFromRequest } from '../_lib/tenant';

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

    await sendTwilioSms(settings, phone, message);
    return json({ sent: true });
  } catch (err: any) {
    console.error('[SMS cooking-started]', err);
    return json({ error: err.message }, 500);
  }
};

function normalizePhone(raw: string): string {
  let phone = raw.replace(/[\s\-()]/g, '');
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (phone.startsWith('61')) return '+' + phone;
  return '+61' + phone;
}

async function sendTwilioSms(settings: any, to: string, body: string) {
  const { accountSid, authToken, fromNumber } = settings;
  if (!accountSid || !authToken || !fromNumber) throw new Error('SMS not configured');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}
