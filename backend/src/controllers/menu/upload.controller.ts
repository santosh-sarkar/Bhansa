import type { RequestHandler } from 'express';

import { AppError } from '@/errors/AppError';
import { uploadMenuImage } from '@/services/cloudinary/cloudinary.service';
import { sendSuccess } from '@/utils/response';

export const uploadMenuImageController: RequestHandler = async (req, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      throw new AppError('VALIDATION_ERROR', 'No file uploaded', 400);
    }

    const result = await uploadMenuImage(file);

    sendSuccess(res, { image: result }, { status: 201 });
  } catch (error) {
    next(error);
  }
};
