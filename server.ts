import express from 'express';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));


// --- Amazon SES helper ---
function isSESConfigured() {
  return !!(process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY);
}

async function sendEmailSES(to: string, subject: string, text: string, html: string, fromEmail?: string, fromName?: string) {
  const client = new SESClient({
    region: process.env.AWS_SES_REGION || 'ap-southeast-2',
    credentials: {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!,
    },
  });
  const source = `"${fromName || process.env.SES_FROM_NAME || 'Your Business'}" <${fromEmail || process.env.SES_FROM_EMAIL || 'noreply@foodtruckapp.com.au'}>`;
  const result = await client.send(new SendEmailCommand({
    Source: source,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Text: { Data: text, Charset: 'UTF-8' }, Html: { Data: html, Charset: 'UTF-8' } },
    },
  }));
  return { messageId: result.MessageId || '' };
}

// --- MessageBird SMS helper ---
function isMessageBirdConfigured() {
  return !!process.env.MESSAGEBIRD_API_KEY;
}

async function sendSMSMessageBird(to: string, body: string) {
  const apiKey = process.env.MESSAGEBIRD_API_KEY!;
  const originator = process.env.MESSAGEBIRD_ORIGINATOR || 'StreetMeatz';
  let recipient = to.replace(/\s+/g, '');
  if (recipient.startsWith('0')) recipient = '61' + recipient.slice(1);
  if (recipient.startsWith('+')) recipient = recipient.slice(1);
  const res = await fetch('https://rest.messagebird.com/messages', {
    method: 'POST',
    headers: { 'Authorization': `AccessKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ originator, recipients: [recipient], body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ errors: [{ description: res.statusText }] }));
    throw new Error(err.errors?.[0]?.description || `MessageBird error ${res.status}`);
  }
  const data = await res.json();
  return { id: data.id || '' };
}

// --- Unified send helpers ---
async function sendEmail(settings: any, to: string, subject: string, text: string, html: string) {
  if (isSESConfigured()) {
    return sendEmailSES(to, subject, text, html, settings?.fromEmail, settings?.fromName);
  }
  // Fallback to SMTP
  const port = Number(settings.smtpPort);
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: port,
    secure: port === 465,
    auth: { user: settings.smtpUser, pass: settings.smtpPass },
    connectionTimeout: 10000,
  });
  const info = await transporter.sendMail({
    from: `"${settings.fromName || 'Your Business'}" <${settings.fromEmail || settings.smtpUser}>`,
    to, subject, text, html,
  });
  return { messageId: info.messageId };
}

async function sendSMS(settings: any, to: string, body: string) {
  // Normalize AU phone numbers to +61 format
  let normalizedTo = to.replace(/[\s\-()]/g, '');
  if (!normalizedTo.startsWith('+')) {
    if (normalizedTo.startsWith('0')) normalizedTo = normalizedTo.slice(1);
    if (!normalizedTo.startsWith('61')) normalizedTo = '61' + normalizedTo;
    normalizedTo = '+' + normalizedTo;
  }

  if (isMessageBirdConfigured()) {
    return sendSMSMessageBird(normalizedTo, body);
  }
  // Fallback to Twilio via REST API
  if (!settings?.accountSid || !settings?.authToken || !settings?.fromNumber) {
    throw new Error('Twilio credentials incomplete. Provide Account SID, Auth Token, and From Number.');
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${settings.accountSid}/Messages.json`;
  const auth = Buffer.from(`${settings.accountSid}:${settings.authToken}`).toString('base64');
  const params = new URLSearchParams();
  params.append('To', normalizedTo);
  params.append('From', settings.fromNumber);
  params.append('Body', body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error_message || `Twilio error ${res.status}: ${data.code}`);
  }
  return { sid: data.sid };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Simple shared-secret auth middleware for API routes
  const EMAIL_API_SECRET = process.env.EMAIL_API_SECRET || '';
  const authenticateApi = (req: any, res: any, next: any) => {
    if (!EMAIL_API_SECRET) return next(); // Skip if no secret configured
    const token = req.headers['x-api-secret'];
    if (token !== EMAIL_API_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // Email API Route
  app.post('/api/v1/email/test', authenticateApi, async (req, res) => {
    try {
      const { settings, to } = req.body;

      if (!settings) {
        return res.status(400).json({ error: 'No email settings provided' });
      }
      if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
        return res.status(400).json({ error: 'Missing SMTP credentials. Please fill in Host, User, and Password.' });
      }
      const recipient = to || settings.adminEmail || settings.fromEmail;
      if (!recipient) {
        return res.status(400).json({ error: 'No recipient address. Set an Admin Email or From Email first.' });
      }

      const info = await sendEmail(
        settings,
        recipient,
        "Test Email from Your Business",
        "This is a test email to verify your email settings.",
        "<b>This is a test email</b> to verify your email settings."
      );

      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error('Email error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/v1/email/order-notification', authenticateApi, async (req, res) => {
      try {
        const { settings, order } = req.body;
  
        if (!settings || !settings.enabled) {
          return res.status(400).json({ error: 'Email settings not configured or disabled' });
        }
  
        const itemsList = order.items.map((item: any) => 
            `<li>${item.quantity}x ${item.name} - $${(item.price * item.quantity).toFixed(2)}</li>`
        ).join('');

        const cookDate = new Date(order.cookDay).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
        // --- ADMIN EMAIL ---
        const adminHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a1a;color:#fff;border-radius:12px;overflow:hidden;">
            <div style="background:#d9381e;padding:20px;text-align:center;">
              <h1 style="margin:0;color:#fff;">🔥 New Order Received!</h1>
            </div>
            <div style="padding:24px;">
              <p><strong>Order ID:</strong> #${order.id?.slice(-6) || order.id}</p>
              <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
              <p><strong>Cook Day:</strong> ${cookDate} at ${order.pickupTime}</p>
              <p><strong>Type:</strong> ${order.type}</p>
              <h3 style="color:#eab308;">Items:</h3>
              <ul>${itemsList}</ul>
              <hr style="border-color:#333;"/>
              <p style="font-size:18px;"><strong>Total:</strong> $${order.total.toFixed(2)}</p>
              <p><strong>Deposit:</strong> $${(order.depositAmount || 0).toFixed(2)}</p>
            </div>
          </div>
        `;
  
        await sendEmail(
          settings,
          settings.adminEmail,
          `New Order: ${order.customerName} - $${order.total.toFixed(2)}`,
          `New Order from ${order.customerName} for $${order.total.toFixed(2)}`,
          adminHtml
        );

        // --- CUSTOMER CONFIRMATION EMAIL ---
        if (order.customerEmail) {
          const customerHtml = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a1a;color:#fff;border-radius:12px;overflow:hidden;">
              <div style="background:#d9381e;padding:20px;text-align:center;">
                <h1 style="margin:0;color:#fff;">🔥 Order Confirmed!</h1>
                <p style="margin:4px 0 0;color:#ffdddd;">Your Business</p>
              </div>
              <div style="padding:24px;">
                <p>Hey <strong>${order.customerName}</strong>,</p>
                <p>Thanks for your order! Here's your summary:</p>
                <div style="background:#222;padding:16px;border-radius:8px;margin:16px 0;">
                  <h3 style="color:#eab308;margin-top:0;">Your Order</h3>
                  <ul style="padding-left:20px;">${itemsList}</ul>
                  <hr style="border-color:#333;"/>
                  <p style="font-size:18px;margin-bottom:0;"><strong>Total: $${order.total.toFixed(2)}</strong></p>
                </div>
                <div style="background:#222;padding:16px;border-radius:8px;margin:16px 0;">
                  <p style="margin:0;"><strong>📅 Cook Day:</strong> ${cookDate}</p>
                  <p style="margin:8px 0 0;"><strong>⏰ Pickup Time:</strong> ${order.pickupTime}</p>
                </div>
                <p style="color:#aaa;font-size:13px;">We'll send you another message when your food is ready with the exact pickup location. Keep an eye on your phone!</p>
                <p style="color:#aaa;font-size:12px;margin-top:24px;">— The Your Business Crew 🍖</p>
              </div>
            </div>
          `;

          await sendEmail(
            settings,
            order.customerEmail,
            `Your Your Business Order is Confirmed! 🔥`,
            `Thanks for your order ${order.customerName}! Total: $${order.total.toFixed(2)}. Cook Day: ${cookDate} at ${order.pickupTime}.`,
            customerHtml
          );
        }
  
        res.json({ success: true });
      } catch (error: any) {
        console.error('Order email error:', error);
        res.status(500).json({ error: error.message });
      }
    });

  // Order Ready Notification — sends customer a "food is ready" email with map pin
  app.post('/api/v1/email/order-ready', authenticateApi, async (req, res) => {
      try {
        const { settings, order, location } = req.body;
  
        if (!settings || !settings.enabled) {
          return res.status(400).json({ error: 'Email settings not configured or disabled' });
        }

        if (!order.customerEmail) {
          return res.status(400).json({ error: 'No customer email on this order' });
        }

        const mapLink = `https://maps.google.com/?q=${encodeURIComponent(location || 'Ipswich QLD')}`;

        const customerHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a1a;color:#fff;border-radius:12px;overflow:hidden;">
            <div style="background:#16a34a;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;">Your Food is READY! 🔥</h1>
              <p style="margin:8px 0 0;color:#dcfce7;font-size:14px;">Your Business</p>
            </div>
            <div style="padding:24px;">
              <p style="font-size:16px;">Hey <strong>${order.customerName}</strong>,</p>
              <p style="font-size:16px;">Your order is hot off the smoker and waiting for you!</p>
              
              <div style="background:#222;padding:20px;border-radius:12px;margin:20px 0;text-align:center;">
                <p style="margin:0 0 4px;color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Pickup Location</p>
                <p style="margin:0;font-size:20px;font-weight:bold;color:#eab308;">${location || 'See map below'}</p>
              </div>

              <div style="text-align:center;margin:24px 0;">
                <a href="${mapLink}" 
                   style="display:inline-block;background:#d9381e;color:#fff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:bold;font-size:16px;">
                  📍 Open Map Directions
                </a>
              </div>

              ${order.collectionPin ? `
              <div style="background:#222;padding:16px;border-radius:8px;margin:16px 0;text-align:center;">
                <p style="margin:0 0 4px;color:#aaa;font-size:11px;text-transform:uppercase;">Your Collection PIN</p>
                <p style="margin:0;font-size:32px;font-weight:bold;color:#fff;letter-spacing:8px;">${order.collectionPin}</p>
              </div>
              ` : ''}

              <p style="color:#aaa;font-size:13px;text-align:center;margin-top:24px;">See you soon! 🍖</p>
              <p style="color:#666;font-size:11px;text-align:center;">— The Your Business Crew</p>
            </div>
          </div>
        `;

        await sendEmail(
          settings,
          order.customerEmail,
          `Your Your Business order is READY! 🔥📍`,
          `Hey ${order.customerName}, your food is ready! Pick up at: ${location}. Map: ${mapLink}`,
          customerHtml
        );
  
        res.json({ success: true });
      } catch (error: any) {
        console.error('Order ready email error:', error);
        res.status(500).json({ error: error.message });
      }
    });

  // ===== SMS Routes (MessageBird → Twilio fallback) =====
  app.post('/api/v1/sms/test', authenticateApi, async (req, res) => {
    try {
      const { settings, to } = req.body;
      const recipient = to || settings?.adminPhone;
      if (!recipient) return res.status(400).json({ error: 'No recipient phone number. Set an Admin Phone first.' });

      const result = await sendSMS(settings, recipient, '🔥 Test SMS from Your Business — your integration is working!');
      res.json({ success: true, ...result, provider: isMessageBirdConfigured() ? 'messagebird' : 'twilio' });
    } catch (error: any) {
      console.error('SMS error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/v1/sms/order-notification', authenticateApi, async (req, res) => {
    try {
      const { settings, order } = req.body;
      const adminMsg = `🔥 New Order! ${order.customerName} — $${order.total?.toFixed(2)}. Cook Day: ${order.cookDay}`;
      if (settings?.adminPhone) {
        await sendSMS(settings, settings.adminPhone, adminMsg);
      }
      if (order.customerPhone) {
        const customerMsg = `Hey ${order.customerName}! Your Your Business order is confirmed 🔥 Total: $${order.total?.toFixed(2)}. We'll SMS when it's ready!`;
        await sendSMS(settings, order.customerPhone, customerMsg);
      }
      res.json({ success: true, provider: isMessageBirdConfigured() ? 'messagebird' : 'twilio' });
    } catch (error: any) {
      console.error('SMS order notification error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/v1/sms/order-ready', authenticateApi, async (req, res) => {
    try {
      const { settings, order, location } = req.body;
      if (!order.customerPhone) return res.status(400).json({ error: 'No customer phone on this order' });
      const mapLink = `https://maps.google.com/?q=${encodeURIComponent(location || 'Ipswich QLD')}`;
      const msg = `🔥 ${order.customerName}, your Your Business order is READY! Pickup at: ${location}. Map: ${mapLink}${order.collectionPin ? ` PIN: ${order.collectionPin}` : ''}`;
      await sendSMS(settings, order.customerPhone, msg);
      res.json({ success: true, provider: isMessageBirdConfigured() ? 'messagebird' : 'twilio' });
    } catch (error: any) {
      console.error('SMS order ready error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send Invoice — Email
  app.post('/api/v1/email/send-invoice', authenticateApi, async (req, res) => {
    try {
      const { settings, order, businessName, invoiceSettings } = req.body;
      if (!settings || !settings.enabled) return res.status(400).json({ error: 'Email settings not configured or disabled' });
      if (!order?.customerEmail) return res.status(400).json({ error: 'Customer email is required' });

      const inv = invoiceSettings || {};
      const name = businessName || 'Your Business';
      const headerColor = inv.headerColor || '#d9381e';
      const accentColor = inv.accentColor || '#eab308';
      const paymentUrl = inv.paymentUrl || '';
      const paymentLabel = inv.paymentLabel || 'Pay Now';
      const logoUrl = inv.logoUrl || '';
      const thankYou = inv.thankYouMessage || "Here's your invoice. Please review the details below and arrange payment at your earliest convenience.";
      const footerNote = inv.footerNote || 'Thank you for your business!';
      const bankDetails = inv.bankDetails || '';
      const orderNum = order.id?.slice(-6) || order.id || '000000';
      const total = Number(order.total || 0).toFixed(2);

      const itemsRows = (order.items || []).map((item: any) => {
        const itemName = item.item?.name || item.name || 'Item';
        const itemPrice = Number(item.item?.price || item.price || 0);
        const qty = Number(item.quantity || 1);
        return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#333;">${qty}x ${itemName}</td><td style="padding:10px 0;border-bottom:1px solid #eee;color:#333;text-align:right;font-weight:600;">$${(itemPrice * qty).toFixed(2)}</td></tr>`;
      }).join('');

      const cookDate = order.cookDay ? new Date(order.cookDay).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBC';
      const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${name}" style="max-height:48px;margin-bottom:8px;" /><br/>` : '';

      let paymentSection = '';
      if (paymentUrl) {
        paymentSection = `<div style="text-align:center;padding:24px 0;"><a href="${paymentUrl}" target="_blank" style="display:inline-block;background:${accentColor};color:#000;font-weight:bold;padding:16px 40px;border-radius:8px;text-decoration:none;font-size:17px;">${paymentLabel} &mdash; $${total}</a><p style="color:#999;font-size:12px;margin-top:10px;">Click the button or copy: <a href="${paymentUrl}" style="color:${accentColor};word-break:break-all;">${paymentUrl}</a></p></div>`;
      } else if (bankDetails) {
        paymentSection = `<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0 0 8px;font-weight:bold;font-size:13px;color:#555;text-transform:uppercase;">Payment Details</p><pre style="margin:0;font-family:monospace;font-size:13px;color:#333;white-space:pre-wrap;">${bankDetails}</pre></div>`;
      } else {
        paymentSection = `<p style="text-align:center;color:${accentColor};font-size:22px;font-weight:bold;padding:16px 0;">Amount Due: $${total}</p>`;
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px 16px;"><div style="background:${headerColor};border-radius:12px 12px 0 0;padding:28px 24px;text-align:center;">${logoHtml}<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Invoice from ${name}</h1><p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Order #${orderNum}</p></div><div style="background:#ffffff;padding:28px 24px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;"><p style="color:#333;font-size:15px;margin:0 0 6px;">Hey <strong>${order.customerName || 'there'}</strong>,</p><p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 20px;">${thankYou}</p><div style="background:#fafafa;border:1px solid #eee;border-radius:8px;padding:16px;margin-bottom:20px;"><p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;">Order Details</p><table style="width:100%;border-collapse:collapse;"><tbody><tr><td style="padding:6px 0;color:#888;font-size:12px;">Date</td><td style="padding:6px 0;color:#333;text-align:right;font-size:13px;">${cookDate}</td></tr>${order.pickupTime ? `<tr><td style="padding:6px 0;color:#888;font-size:12px;">Pickup</td><td style="padding:6px 0;color:#333;text-align:right;font-size:13px;">${order.pickupTime}</td></tr>` : ''}<tr><td style="padding:6px 0;color:#888;font-size:12px;">Order #</td><td style="padding:6px 0;color:#333;text-align:right;font-size:13px;font-weight:600;">${orderNum}</td></tr></tbody></table></div><table style="width:100%;border-collapse:collapse;margin-bottom:16px;"><thead><tr><th style="text-align:left;padding:8px 0;border-bottom:2px solid ${headerColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;">Item</th><th style="text-align:right;padding:8px 0;border-bottom:2px solid ${headerColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;">Amount</th></tr></thead><tbody>${itemsRows}<tr><td style="padding:14px 0;font-size:17px;font-weight:700;color:#111;">Total</td><td style="padding:14px 0;font-size:17px;font-weight:700;color:#111;text-align:right;">$${total}</td></tr></tbody></table>${paymentSection}</div><div style="background:#fafafa;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px;text-align:center;"><p style="color:#999;font-size:12px;line-height:1.6;margin:0;">${footerNote}</p><p style="color:#bbb;font-size:11px;margin:12px 0 0;">&mdash; The ${name} Team</p></div></div></body></html>`;
      const text = `Invoice from ${name}\n\nHey ${order.customerName || 'there'},\n\n${thankYou}\n\nOrder #${orderNum}\nDate: ${cookDate}\nTotal: $${total}\n\n${paymentUrl ? `Pay here: ${paymentUrl}` : bankDetails ? `Payment Details:\n${bankDetails}` : 'Please arrange payment.'}\n\n${footerNote}\n\n— ${name}`;

      await sendEmail(settings, order.customerEmail, `Invoice #${orderNum}: $${total} — ${name}`, text, html);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Invoice email error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send Invoice — SMS
  app.post('/api/v1/sms/send-invoice', authenticateApi, async (req, res) => {
    try {
      const { settings, order, businessName, invoiceSettings } = req.body;
      const inv = invoiceSettings || {};
      const name = businessName || 'Your Business';
      if (!order?.customerPhone) return res.status(400).json({ error: 'Customer phone is required' });

      const paymentUrl = inv.paymentUrl || '';
      const total = Number(order.total || 0).toFixed(2);
      const orderNum = order.id?.slice(-6) || order.id || '000000';
      const payLink = paymentUrl ? `\nPay here: ${paymentUrl}` : '';
      const template = inv.smsTemplate || 'Hi {name}, you have an invoice for ${total} from {business}. Order #{orderNum}.{payLink}\n\nCheers!';
      const msg = template
        .replace(/\{name\}/g, order.customerName || 'there')
        .replace(/\$\{total\}/g, `$${total}`)
        .replace(/\{total\}/g, total)
        .replace(/\{business\}/g, name)
        .replace(/\{orderNum\}/g, orderNum)
        .replace(/\{payLink\}/g, payLink);

      await sendSMS(settings, order.customerPhone, msg);
      res.json({ success: true, provider: isMessageBirdConfigured() ? 'messagebird' : 'twilio' });
    } catch (error: any) {
      console.error('Invoice SMS error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // SMS Blast — Send a single SMS (called per-recipient by the frontend)
  app.post('/api/v1/sms/blast', authenticateApi, async (req, res) => {
    try {
      const { settings, to, message } = req.body;
      if (!to) return res.status(400).json({ error: 'Recipient phone number is required' });
      if (!message) return res.status(400).json({ error: 'Message body is required' });
      await sendSMS(settings, to, message);
      res.json({ success: true, provider: isMessageBirdConfigured() ? 'messagebird' : 'twilio' });
    } catch (error: any) {
      console.error('SMS blast error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Square Checkout — Generate a payment link for invoices
  app.post('/api/v1/payment/square-checkout', authenticateApi, async (req, res) => {
    try {
      const { amount, currency, locationId, accessToken, environment, orderId, description, redirectUrl } = req.body;
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
          checkout_options: { allow_tipping: false, ask_for_shipping_address: false, redirect_url: redirectUrl || undefined },
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
  });

  // Square Webhook — Handle payment.completed events from Square
  app.post('/api/v1/payment/square-webhook', async (req, res) => {
    try {
      const event = req.body;
      const eventType = event?.type;
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

      // Use Firebase Admin to look up our order
      const { initializeApp: initAdmin, cert: certFn, getApps: getAdminApps } = await import('firebase-admin/app');
      const { getFirestore: getAdminFirestore } = await import('firebase-admin/firestore');

      if (!getAdminApps().length) {
        const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (sa) {
          initAdmin({ credential: certFn(JSON.parse(sa)) });
        } else {
          initAdmin({ projectId: process.env.FIREBASE_PROJECT_ID || 'foodtruck-app' });
        }
      }
      const adminDb = getAdminFirestore();
      const snapshot = await adminDb.collection('orders').where('squareCheckoutId', '==', squareOrderId).limit(1).get();

      if (snapshot.empty) {
        console.warn(`[Square Webhook] No matching order for squareCheckoutId: ${squareOrderId}`);
        return res.status(200).json({ received: true, matched: false });
      }

      const orderDoc = snapshot.docs[0];
      const order = orderDoc.data();
      const orderId = orderDoc.id;

      if (order.status !== 'Awaiting Payment') {
        console.log(`[Square Webhook] Order ${orderId} status is '${order.status}', skipping.`);
        return res.status(200).json({ received: true, matched: true, skipped: true });
      }

      await adminDb.collection('orders').doc(orderId).update({ status: 'Paid', paymentIntentId: payment.id });
      console.log(`[Square Webhook] Order ${orderId} updated to 'Paid'`);

      // Load settings for confirmation comms
      const settingsDoc = await adminDb.collection('settings').doc('general').get();
      const settings = settingsDoc.exists ? settingsDoc.data() : null;
      const confirmResults: string[] = [];
      const amountPaid = (payment.amount_money?.amount / 100).toFixed(2);

      // Send confirmation email
      if (order.customerEmail && settings?.emailSettings?.enabled) {
        try {
          await sendEmail(
            order.customerEmail,
            `Payment Confirmed - Order #${orderId.slice(-6)}`,
            `Payment of $${amountPaid} received for your order. Thank you!`,
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#d9381e;">Payment Confirmed!</h2>
              <p>We've received your payment of <strong>$${amountPaid} AUD</strong> for Order #${orderId.slice(-6)}.</p>
              <p>Your order status has been updated to <strong>Paid</strong> and will be processed shortly.</p>
              <p>Thank you for choosing ${settings?.businessName || 'Your Business'}!</p>
            </div>`,
            settings.emailSettings
          );
          confirmResults.push('email');
        } catch (e) { console.warn('[Square Webhook] Confirmation email error:', e); }
      }

      // Send confirmation SMS
      if (order.customerPhone && settings?.smsSettings?.enabled) {
        try {
          const smsBody = `${settings?.businessName || 'Your Business'}: Payment of $${amountPaid} received for Order #${orderId.slice(-6)}. Your order is confirmed! Thank you.`;
          await sendSMS(order.customerPhone, smsBody, settings.smsSettings);
          confirmResults.push('sms');
        } catch (e) { console.warn('[Square Webhook] Confirmation SMS error:', e); }
      }

      console.log(`[Square Webhook] Confirmations sent: ${confirmResults.join(', ') || 'none'}`);
      res.status(200).json({ received: true, matched: true, orderId, status: 'Paid', confirmations: confirmResults });
    } catch (error: any) {
      console.error('[Square Webhook] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Claude AI — Status Check (connectivity + credit verification)
  app.get('/api/v1/ai/claude-status', async (req, res) => {
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
  });

  // Claude AI — Smart Schedule Generator
  app.post('/api/v1/ai/smart-schedule', async (req, res) => {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'CLAUDE_API_KEY not configured on server.' });
    }
    try {
      const { stats, cookDays, menuItems, postsToGenerate = 10, existingPosts = [], now, windowEnd, intent = 'fresh' } = req.body;

      const cookDayContext = cookDays?.length > 0
        ? cookDays.map((d: any) => `${d.date} — ${d.title} at ${d.location}`).join('\n')
        : 'No upcoming cook days scheduled yet.';

      const menuContext = (menuItems || []).slice(0, 12).map((m: any) => `${m.name} ($${m.price})`).join(', ');

      const existingPostsContext = existingPosts.length > 0
        ? existingPosts.map((p: any) => `${(p.scheduledFor || '').slice(0, 10)} — ${p.platform} (${p.status})`).join('\n')
        : 'None yet.';

      const prompt = `You are a world-class social media strategist for "Your Business", a mobile low-and-slow BBQ business in Ipswich/Brisbane, QLD Australia.

=== BUSINESS CONTEXT ===
Your Business operates a pre-order model: customers pre-order, the pitmaster smokes everything fresh on cook days, and customers pick up. Limited, high-quality, community-driven.

Current performance: ${stats?.followers || 0} followers | ${stats?.engagement || 0}% engagement | ${stats?.reach || 0} monthly reach | ${stats?.postsLast30Days || 0} posts/30d

Upcoming Cook Days:
${cookDayContext}

Menu highlights: ${menuContext}

=== OPTIMAL TIMES (AEST) ===
INSTAGRAM: Wed & Thu 11am-1pm, Fri 11am-1pm, Tue/Wed/Thu 7-9pm, Sat 9-11am
FACEBOOK: Wed-Thu 1-3pm, Fri 11am-2pm, Sun 12-2pm, Thu 7-8pm
AVOID: Monday mornings, before 9am, after 10pm

=== CONTENT PILLARS ===
"Behind The Fire" — smoker prep, overnight cook (Mon/Tue pre-cook hype)
"Food Cinema" — extreme close-ups, bark, smoke ring (Tue/Wed/Thu peak)
"Cook Day Hype" — countdown with urgency and order CTA (pre-cook day)
"Pitmaster Wisdom" — educational BBQ content (Sat/Sun)
"Social Proof" — customer reactions, testimonials (mid-week)
"Scarcity Drop" — limited spots FOMO (Thu/Fri)
"Lifestyle & Vibe" — BBQ culture aesthetic (Sun/Mon)

=== ALREADY SCHEDULED (DO NOT DUPLICATE SAME PLATFORM SAME DAY) ===
${existingPostsContext}

=== ADMIN SCHEDULING INTENT ===
${intent === 'fresh' ? `FRESH SCHEDULE: Create a brand-new content plan for the next 2 weeks starting from ${now}. Spread posts evenly across the window. Avoid duplicating topics or platforms on days that already have posts.` : intent === 'saturate' ? `BOOST EXISTING DAYS: The admin wants MORE content saturation. Focus new posts on days that ALREADY have scheduled posts to increase posting frequency. Add complementary content — different platform or pillar on same day. Double down on cook day hype.` : `FILL GAPS: The admin wants to fill EMPTY days that don't have posts yet. ONLY place new posts on days with zero content. Prioritise consistent daily presence.`}

=== TASK ===
Generate ${postsToGenerate} NEW posts between ${now} and ${windowEnd}.

Rules:
1. Anchor cook days: hype 2 days prior → countdown day before → day-of → sell-out/thank-you after
2. Never same pillar back-to-back
3. Alternate platforms; cook day CTAs go on BOTH
4. scheduledFor must be ISO 8601 UTC (AEST = UTC+10)
5. CTAs must be urgent and human, not robotic
6. 8-15 hashtags mixing hyper-local, niche, and broad
7. imagePrompt must be vivid food photography description for AI image gen

Return ONLY valid JSON:
{
  "strategy": "brief overall strategy",
  "posts": [
    {
      "platform": "Instagram" or "Facebook",
      "scheduledFor": "ISO 8601 UTC string",
      "topic": "short label",
      "content": "full caption",
      "hashtags": ["tag1", "tag2"],
      "imagePrompt": "photography description",
      "reasoning": "why this time and topic",
      "pillar": "pillar name"
    }
  ]
}`;

      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = message.content.find((c: any) => c.type === 'text') as any;
      if (!textBlock) return res.status(500).json({ error: 'No text in Claude response.' });

      const raw = textBlock.text.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ error: `Could not parse JSON. Preview: ${raw.slice(0, 200)}` });

      const parsed = JSON.parse(jsonMatch[0]);
      const safePosts = (parsed.posts || []).map((p: any) => ({
        platform: p.platform || 'Instagram',
        scheduledFor: p.scheduledFor || p.scheduled_for || new Date().toISOString(),
        topic: p.topic || '',
        content: p.content || '',
        hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
        imagePrompt: p.imagePrompt || p.image_prompt || '',
        reasoning: p.reasoning || '',
        pillar: p.pillar || '',
      }));
      res.json({ posts: safePosts, strategy: parsed.strategy || '' });
    } catch (error: any) {
      console.error('Claude schedule error:', error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  // Facebook Token Exchange — converts short-lived user token to long-lived, returns permanent page tokens
  app.post('/api/facebook/exchange-token', async (req, res) => {
      try {
          const { shortLivedToken } = req.body;
          const appId = process.env.VITE_FACEBOOK_APP_ID;
          const appSecret = process.env.FACEBOOK_APP_SECRET;

          if (!appId || !appSecret) {
              return res.status(500).json({ error: 'Facebook App ID and App Secret must be set in server environment variables (VITE_FACEBOOK_APP_ID, FACEBOOK_APP_SECRET).' });
          }

          // Step 1: Exchange short-lived user token for long-lived user token (60 days)
          const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
          const exchangeRes = await fetch(exchangeUrl);
          const exchangeData = await exchangeRes.json();

          if (exchangeData.error) {
              return res.status(400).json({ error: exchangeData.error.message });
          }

          const longLivedUserToken = exchangeData.access_token;

          // Step 2: Fetch pages using long-lived user token — page tokens will be permanent (non-expiring)
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
  });

  // API 404 Handler
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
      // Serve static files in production
      app.use(express.static(path.join(__dirname, 'dist')));
      app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
      });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
