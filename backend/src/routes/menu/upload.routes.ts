import { Router } from 'express';
import { z } from 'zod';

import { uploadMenuImageController } from '@/controllers/menu/upload.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { multerUpload } from '@/middlewares/multer';

const uploadRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const successResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: { 'application/json': { schema: z.object({ success: z.literal(true), data }) } },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

const uploadResultSchema = z.object({
  url: z.string().url(),
  publicId: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  format: z.string(),
  bytes: z.number().int(),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/menu/upload/image',
  tags: ['Menu'],
  summary: 'Upload menu image to Cloudinary',
  description:
    'Uploads a menu item image to Cloudinary. Accepts JPEG, PNG, and WebP files up to 5MB. Returns the secure URL and metadata. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.instanceof(File),
          }),
        },
      },
    },
  },
  responses: {
    201: successResponse('Image uploaded', z.object({ image: uploadResultSchema })),
    400: errorResponse('Validation error (invalid file type or size)'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    500: errorResponse('Upload failed'),
  },
});

// All routes require authentication
uploadRouter.use(authMiddleware);

// Upload menu image - requires menu.edit permission
uploadRouter.post(
  '/upload/image',
  requireOrgPermission('menu.edit'),
  multerUpload.single('file'),
  uploadMenuImageController,
);

export { uploadRouter };
