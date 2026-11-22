export function lowStockAlertTemplate(
  organizationName: string,
  outletName: string,
  alerts: Array<{
    ingredientName: string;
    currentStock: number;
    threshold: number;
    unit: string;
  }>,
): { subject: string; html: string } {
  const alertRows = alerts
    .map(
      (alert) => `
  <tr style="border-bottom: 1px solid #e5e7eb;">
    <td style="padding: 12px 16px;">${alert.ingredientName}</td>
    <td style="padding: 12px 16px; text-align: center;">${alert.currentStock.toFixed(3)} ${alert.unit}</td>
    <td style="padding: 12px 16px; text-align: center;">${alert.threshold.toFixed(3)} ${alert.unit}</td>
    <td style="padding: 12px 16px; text-align: center; color: #dc2626; font-weight: 500;">
      ${(((alert.threshold - alert.currentStock) / alert.threshold) * 100).toFixed(0)}% below threshold
    </td>
  </tr>
    `,
    )
    .join('');

  return {
    subject: `⚠️ Low Stock Alert: ${alerts.length} item${alerts.length === 1 ? '' : 's'} at ${outletName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Low Stock Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fef2f2; border-radius: 8px; padding: 32px; border: 1px solid #ef4444;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
      <span style="font-size: 24px;">📉</span>
      <h1 style="color: #991b1b; margin: 0; font-size: 24px;">Low Stock Alert</h1>
    </div>
    
    <p style="margin-bottom: 16px; font-size: 16px;">
      The following ingredient${alerts.length === 1 ? '' : 's'} at <strong>${outletName}</strong> (${organizationName}) 
      ${alerts.length === 1 ? 'is' : 'are'} below the low-stock threshold:
    </p>
    
    <div style="overflow-x: auto; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151;">Ingredient</th>
            <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #374151;">Current Stock</th>
            <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #374151;">Threshold</th>
            <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #374151;">Deficit</th>
          </tr>
        </thead>
        <tbody>
          ${alertRows}
        </tbody>
      </table>
    </div>
    
    <p style="margin-bottom: 24px; color: #6b7280; font-size: 14px;">
      Please restock these ingredients soon to avoid menu items becoming unavailable.
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.APP_URL}/inventory" 
         style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Inventory & Restock
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      This alert was generated automatically. You can configure low-stock thresholds in the inventory settings.
    </p>
  </div>
</body>
</html>
    `.trim(),
  };
}
