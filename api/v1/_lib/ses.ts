export function isSESConfigured(): boolean {
  return !!(process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY);
}

export async function sendEmailSES(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
}): Promise<{ messageId: string }> {
  if (!isSESConfigured()) {
    throw new Error('Amazon SES not configured. Set AWS_SES_ACCESS_KEY_ID and AWS_SES_SECRET_ACCESS_KEY.');
  }

  // Dynamic import so the AWS SDK only loads when SES is actually used
  const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');

  const client = new SESClient({
    region: process.env.AWS_SES_REGION || 'ap-southeast-2',
    credentials: {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!,
    },
  });

  const fromEmail = opts.fromEmail || process.env.SES_FROM_EMAIL || 'noreply@foodtruckapp.com.au';
  const fromName = opts.fromName || process.env.SES_FROM_NAME || 'Your Business';
  const source = `"${fromName}" <${fromEmail}>`;

  const cmd = new SendEmailCommand({
    Source: source,
    Destination: { ToAddresses: [opts.to] },
    Message: {
      Subject: { Data: opts.subject, Charset: 'UTF-8' },
      Body: {
        Text: { Data: opts.text, Charset: 'UTF-8' },
        Html: { Data: opts.html, Charset: 'UTF-8' },
      },
    },
  });

  const result = await client.send(cmd);
  return { messageId: result.MessageId || '' };
}
