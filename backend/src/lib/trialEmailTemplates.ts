export function trialExpiryReminderTemplate(
  organizationName: string,
  daysUntilExpiry: number,
  trialEndsAt: Date,
): { subject: string; html: string } {
  return {
    subject: `Your trial for ${organizationName} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trial Expiring Soon</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fef3c7; border-radius: 8px; padding: 32px; border: 1px solid #f59e0b;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
      <span style="font-size: 24px;">⚠️</span>
      <h1 style="color: #92400e; margin: 0; font-size: 24px;">Trial Expiring Soon</h1>
    </div>
    
    <p style="margin-bottom: 24px; font-size: 16px;">
      Hi there! Your free trial for <strong>${organizationName}</strong> expires in <strong>${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}</strong> (on ${trialEndsAt.toLocaleDateString()}).
    </p>
    
    <p style="margin-bottom: 24px;">
      After your trial ends, you'll enter a <strong>7-day read-only grace period</strong>. During this time:
    </p>
    
    <ul style="margin-bottom: 24px; padding-left: 20px;">
      <li style="margin-bottom: 8px;">Your data remains visible and accessible</li>
      <li style="margin-bottom: 8px;">No new orders, edits, or staff changes can be made</li>
      <li style="margin-bottom: 8px;">An upgrade prompt will be shown</li>
    </ul>
    
    <p style="margin-bottom: 24px;">
      After the grace period, your account will be <strong>suspended</strong> and you'll lose access until you upgrade.
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.APP_URL}/subscription" 
         style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Upgrade Now
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
      Your trial ends on ${trialEndsAt.toLocaleDateString()} at ${trialEndsAt.toLocaleTimeString()}.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      Questions? Contact our support team.
    </p>
  </div>
</body>
</html>
    `.trim(),
  };
}

export function trialExpiredTemplate(organizationName: string): { subject: string; html: string } {
  return {
    subject: `Your trial for ${organizationName} has expired — now in grace period`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trial Expired</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fef3c7; border-radius: 8px; padding: 32px; border: 1px solid #f59e0b;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
      <span style="font-size: 24px;">⏳</span>
      <h1 style="color: #92400e; margin: 0; font-size: 24px;">Trial Expired — Grace Period Active</h1>
    </div>
    
    <p style="margin-bottom: 24px; font-size: 16px;">
      Your free trial for <strong>${organizationName}</strong> has ended. You're now in a <strong>7-day read-only grace period</strong>.
    </p>
    
    <p style="margin-bottom: 24px;">
      During this grace period:
    </p>
    
    <ul style="margin-bottom: 24px; padding-left: 20px;">
      <li style="margin-bottom: 8px;">Your data remains visible and accessible</li>
      <li style="margin-bottom: 8px;">No new orders, edits, or staff changes can be made</li>
      <li style="margin-bottom: 8px;">An upgrade prompt is shown</li>
    </ul>
    
    <p style="margin-bottom: 24px;">
      After the grace period ends, your account will be <strong>suspended</strong> and you'll lose access until you upgrade.
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.APP_URL}/subscription" 
         style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Upgrade Now to Restore Full Access
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      Need help? Contact our support team.
    </p>
  </div>
</body>
</html>
    `.trim(),
  };
}

export function trialSuspendedTemplate(organizationName: string): {
  subject: string;
  html: string;
} {
  return {
    subject: `Your ${organizationName} account has been suspended`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Suspended</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fef2f2; border-radius: 8px; padding: 32px; border: 1px solid #ef4444;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
      <span style="font-size: 24px;">🔒</span>
      <h1 style="color: #991b1b; margin: 0; font-size: 24px;">Account Suspended</h1>
    </div>
    
    <p style="margin-bottom: 24px; font-size: 16px;">
      Your account for <strong>${organizationName}</strong> has been <strong>suspended</strong> after the grace period ended.
    </p>
    
    <p style="margin-bottom: 24px;">
      You no longer have access to your restaurant management system. Your data is preserved but inaccessible until you upgrade.
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.APP_URL}/subscription" 
         style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Upgrade to Restore Access
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      Need help? Contact our support team.
    </p>
  </div>
</body>
</html>
    `.trim(),
  };
}
