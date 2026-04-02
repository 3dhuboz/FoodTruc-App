/**
 * Stripe Terminal — Connection Token endpoint.
 * The Stripe Terminal SDK calls this to authenticate with Stripe.
 * Returns a short-lived connection token.
 *
 * Requires STRIPE_SECRET_KEY env var (set as CF Pages secret).
 */
export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 500);

  try {
    const res = await fetch('https://api.stripe.com/v1/terminal/connection_tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ error: `Stripe error: ${err}` }, res.status);
    }

    const data = await res.json();
    return json({ secret: data.secret });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
