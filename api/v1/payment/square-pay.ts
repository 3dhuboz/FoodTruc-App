// Square Payments API via REST — no npm package needed
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sourceId, amount, currency, locationId, accessToken, environment, idempotencyKey, customerEmail, autocomplete } = req.body;

    if (!sourceId || !amount || !locationId || !accessToken) {
      return res.status(400).json({ error: 'Missing required fields: sourceId, amount, locationId, accessToken' });
    }

    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const paymentRes = await fetch(`${baseUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: idempotencyKey || `pay_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        amount_money: {
          amount: Math.round(amount * 100), // Convert dollars to cents
          currency: currency || 'AUD',
        },
        location_id: locationId,
        autocomplete: autocomplete !== false, // Default true (immediate charge)
        note: `Your Business Order`,
        buyer_email_address: customerEmail || undefined,
      }),
    });

    const data = await paymentRes.json();

    if (!paymentRes.ok) {
      const errMsg = data.errors?.[0]?.detail || data.errors?.[0]?.code || `Square API error ${paymentRes.status}`;
      console.error('Square payment error:', JSON.stringify(data.errors));
      return res.status(paymentRes.status).json({ error: errMsg, errors: data.errors });
    }

    res.json({
      success: true,
      paymentId: data.payment?.id,
      status: data.payment?.status,
      receiptUrl: data.payment?.receipt_url,
    });
  } catch (error: any) {
    console.error('Square payment error:', error);
    res.status(500).json({ error: error.message });
  }
}
