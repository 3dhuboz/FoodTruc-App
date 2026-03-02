const TWILIO_API = 'https://api.twilio.com/2010-04-01';

export async function sendViaTwilio(
  settings: { accountSid: string; authToken: string; fromNumber: string },
  to: string,
  body: string
): Promise<{ sid: string }> {
  if (!settings.accountSid || !settings.authToken || !settings.fromNumber) {
    throw new Error('Twilio credentials incomplete. Provide Account SID, Auth Token, and From Number.');
  }

  const url = `${TWILIO_API}/Accounts/${settings.accountSid}/Messages.json`;
  const auth = Buffer.from(`${settings.accountSid}:${settings.authToken}`).toString('base64');

  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', settings.fromNumber);
  params.append('Body', body);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data.message || data.error_message || `Twilio error ${res.status}: ${data.code}`;
    throw new Error(msg);
  }

  return { sid: data.sid };
}
