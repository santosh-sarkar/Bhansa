import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '@/errors/AppError';
import { env } from '@/config/env';
import type { MulterFile } from '@/middlewares/multer';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

function validateImageFile(file: MulterFile): void {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      400,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(
      'VALIDATION_ERROR',
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      400,
    );
  }
}

export function initializeCloudinary(): void {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    // In test environment, we may not have credentials - that's OK, we'll mock in tests
    return;
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function isCloudinaryConfigured(): boolean {
  // In test environment, always use mock
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  return !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function getFormatFromMimeType(mimetype: string): string {
  const parts = mimetype.split('/');
  return parts[1] ?? 'jpg';
}

function generateMockUploadResult(file: MulterFile): UploadResult {
  const hash = Buffer.from(file.originalname).toString('base64').slice(0, 20);
  const format = getFormatFromMimeType(file.mimetype);
  return {
    url: `https://res.cloudinary.com/demo/image/upload/v1234567890/bansa/menu/mock_${hash}.${format}`,
    publicId: `bansa/menu/mock_${hash}`,
    width: 800,
    height: 600,
    format,
    bytes: file.size,
  };
}

export async function uploadMenuImage(file: MulterFile): Promise<UploadResult> {
  validateImageFile(file);

  // If Cloudinary is not configured (e.g., in test environment), return mock result
  if (!isCloudinaryConfigured()) {
    return generateMockUploadResult(file);
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'bansa/menu',
        resource_type: 'image',
        transformation: [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(new AppError('INTERNAL_ERROR', 'Failed to upload image to Cloudinary', 500));
          return;
        }

        if (!result) {
          reject(new AppError('INTERNAL_ERROR', 'No result from Cloudinary upload', 500));
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    uploadStream.end(file.buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  if (!isCloudinaryConfigured()) {
    // Mock successful deletion in test environment
    return;
  }

  await new Promise<void>((resolve, reject) => {
    void cloudinary.uploader.destroy(publicId, (error) => {
      if (error) {
        reject(new AppError('INTERNAL_ERROR', 'Failed to delete image from Cloudinary', 500));
        return;
      }
      resolve();
    });
  });
}
