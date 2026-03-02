import crypto from 'crypto';

// ── Firebase REST API helpers (no firebase-admin / no service-account key needed) ──
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'your-project-id';
const WEBHOOK_EMAIL = process.env.WEBHOOK_USER_EMAIL || '';
const WEBHOOK_PASSWORD = process.env.WEBHOOK_USER_PASSWORD || '';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Sign in with email/password via Firebase Auth REST API → returns idToken
async function getAuthToken(): Promise<string> {
  if (!FIREBASE_API_KEY || !WEBHOOK_EMAIL || !WEBHOOK_PASSWORD) {
    throw new Error('Missing FIREBASE_API_KEY, WEBHOOK_USER_EMAIL, or WEBHOOK_USER_PASSWORD env vars');
  }
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: WEBHOOK_EMAIL, password: WEBHOOK_PASSWORD, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Firebase Auth failed: ${err?.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.idToken;
}

// Firestore REST: run a structured query
async function firestoreQuery(collection: string, field: string, value: string, token: string) {
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
        limit: 1,
      },
    }),
  });
  if (!res.ok) throw new Error(`Firestore query failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Firestore REST: get a single document
async function firestoreGet(path: string, token: string) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Firestore get failed: ${res.status}`);
  return res.json();
}

// Firestore REST: update specific fields on a document
async function firestoreUpdate(path: string, fields: Record<string, any>, token: string) {
  const params = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const firestoreFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'number') firestoreFields[k] = { integerValue: String(v) };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
  }
  const res = await fetch(`${FIRESTORE_BASE}/${path}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: firestoreFields }),
  });
  if (!res.ok) throw new Error(`Firestore update failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Convert Firestore document fields to plain JS object
function decodeFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) out[k] = v.stringValue;
    else if ('integerValue' in v) out[k] = Number(v.integerValue);
    else if ('doubleValue' in v) out[k] = v.doubleValue;
    else if ('booleanValue' in v) out[k] = v.booleanValue;
    else if ('mapValue' in v) out[k] = decodeFields(v.mapValue.fields || {});
    else if ('arrayValue' in v) out[k] = (v.arrayValue.values || []).map((item: any) => {
      if ('mapValue' in item) return decodeFields(item.mapValue.fields || {});
      if ('stringValue' in item) return item.stringValue;
      if ('integerValue' in item) return Number(item.integerValue);
      return item;
    });
    else if ('nullValue' in v) out[k] = null;
    else out[k] = v;
  }
  return out;
}

// Verify Square webhook signature
function verifySignature(body: string, signature: string, signatureKey: string, notificationUrl: string): boolean {
  const combined = notificationUrl + body;
  const hmac = crypto.createHmac('sha256', signatureKey).update(combined).digest('base64');
  return hmac === signature;
}

// ── Webhook Handler ──
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const signature = req.headers['x-square-hmacsha256-signature'];
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Optional signature verification
    const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (webhookSignatureKey && signature) {
      const notificationUrl = process.env.SQUARE_WEBHOOK_URL || `https://${req.headers.host}/api/v1/payment/square-webhook`;
      if (!verifySignature(rawBody, signature, webhookSignatureKey, notificationUrl)) {
        console.error('[Square Webhook] Signature verification failed');
        return res.status(403).json({ error: 'Invalid signature' });
      }
    }

    const eventType = event.type;
    console.log(`[Square Webhook] Received event: ${eventType}`);

    if (eventType !== 'payment.completed' && eventType !== 'payment.updated') {
      return res.status(200).json({ received: true });
    }

    const payment = event.data?.object?.payment;
    if (!payment || payment.status !== 'COMPLETED') {
      return res.status(200).json({ received: true });
    }

    const squareOrderId = payment.order_id;
    console.log(`[Square Webhook] Payment COMPLETED for Square order: ${squareOrderId}`);

    // Authenticate with Firebase
    const token = await getAuthToken();

    // Query orders where squareCheckoutId == squareOrderId
    const queryResults = await firestoreQuery('orders', 'squareCheckoutId', squareOrderId, token);
    const matchedDoc = queryResults?.find((r: any) => r.document);
    if (!matchedDoc?.document) {
      console.warn(`[Square Webhook] No matching order for squareCheckoutId: ${squareOrderId}`);
      return res.status(200).json({ received: true, matched: false });
    }

    const docName = matchedDoc.document.name; // projects/.../documents/orders/{id}
    const orderId = docName.split('/').pop();
    const order = decodeFields(matchedDoc.document.fields || {});

    if (order.status !== 'Awaiting Payment') {
      console.log(`[Square Webhook] Order ${orderId} status is '${order.status}', skipping.`);
      return res.status(200).json({ received: true, matched: true, skipped: true });
    }

    // Update order status to 'Paid'
    await firestoreUpdate(`orders/${orderId}`, { status: 'Paid', paymentIntentId: payment.id }, token);
    console.log(`[Square Webhook] Order ${orderId} updated to 'Paid'`);

    // Load settings for email/SMS configuration
    const settingsDoc = await firestoreGet('settings/general', token);
    const settings = settingsDoc?.fields ? decodeFields(settingsDoc.fields) : null;

    const baseUrl = `https://${req.headers.host}`;
    const confirmResults: string[] = [];
    const amountPaid = ((payment.amount_money?.amount || 0) / 100).toFixed(2);

    // Send confirmation email
    if (order.customerEmail && settings?.emailSettings?.enabled) {
      try {
        const emailRes = await fetch(`${baseUrl}/api/v1/email/send-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: settings.emailSettings,
            order: {
              ...order, id: orderId, status: 'Paid',
              items: order.items?.map((li: any) => ({ item: li.item, name: li.item?.name || li.name, price: li.item?.price || li.price, quantity: li.quantity })),
            },
            businessName: settings.businessName || 'My Business',
            invoiceSettings: {
              ...settings.invoiceSettings,
              thankYouMessage: `Payment of $${amountPaid} received! Your order is now confirmed.`,
            },
            subject: `Payment Confirmed - Order #${orderId.slice(-6)}`,
          }),
        });
        if (emailRes.ok) confirmResults.push('email');
        else console.warn('[Square Webhook] Confirmation email failed:', await emailRes.text());
      } catch (e) { console.warn('[Square Webhook] Confirmation email error:', e); }
    }

    // Send confirmation SMS
    if (order.customerPhone && settings?.smsSettings?.enabled) {
      try {
        const smsRes = await fetch(`${baseUrl}/api/v1/sms/send-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: settings.smsSettings,
            order: { ...order, id: orderId, status: 'Paid', customerPhone: order.customerPhone },
            businessName: settings.businessName || 'My Business',
            invoiceSettings: {
              ...settings.invoiceSettings,
              smsTemplate: `${settings.businessName || 'My Business'}: Payment of $${amountPaid} received for Order #${orderId.slice(-6)}. Your order is confirmed! Thank you.`,
            },
          }),
        });
        if (smsRes.ok) confirmResults.push('sms');
        else console.warn('[Square Webhook] Confirmation SMS failed:', await smsRes.text());
      } catch (e) { console.warn('[Square Webhook] Confirmation SMS error:', e); }
    }

    console.log(`[Square Webhook] Confirmations sent: ${confirmResults.join(', ') || 'none'}`);
    return res.status(200).json({ received: true, matched: true, orderId, status: 'Paid', confirmations: confirmResults });
  } catch (error: any) {
    console.error('[Square Webhook] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
