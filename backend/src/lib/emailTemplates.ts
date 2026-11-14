export function verificationEmailTemplate(
  verificationUrl: string,
  expiresAt: Date,
): { subject: string; html: string } {
  const expiresHours = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));

  return {
    subject: 'Verify your email address',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 32px;">
    <h1 style="color: #1a1a2e; margin-top: 0; margin-bottom: 16px;">Verify your email address</h1>
    
    <p style="margin-bottom: 24px;">Welcome! Please verify your email address to complete your registration.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verificationUrl}" 
         style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Verify Email
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
      This link expires in ${expiresHours} hours.
    </p>
    
    <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
      If you didn't create an account, you can safely ignore this email.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
    </p>
  </div>
</body>
</html>
    `.trim(),
  };
}

export function passwordResetEmailTemplate(
  resetUrl: string,
  expiresAt: Date,
): { subject: string; html: string } {
  const expiresHours = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));

  return {
    subject: 'Reset your password',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 32px;">
    <h1 style="color: #1a1a2e; margin-top: 0; margin-bottom: 16px;">Reset your password</h1>
    
    <p style="margin-bottom: 24px;">You requested to reset your password. Click the button below to create a new password.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" 
         style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Reset Password
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
      This link expires in ${expiresHours} hours.
    </p>
    
    <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #dc2626; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>
</body>
</html>
    `.trim(),
  };
}

export function invitationEmailTemplate(
  inviteUrl: string,
  organizationName: string,
  roleName: string,
  expiresAt: Date,
): { subject: string; html: string } {
  const expiresHours = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));

  return {
    subject: `You're invited to join ${organizationName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 32px;">
    <h1 style="color: #1a1a2e; margin-top: 0; margin-bottom: 16px;">You're invited!</h1>
    
    <p style="margin-bottom: 24px;">
      You've been invited to join <strong>${organizationName}</strong> as a <strong>${roleName}</strong>.
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${inviteUrl}" 
         style="display: inline-block; background: #059669; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Accept Invitation
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
      This invitation expires in ${expiresHours} hours.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${inviteUrl}" style="color: #059669; word-break: break-all;">${inviteUrl}</a>
    </p>
  </div>
</body>
</html>
    `.trim(),
  };
}
