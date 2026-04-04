/**
 * SMS: Cooking Started notification via ClickSend.
 */
import { getTenantFromRequest } from '../_lib/tenant';
import { sendClickSendSms, normalizePhone } from './_clicksend';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { tenantId } = await getTenantFromRequest(request, env);

  try {
    const { settings, order, businessName } = await request.json();
    if (!settings?.enabled || !order?.customerPhone) return json({ skipped: true });

    const phone = normalizePhone(order.customerPhone);
    const pin = order.collectionPin || order.collection_pin || (order.id || '').slice(-4).toUpperCase();
    const name = (order.customerName || order.customer_name || '').split(' ')[0] || 'legend';
    const biz = businessName || 'the kitchen';

    // Fun facts to rotate through
    const funFacts = [
      `Did you know? You just skipped an imaginary queue of 47 people. Technology, mate.`,
      `While you wait, fun fact: the average food truck serves 250+ customers a day. You're one of the special ones.`,
      `Pro tip: stand where you can smell the smoke. It makes the wait 83% more enjoyable (not a real stat).`,
      `You ordered from your phone like a genius. The person behind you is still squinting at the menu board.`,
      `Fun fact: this order was placed, confirmed, and started cooking faster than you can say "can I get uhhhh..."`,
      `Your order is being prepared with love, fire, and a slightly concerning amount of seasoning.`,
      `While lesser ordering systems are still buffering, yours is already on the grill. You're welcome.`,
      `Smoke is rising, tongs are tong-ing, and your food is getting the VIP treatment.`,
    ];
    const funFact = funFacts[Math.floor(Math.random() * funFacts.length)];

    const message = `🔥 ${name}, your order ${pin} just hit the grill at ${biz}!\n\n${funFact}\n\nWe'll text you the second it's ready. Hang tight!`;

    const { messageId } = await sendClickSendSms(settings, phone, message);
    return json({ sent: true, messageId });
  } catch (err: any) {
    console.error('[SMS cooking-started]', err);
    return json({ error: err.message }, 500);
  }
};
