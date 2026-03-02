const MESSAGEBIRD_API = 'https://rest.messagebird.com/messages';

export function isMessageBirdConfigured(): boolean {
  return !!(process.env.MESSAGEBIRD_API_KEY);
}

export async function sendSMS(opts: {
  to: string;
  body: string;
  originator?: string;
}): Promise<{ id: string }> {
  const apiKey = process.env.MESSAGEBIRD_API_KEY;
  if (!apiKey) throw new Error('MessageBird not configured. Set MESSAGEBIRD_API_KEY.');

  const originator = opts.originator || process.env.MESSAGEBIRD_ORIGINATOR || 'StreetMeatz';

  // Normalise AU number: ensure it starts with 61
  let recipient = opts.to.replace(/\s+/g, '');
  if (recipient.startsWith('0')) recipient = '61' + recipient.slice(1);
  if (recipient.startsWith('+')) recipient = recipient.slice(1);

  const res = await fetch(MESSAGEBIRD_API, {
    method: 'POST',
    headers: {
      'Authorization': `AccessKey ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      originator,
      recipients: [recipient],
      body: opts.body,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ errors: [{ description: res.statusText }] }));
    const msg = err.errors?.[0]?.description || `MessageBird error ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  return { id: data.id || '' };
}
