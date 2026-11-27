import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

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