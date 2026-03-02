import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Initialize Firebase Admin (uses FIREBASE_SERVICE_ACCOUNT env var as JSON string)
function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
    } else {
      // Fallback: use project ID from env (works on GCP-hosted environments)
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'foodtruck-app' });
    }
  }
  return getFirestore();
}

// Verify Square webhook signature
function verifySignature(body: string, signature: string, signatureKey: string, notificationUrl: string): boolean {
  const combined = notificationUrl + body;
  const hmac = crypto.createHmac('sha256', signatureKey).update(combined).digest('base64');
  return hmac === signature;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const signature = req.headers['x-square-hmacsha256-signature'];
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Optional signature verification if webhook secret is configured
    const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (webhookSignatureKey && signature) {
      const notificationUrl = process.env.SQUARE_WEBHOOK_URL || `https://${req.headers.host}/api/v1/payment/square-webhook`;
      if (!verifySignature(rawBody, signature, webhookSignatureKey, notificationUrl)) {
        console.error('Square webhook signature verification failed');
        return res.status(403).json({ error: 'Invalid signature' });
      }
    }

    const eventType = event.type;
    console.log(`[Square Webhook] Received event: ${eventType}`);

    // Handle payment.completed and order.fulfillment.updated events
    if (eventType === 'payment.completed' || eventType === 'payment.updated') {
      const payment = event.data?.object?.payment;
      if (!payment) {
        console.warn('[Square Webhook] No payment data in event');
        return res.status(200).json({ received: true });
      }

      const squareOrderId = payment.order_id;
      const paymentStatus = payment.status;

      if (paymentStatus !== 'COMPLETED') {
        console.log(`[Square Webhook] Payment status is ${paymentStatus}, not COMPLETED. Ignoring.`);
        return res.status(200).json({ received: true });
      }

      console.log(`[Square Webhook] Payment COMPLETED for Square order: ${squareOrderId}`);

      // Look up our order by squareCheckoutId
      const db = getAdminDb();
      const ordersRef = db.collection('orders');
      const snapshot = await ordersRef.where('squareCheckoutId', '==', squareOrderId).limit(1).get();

      if (snapshot.empty) {
        console.warn(`[Square Webhook] No matching order found for squareCheckoutId: ${squareOrderId}`);
        return res.status(200).json({ received: true, matched: false });
      }

      const orderDoc = snapshot.docs[0];
      const order = orderDoc.data();
      const orderId = orderDoc.id;

      // Only update if order is in 'Awaiting Payment' status
      if (order.status !== 'Awaiting Payment') {
        console.log(`[Square Webhook] Order ${orderId} status is '${order.status}', not 'Awaiting Payment'. Skipping update.`);
        return res.status(200).json({ received: true, matched: true, skipped: true });
      }

      // Update order status to 'Paid'
      await ordersRef.doc(orderId).update({
        status: 'Paid',
        paymentIntentId: payment.id,
      });
      console.log(`[Square Webhook] Order ${orderId} updated to 'Paid'`);

      // Load settings for email/SMS configuration
      const settingsDoc = await db.collection('settings').doc('general').get();
      const settings = settingsDoc.exists ? settingsDoc.data() : null;

      // Send confirmation communications
      const baseUrl = `https://${req.headers.host}`;
      const confirmResults: string[] = [];

      // Send confirmation email
      if (order.customerEmail && settings?.emailSettings?.enabled) {
        try {
          const emailRes = await fetch(`${baseUrl}/api/v1/email/send-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              settings: settings.emailSettings,
              order: {
                ...order,
                id: orderId,
                status: 'Paid',
                items: order.items?.map((li: any) => ({ item: li.item, name: li.item?.name || li.name, price: li.item?.price || li.price, quantity: li.quantity })),
              },
              businessName: settings.businessName || 'Your Business',
              invoiceSettings: {
                ...settings.invoiceSettings,
                thankYouMessage: `Payment of $${(payment.amount_money?.amount / 100).toFixed(2)} received! Your order is now confirmed.`,
              },
              subject: `Payment Confirmed - Order #${orderId.slice(-6)}`,
            }),
          });
          if (emailRes.ok) confirmResults.push('email');
          else console.warn('[Square Webhook] Confirmation email failed:', await emailRes.text());
        } catch (e) {
          console.warn('[Square Webhook] Confirmation email error:', e);
        }
      }

      // Send confirmation SMS
      if (order.customerPhone && settings?.smsSettings?.enabled) {
        try {
          const smsTemplate = settings.invoiceSettings?.smsTemplate || '{businessName}: Payment received for Order #{orderId}. Total: ${total}. Thank you!';
          const smsBody = smsTemplate
            .replace('{businessName}', settings.businessName || 'Your Business')
            .replace('{orderId}', orderId.slice(-6))
            .replace('{total}', (order.total || 0).toFixed(2))
            .replace('{paymentUrl}', '');

          const smsRes = await fetch(`${baseUrl}/api/v1/sms/send-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              settings: settings.smsSettings,
              order: { ...order, id: orderId, status: 'Paid', customerPhone: order.customerPhone },
              businessName: settings.businessName || 'Your Business',
              invoiceSettings: {
                ...settings.invoiceSettings,
                smsTemplate: `${settings.businessName || 'Your Business'}: Payment of $${(payment.amount_money?.amount / 100).toFixed(2)} received for Order #${orderId.slice(-6)}. Your order is confirmed! Thank you.`,
              },
            }),
          });
          if (smsRes.ok) confirmResults.push('sms');
          else console.warn('[Square Webhook] Confirmation SMS failed:', await smsRes.text());
        } catch (e) {
          console.warn('[Square Webhook] Confirmation SMS error:', e);
        }
      }

      console.log(`[Square Webhook] Confirmation sent via: ${confirmResults.join(', ') || 'none (no channels configured)'}`);

      return res.status(200).json({
        received: true,
        matched: true,
        orderId,
        status: 'Paid',
        confirmations: confirmResults,
      });
    }

    // Acknowledge all other events
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Square Webhook] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
