import type { RequestHandler } from 'express';

export const bodyLimitMiddleware: RequestHandler = (req, res, next) => {
  // Skip body limit check for multipart/form-data (file uploads handled by multer)
  const contentType = req.headers['content-type'] || '';
  if (contentType.startsWith('multipart/form-data')) {
    return next();
  }

  const contentLength = req.headers['content-length'];
  const maxSize = 1024 * 1024; // 1 MB

  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    res.setHeader('Retry-After', '60');
    res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' },
    });
    return;
  }

  next();
};
