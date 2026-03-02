async function send(settings: any, to: string, body: string) {
  if (process.env.MESSAGEBIRD_API_KEY) {
    const apiKey = process.env.MESSAGEBIRD_API_KEY;
    const originator = process.env.MESSAGEBIRD_ORIGINATOR || 'StreetMeatz';
    let recipient = to.replace(/\s+/g, '');
    if (recipient.startsWith('0')) recipient = '61' + recipient.slice(1);
    if (recipient.startsWith('+')) recipient = recipient.slice(1);
    const r = await fetch('https://rest.messagebird.com/messages', {
      method: 'POST',
      headers: { 'Authorization': `AccessKey ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ originator, recipients: [recipient], body }),
    });
    if (!r.ok) { const err = await r.json().catch(() => ({ errors: [{ description: r.statusText }] })); throw new Error(err.errors?.[0]?.description || `MessageBird error ${r.status}`); }
    return await r.json();
  }
  if (settings?.accountSid && settings?.authToken && settings?.fromNumber) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${settings.accountSid}/Messages.json`;
    const auth = Buffer.from(`${settings.accountSid}:${settings.authToken}`).toString('base64');
    const params = new URLSearchParams(); params.append('To', to); params.append('From', settings.fromNumber); params.append('Body', body);
    const r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || data.error_message || `Twilio error ${r.status}`);
    return data;
  }
  throw new Error('No SMS provider configured.');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { settings, to, message } = req.body;

    if (!to) return res.status(400).json({ error: 'Recipient phone number is required' });
    if (!message) return res.status(400).json({ error: 'Message body is required' });

    await send(settings, to, message);
    res.json({ success: true, provider: process.env.MESSAGEBIRD_API_KEY ? 'messagebird' : 'twilio' });
  } catch (error: any) {
    console.error('SMS blast error:', error);
    res.status(500).json({ error: error.message });
  }
}
