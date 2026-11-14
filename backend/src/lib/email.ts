import { Resend } from 'resend';

import { env } from '@/config/env';

let resendClient: InstanceType<typeof Resend> | null = null;

function getResendClient(): InstanceType<typeof Resend> {
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  const response = (await getResendClient().emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  })) as { data: { id: string } | null; error: { message: string } | null };

  if (response.error) {
    throw new Error(`Failed to send email: ${response.error.message}`);
  }

  if (!response.data) {
    throw new Error('Failed to send email: no data returned');
  }

  return response.data.id;
}
