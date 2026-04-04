/**
 * Shared ClickSend SMS helper.
 * API docs: https://developers.clicksend.com/docs/messaging/sms/other/send-sms
 */

export interface ClickSendSettings {
  enabled: boolean;
  username: string;
  apiKey: string;
  fromNumber: string;
  adminPhone: string;
}

export async function sendClickSendSms(settings: ClickSendSettings, to: string, body: string): Promise<{ messageId: string }> {
  const { username, apiKey, fromNumber } = settings;
  if (!username || !apiKey) throw new Error('SMS not configured — missing ClickSend credentials');

  const res = await fetch('https://rest.clicksend.com/v3/sms/send', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${username}:${apiKey}`),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{
        to,
        body,
        source: 'chownow',
        ...(fromNumber ? { from: fromNumber } : {}),
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ClickSend ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  const msg = data?.data?.messages?.[0];
  if (msg?.status !== 'SUCCESS') {
    throw new Error(`ClickSend rejected: ${msg?.status || 'unknown'}`);
  }

  return { messageId: msg.message_id || '' };
}

export function normalizePhone(raw: string): string {
  let phone = raw.replace(/[\s\-()]/g, '');
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (phone.startsWith('61')) return '+' + phone;
  return '+61' + phone;
}
