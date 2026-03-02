export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.EMAIL_API_SECRET;
  if (secret && req.headers['x-api-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { settings, to } = req.body;
    const recipient = to || settings?.adminPhone;
    if (!recipient) {
      return res.status(400).json({ error: 'No recipient phone number. Set an Admin Phone first.' });
    }

    // MessageBird (if env var configured)
    if (process.env.MESSAGEBIRD_API_KEY) {
      const apiKey = process.env.MESSAGEBIRD_API_KEY;
      const originator = process.env.MESSAGEBIRD_ORIGINATOR || 'StreetMeatz';
      let mbRecipient = recipient.replace(/\s+/g, '');
      if (mbRecipient.startsWith('0')) mbRecipient = '61' + mbRecipient.slice(1);
      if (mbRecipient.startsWith('+')) mbRecipient = mbRecipient.slice(1);

      const mbRes = await fetch('https://rest.messagebird.com/messages', {
        method: 'POST',
        headers: { 'Authorization': `AccessKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ originator, recipients: [mbRecipient], body: '🔥 Test SMS from Your Business — your MessageBird integration is working!' }),
      });
      if (!mbRes.ok) {
        const err = await mbRes.json().catch(() => ({ errors: [{ description: mbRes.statusText }] }));
        throw new Error(err.errors?.[0]?.description || `MessageBird error ${mbRes.status}`);
      }
      const mbData = await mbRes.json();
      return res.json({ success: true, id: mbData.id, provider: 'messagebird' });
    }

    // Twilio via REST API
    if (!settings?.accountSid || !settings?.authToken || !settings?.fromNumber) {
      return res.status(400).json({ error: 'No SMS provider configured. Set MESSAGEBIRD_API_KEY env var or provide Twilio credentials.' });
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${settings.accountSid}/Messages.json`;
    const auth = Buffer.from(`${settings.accountSid}:${settings.authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('To', recipient);
    params.append('From', settings.fromNumber);
    params.append('Body', '🔥 Test SMS from Your Business — your Twilio integration is working!');

    const twilioRes = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const twilioData = await twilioRes.json();
    if (!twilioRes.ok) {
      throw new Error(twilioData.message || twilioData.error_message || `Twilio error ${twilioRes.status}: ${twilioData.code}`);
    }

    res.json({ success: true, sid: twilioData.sid, provider: 'twilio' });
  } catch (error: any) {
    console.error('SMS error:', error);
    res.status(500).json({ error: error.message });
  }
}
