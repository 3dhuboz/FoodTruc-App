// Facebook Token Exchange — converts short-lived user token to long-lived,
// then fetches pages with permanent (non-expiring) page tokens.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shortLivedToken } = req.body;
    const appId = process.env.VITE_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return res.status(500).json({
        error: 'Facebook App ID and App Secret must be set in environment variables (VITE_FACEBOOK_APP_ID, FACEBOOK_APP_SECRET).'
      });
    }

    if (!shortLivedToken) {
      return res.status(400).json({ error: 'Missing shortLivedToken in request body.' });
    }

    // Step 1: Exchange short-lived user token for long-lived user token (60 days)
    const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const exchangeRes = await fetch(exchangeUrl);
    const exchangeData = await exchangeRes.json();

    if (exchangeData.error) {
      return res.status(400).json({ error: exchangeData.error.message });
    }

    const longLivedUserToken = exchangeData.access_token;

    // Step 2: Fetch pages using long-lived user token
    // Page tokens obtained via a long-lived user token are PERMANENT (never expire)
    const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedUserToken}`);
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      return res.status(400).json({ error: pagesData.error.message });
    }

    res.json({ pages: pagesData.data, longLivedUserToken });
  } catch (error: any) {
    console.error('Facebook token exchange error:', error);
    res.status(500).json({ error: error.message });
  }
}
