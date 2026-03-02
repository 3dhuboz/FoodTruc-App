import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

async function sendEmail(settings: any, to: string, subject: string, text: string, html: string) {
  // Amazon SES if configured
  if (process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY) {
    const { sendEmailSES } = await import('../_lib/ses');
    return sendEmailSES({ to, subject, text, html, fromEmail: settings?.fromEmail, fromName: settings?.fromName });
  }
  // SMTP fallback
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
    const { settings, order } = req.body;

    if (!settings || !settings.enabled) {
      return res.status(400).json({ error: 'Email settings not configured or disabled' });
    }

    const itemsList = order.items.map((item: any) => 
      `<li>${item.quantity}x ${item.name} - $${(item.price * item.quantity).toFixed(2)}</li>`
    ).join('');

    const cookDate = new Date(order.cookDay).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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

    await sendEmail(settings, settings.adminEmail,
      `New Order: ${order.customerName} - $${order.total.toFixed(2)}`,
      `New Order from ${order.customerName} for $${order.total.toFixed(2)}`,
      adminHtml
    );

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

      await sendEmail(settings, order.customerEmail,
        `Your Your Business Order is Confirmed! 🔥`,
        `Thanks for your order ${order.customerName}! Total: $${order.total.toFixed(2)}. Cook Day: ${cookDate} at ${order.pickupTime}.`,
        customerHtml
      );
    }

    res.json({ success: true, provider: process.env.AWS_SES_ACCESS_KEY_ID ? 'ses' : 'smtp' });
  } catch (error: any) {
    console.error('Order email error:', error);
    res.status(500).json({ error: error.message });
  }
}
