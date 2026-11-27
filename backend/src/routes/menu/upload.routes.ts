import { Router } from 'express';

import { uploadMenuImageController } from '@/controllers/menu/upload.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { multerUpload } from '@/middlewares/multer';

const uploadRouter = Router();

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