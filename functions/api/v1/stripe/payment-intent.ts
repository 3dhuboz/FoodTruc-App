/**
 * Stripe Terminal — Create PaymentIntent for an order.
 * Called before collecting payment via Tap to Pay.
 *
 * Body: { amount: number (cents), orderId: string, currency?: string }
 * Returns: { clientSecret: string, paymentIntentId: string }
 */
export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 500);

  try {
    const body = await request.json();
    const amount = body.amount; // In cents (e.g., $36.50 = 3650)
    const currency = body.currency || 'aud';
    const orderId = body.orderId || '';

    if (!amount || amount < 50) return json({ error: 'Amount must be at least 50 cents' }, 400);

    const params = new URLSearchParams({
      amount: String(Math.round(amount)),
      currency,
      'payment_method_types[]': 'card_present',
      capture_method: 'automatic',
      'metadata[orderId]': orderId,
      'metadata[source]': 'street_eats_terminal',
    });

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ error: `Stripe error: ${err}` }, res.status);
    }

    const data = await res.json();
    return json({
      clientSecret: data.client_secret,
      paymentIntentId: data.id,
    });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
