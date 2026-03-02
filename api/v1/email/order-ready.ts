import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

async function sendEmail(settings: any, to: string, subject: string, text: string, html: string) {
  if (process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY) {
    const { sendEmailSES } = await import('../_lib/ses');
    return sendEmailSES({ to, subject, text, html, fromEmail: settings?.fromEmail, fromName: settings?.fromName });
  }
  if (settings?.smtpHost && settings?.smtpUser && settings?.smtpPass) {
    const port = Number(settings.smtpPort);
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost, port, secure: port === 465,
      auth: { user: settings.smtpUser, pass: settings.smtpPass },
      connectionTimeout: 10000,
    });
    return transporter.sendMail({
      from: `"${settings.fromName || 'Your Business'}" <${settings.fromEmail || settings.smtpUser}>`,
      to, subject, text, html,
    });
  }
  throw new Error('No email provider configured.');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.EMAIL_API_SECRET;
  if (secret && req.headers['x-api-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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

    await sendEmail(settings, order.customerEmail,
      `Your Your Business order is READY! 🔥📍`,
      `Hey ${order.customerName}, your food is ready! Pick up at: ${location}. Map: ${mapLink}`,
      customerHtml
    );

    res.json({ success: true, provider: process.env.AWS_SES_ACCESS_KEY_ID ? 'ses' : 'smtp' });
  } catch (error: any) {
    console.error('Order ready email error:', error);
    res.status(500).json({ error: error.message });
  }
}
