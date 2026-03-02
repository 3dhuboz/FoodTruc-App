export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency, locationId, accessToken, environment, orderId, customerName, description, redirectUrl } = req.body;

    if (!amount || !locationId || !accessToken) {
      return res.status(400).json({ error: 'Missing required fields: amount, locationId, accessToken' });
    }

    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const idempotencyKey = `checkout_${orderId || Date.now()}_${Math.random().toString(36).slice(2)}`;
    const itemName = `${description || 'Invoice'} | REF:${orderId || 'N/A'}`;

    const checkoutRes = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        quick_pay: {
          name: itemName,
          price_money: {
            amount: Math.round(amount * 100),
            currency: currency || 'AUD',
          },
          location_id: locationId,
        },
        checkout_options: {
          allow_tipping: false,
          redirect_url: redirectUrl || undefined,
          ask_for_shipping_address: false,
        },
      }),
    });

    const data = await checkoutRes.json();

    if (!checkoutRes.ok) {
      const errMsg = data.errors?.[0]?.detail || data.errors?.[0]?.code || `Square API error ${checkoutRes.status}`;
      console.error('Square checkout error:', JSON.stringify(data.errors));
      return res.status(checkoutRes.status).json({ error: errMsg, errors: data.errors });
    }

    res.json({
      success: true,
      url: data.payment_link?.url,
      longUrl: data.payment_link?.long_url,
      id: data.payment_link?.id,
      squareOrderId: data.related_resources?.orders?.[0],
    });
  } catch (error: any) {
    console.error('Square checkout link error:', error);
    res.status(500).json({ error: error.message });
  }
}
