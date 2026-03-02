import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.EMAIL_API_SECRET;
  if (secret && req.headers['x-api-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { settings, to } = req.body;
    const recipient = to || settings?.adminEmail || settings?.fromEmail;
    if (!recipient) {
      return res.status(400).json({ error: 'No recipient address. Set an Admin Email or From Email first.' });
    }

    // Amazon SES (only if env vars are configured)
    if (process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY) {
      const { sendEmailSES } = await import('../_lib/ses');
      const info = await sendEmailSES({
        to: recipient,
        subject: 'Test Email from Your Business',
        text: 'This is a test email to verify your email settings.',
        html: '<b>This is a test email</b> to verify your Amazon SES email settings. ✅',
        fromEmail: settings?.fromEmail,
        fromName: settings?.fromName,
      });
      return res.json({ success: true, messageId: info.messageId, provider: 'ses' });
    }

    // SMTP
    if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
      return res.status(400).json({ error: 'No email provider configured. Set up Amazon SES env vars or SMTP credentials.' });
    }

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
      to: recipient,
      subject: 'Test Email from Your Business',
      text: 'This is a test email to verify your email settings.',
      html: '<b>This is a test email</b> to verify your email settings.',
    });

    res.json({ success: true, messageId: info.messageId, provider: 'smtp' });
  } catch (error: any) {
    console.error('Email error:', error);
    res.status(500).json({ error: error.message });
  }
}
