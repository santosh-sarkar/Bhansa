import { Router } from 'express';

import { resolveQrTokenController } from '@/controllers/public/public-table.controller';
import { validate } from '@/middlewares/validate';
import { qrTokenSchema } from '@/validations/public/public-table.schema';

const publicTableRouter = Router();

publicTableRouter.get(
  '/tables/:qrToken',
  validate({ params: qrTokenSchema.shape.params }),
  resolveQrTokenController,
);

export { publicTableRouter };