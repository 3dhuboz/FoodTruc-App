/**
 * SMS: Test endpoint — sends a test SMS to the admin phone.
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
    const { settings, to } = await request.json();
    if (!settings?.username || !settings?.apiKey) return json({ error: 'ClickSend credentials not configured' }, 400);

    const phone = normalizePhone(to || settings.adminPhone);
    if (!phone || phone.length < 8) return json({ error: 'No valid phone number provided' }, 400);

    const message = `✅ ChowNow SMS test successful! Your ClickSend integration is working. 🎉`;

    const { messageId } = await sendClickSendSms(settings, phone, message);
    return json({ success: true, sid: messageId });
  } catch (err: any) {
    console.error('[SMS test]', err);
    return json({ error: err.message }, 500);
  }
};
