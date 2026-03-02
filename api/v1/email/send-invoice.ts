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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { settings, order, businessName, invoiceSettings } = req.body;

    if (!settings || !settings.enabled) {
      return res.status(400).json({ error: 'Email settings not configured or disabled' });
    }
    if (!order?.customerEmail) {
      return res.status(400).json({ error: 'Customer email is required' });
    }

    const inv = invoiceSettings || {};
    const name = businessName || 'Your Business';
    const headerColor = inv.headerColor || '#d9381e';
    const accentColor = inv.accentColor || '#eab308';
    const paymentUrl = inv.paymentUrl || '';
    const paymentLabel = inv.paymentLabel || 'Pay Now';
    const logoUrl = inv.logoUrl || '';
    const thankYou = inv.thankYouMessage || "Here's your invoice. Please review the details below and arrange payment at your earliest convenience.";
    const footerNote = inv.footerNote || 'Thank you for your business! If you have questions about this invoice, reply to this email or give us a call.';
    const bankDetails = inv.bankDetails || '';
    const orderNum = order.id?.slice(-6) || order.id || '000000';
    const total = Number(order.total || 0).toFixed(2);

    const itemsRows = (order.items || []).map((item: any) => {
      const itemName = item.item?.name || item.name || 'Item';
      const itemPrice = Number(item.item?.price || item.price || 0);
      const qty = Number(item.quantity || 1);
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;color:#333;">${qty}x ${itemName}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;color:#333;text-align:right;font-weight:600;">$${(itemPrice * qty).toFixed(2)}</td>
      </tr>`;
    }).join('');

    const cookDate = order.cookDay
      ? new Date(order.cookDay).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'TBC';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${name}" style="max-height:48px;margin-bottom:8px;" /><br/>`
      : '';

    let paymentSection = '';
    if (paymentUrl) {
      paymentSection = `
        <div style="text-align:center;padding:24px 0;">
          <a href="${paymentUrl}" target="_blank" style="display:inline-block;background:${accentColor};color:#000;font-weight:bold;padding:16px 40px;border-radius:8px;text-decoration:none;font-size:17px;letter-spacing:0.5px;">${paymentLabel} &mdash; $${total}</a>
          <p style="color:#999;font-size:12px;margin-top:10px;">Click the button above or copy this link:<br/><a href="${paymentUrl}" style="color:${accentColor};word-break:break-all;">${paymentUrl}</a></p>
        </div>`;
    } else if (bankDetails) {
      paymentSection = `
        <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px;font-weight:bold;font-size:13px;color:#555;text-transform:uppercase;">Payment Details</p>
          <pre style="margin:0;font-family:monospace;font-size:13px;color:#333;white-space:pre-wrap;">${bankDetails}</pre>
        </div>`;
    } else {
      paymentSection = `<p style="text-align:center;color:${accentColor};font-size:22px;font-weight:bold;padding:16px 0;">Amount Due: $${total}</p>`;
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <!-- Header -->
    <div style="background:${headerColor};border-radius:12px 12px 0 0;padding:28px 24px;text-align:center;">
      ${logoHtml}
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Invoice from ${name}</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Order #${orderNum}</p>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;padding:28px 24px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hey <strong>${order.customerName || 'there'}</strong>,</p>
      <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 20px;">${thankYou}</p>

      <!-- Order Details -->
      <div style="background:#fafafa;border:1px solid #eee;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;">Order Details</p>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr><td style="padding:6px 0;color:#888;font-size:12px;">Date</td><td style="padding:6px 0;color:#333;text-align:right;font-size:13px;">${cookDate}</td></tr>
            ${order.pickupTime ? `<tr><td style="padding:6px 0;color:#888;font-size:12px;">Pickup</td><td style="padding:6px 0;color:#333;text-align:right;font-size:13px;">${order.pickupTime}</td></tr>` : ''}
            <tr><td style="padding:6px 0;color:#888;font-size:12px;">Order #</td><td style="padding:6px 0;color:#333;text-align:right;font-size:13px;font-weight:600;">${orderNum}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Items -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 0;border-bottom:2px solid ${headerColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;">Item</th>
            <th style="text-align:right;padding:8px 0;border-bottom:2px solid ${headerColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
          <tr>
            <td style="padding:14px 0;font-size:17px;font-weight:700;color:#111;">Total</td>
            <td style="padding:14px 0;font-size:17px;font-weight:700;color:#111;text-align:right;">$${total}</td>
          </tr>
        </tbody>
      </table>

      <!-- Payment -->
      ${paymentSection}
    </div>

    <!-- Footer -->
    <div style="background:#fafafa;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px;text-align:center;">
      <p style="color:#999;font-size:12px;line-height:1.6;margin:0;">${footerNote}</p>
      <p style="color:#bbb;font-size:11px;margin:12px 0 0;">&mdash; The ${name} Team</p>
    </div>
  </div>
</body></html>`;

    const text = `Invoice from ${name}\n\nHey ${order.customerName || 'there'},\n\n${thankYou}\n\nOrder #${orderNum}\nDate: ${cookDate}\n${order.pickupTime ? `Pickup: ${order.pickupTime}\n` : ''}\nTotal: $${total}\n\n${paymentUrl ? `Pay here: ${paymentUrl}` : bankDetails ? `Payment Details:\n${bankDetails}` : 'Please arrange payment at your earliest convenience.'}\n\n${footerNote}\n\n— ${name}`;

    await sendEmail(settings, order.customerEmail,
      `Invoice #${orderNum}: $${total} — ${name}`,
      text, html
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Invoice email error:', error);
    res.status(500).json({ error: error.message });
  }
}
