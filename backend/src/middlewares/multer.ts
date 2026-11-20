import multer, { type FileFilterCallback } from 'multer';

const memoryStorage = multer.memoryStorage();

export const multerUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb: FileFilterCallback) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
    cb(null, true);
  },
});

export type MulterFile = Express.Multer.File;

// Extend Express Request type to include file from multer
declare module 'express-serve-static-core' {
  interface Request {
    file?: MulterFile;
  }
}
