import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.json({ connected: false, error: 'CLAUDE_API_KEY not configured on server.' });
  }

  try {
    const client = new Anthropic({ apiKey });
    const models = await client.models.list();
    res.json({ connected: true, models: models.data?.length ?? 0 });
  } catch (error: any) {
    const msg = error?.message || 'Unknown error';
    res.json({ connected: false, error: msg });
  }
}
