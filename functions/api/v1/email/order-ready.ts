/**
 * Email: Order Ready notification.
 * Sends email to customer when their order is marked Ready.
 * Uses SMTP via Mailchannels (free on Cloudflare Workers) or external SMTP.
 */
export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { settings, order, businessName } = await request.json();
    if (!settings?.enabled || !order?.customerEmail) return json({ skipped: true });

    const orderNum = (order.id || '').slice(-4).toUpperCase();
    const location = order.pickupLocation || 'the truck';

    // Use MailChannels (free on CF Workers) for email delivery
    const emailRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: order.customerEmail, name: order.customerName }] }],
        from: { email: settings.fromEmail || `noreply@${businessName?.toLowerCase().replace(/\s+/g, '')}.com.au`, name: businessName || 'Food Truck' },
        subject: `🎉 Order #${orderNum} is Ready!`,
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
              <h1 style="color:#f97316;">Your order is ready! 🎉</h1>
              <p>Hey ${order.customerName},</p>
              <p>Your order <strong>#${orderNum}</strong> is ready for collection at <strong>${location}</strong>.</p>
              <div style="background:#1a1a1a;color:white;padding:20px;border-radius:12px;margin:20px 0;">
                <h2 style="color:#f97316;margin-top:0;">Order #${orderNum}</h2>
                ${(order.items || []).map((line: any) => `<p style="margin:4px 0;">${line.quantity}× ${line.item?.name || 'Item'}</p>`).join('')}
                <hr style="border-color:#333;"/>
                <p style="font-size:18px;font-weight:bold;">Total: $${order.total?.toFixed(2) || '0.00'}</p>
              </div>
              <p>Thanks for ordering!</p>
              <p style="color:#888;font-size:12px;">— ${businessName || 'The Team'}</p>
            </div>
          `,
        }],
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('[Email order-ready] MailChannels error:', err);
      return json({ error: 'Email delivery failed' }, 500);
    }

    return json({ sent: true });
  } catch (err: any) {
    console.error('[Email order-ready]', err);
    return json({ error: err.message }, 500);
  }
};
