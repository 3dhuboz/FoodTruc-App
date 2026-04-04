/**
 * SMS: Blast — send bulk SMS to multiple customers via ClickSend.
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
    const { settings, to, message } = await request.json();
    if (!settings?.username || !settings?.apiKey) return json({ error: 'ClickSend credentials not configured' }, 400);
    if (!to || !message) return json({ error: 'Missing "to" or "message"' }, 400);

    const phones: string[] = Array.isArray(to) ? to : [to];
    const results: { phone: string; ok: boolean; error?: string }[] = [];

    for (const raw of phones) {
      try {
        const phone = normalizePhone(raw);
        await sendClickSendSms(settings, phone, message);
        results.push({ phone, ok: true });
      } catch (err: any) {
        results.push({ phone: raw, ok: false, error: err.message });
      }
    }

    const sent = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    return json({ sent, failed, results });
  } catch (err: any) {
    console.error('[SMS blast]', err);
    return json({ error: err.message }, 500);
  }
};
