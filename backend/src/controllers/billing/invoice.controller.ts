import type { RequestHandler } from 'express';

import { getBillInvoiceHtml } from '@/services/billing/bill.service';
import { sendSuccess } from '@/utils/response';

export const getBillInvoiceController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { format = 'html' } = req.query as { format?: string };

    const html = await getBillInvoiceHtml(req.user!, id);

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    // For future PDF support
    sendSuccess(res, { html });
  } catch (error) {
    next(error);
  }
};