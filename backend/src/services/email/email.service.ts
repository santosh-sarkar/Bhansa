import { emailQueue } from '@/jobs/email.queue';

import {
  invitationEmailTemplate,
  passwordResetEmailTemplate,
  verificationEmailTemplate,
} from '@/lib/emailTemplates';

const isTest = process.env.NODE_ENV === 'test';

export interface EmailService {
  sendVerificationEmail(email: string, verificationToken: string): Promise<void>;
  sendPasswordResetEmail(email: string, resetToken: string): Promise<void>;
  sendInvitationEmail(
    email: string,
    inviteToken: string,
    organizationName: string,
    roleName: string,
    expiresAt: Date,
  ): Promise<void>;
}

export const emailService: EmailService = {
  async sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
    if (isTest) {
      return;
    }

    const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const { subject, html } = verificationEmailTemplate(verificationUrl, expiresAt);

    await emailQueue.add('send-verification', {
      to: email,
      subject,
      html,
    });
  },

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    if (isTest) {
      return;
    }

    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const { subject, html } = passwordResetEmailTemplate(resetUrl, expiresAt);

    await emailQueue.add('send-password-reset', {
      to: email,
      subject,
      html,
    });
  },

  async sendInvitationEmail(
    email: string,
    inviteToken: string,
    organizationName: string,
    roleName: string,
    expiresAt: Date,
  ): Promise<void> {
    if (isTest) {
      return;
    }

    const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${inviteToken}`;

    const { subject, html } = invitationEmailTemplate(
      inviteUrl,
      organizationName,
      roleName,
      expiresAt,
    );

    await emailQueue.add('send-invitation', {
      to: email,
      subject,
      html,
    });
  },
};
